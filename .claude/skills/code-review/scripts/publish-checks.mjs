#!/usr/bin/env node
// agentclaw publish checks, shared by both enforcement points.
//
// Two things guard publishing, and they are not equals:
//
//   1. .githooks/pre-push  -- AUTHORITATIVE. Git invokes it on the actual push,
//      after the shell has finished doing whatever it was going to do. It
//      cannot be fooled by how the command was spelled.
//
//   2. .claude/hooks/humanizer-gate.mjs -- ADVISORY. A PreToolUse hook that
//      guesses from the command string, so an agent gets the message before it
//      wastes a round trip. It also covers `gh pr create`, which no git hook
//      sees.
//
// That split exists because three review cycles each found a NEW way to slip a
// publish past a string matcher: command substitution inside quotes, heredoc
// bodies, ANSI-C quoting, backslash-escaped command names, and branch names
// containing an excluded keyword. Every one of them executed for real. The
// lesson is not "write a better regex", it is that you cannot decide what a
// shell will do by pattern-matching its text. So the string matcher was demoted
// to a hint and the real check moved to where git tells us the truth.
//
// Both entry points call runChecks() so their verdicts can never disagree.

import { readFileSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import path from 'node:path';
import { checkReceipt } from './review-receipt.mjs';

export function projectRoot() {
  return process.env.CLAUDE_PROJECT_DIR || process.cwd();
}

function sh(cmd, cwd) {
  try { return execSync(cmd, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }); }
  catch { return ''; }
}

/**
 * Scan the audience-facing files about to ship for hard-banned AI writing
 * tells. Returns an array of violations, possibly empty.
 */
export function scanTells(projectDir) {
  let config = {};
  let rules = [];
  try {
    config = JSON.parse(readFileSync(path.join(projectDir, '.claude/hooks/ai-tells-lint.json'), 'utf8'));
    rules = (config.rules || []).filter((r) => r.severity === 'block');
  } catch {
    return { violations: [], skipped: 'ai-tells-lint.json unreadable' };
  }
  if (rules.length === 0) return { violations: [], skipped: 'no blocking rules configured' };

  const dirs = config.scanDirs || ['content', 'components', 'app'];
  const exts = new Set(config.scanExt || ['.json', '.ts', '.tsx', '.md', '.mdx']);

  const base = sh('git merge-base origin/main HEAD', projectDir).trim();
  // Not a skip. If the base cannot be resolved we do not know what is shipping,
  // and the caller must refuse rather than wave it through. See runChecks.
  if (!base) return { violations: [], indeterminate: 'could not resolve origin/main' };

  const changed = new Set();
  for (const src of [
    `git diff --name-only --diff-filter=ACMR ${base}...HEAD`,
    'git diff --name-only --diff-filter=ACMR HEAD',
    'git diff --name-only --diff-filter=ACMR --cached',
  ]) {
    sh(src, projectDir).split('\n').map((s) => s.trim()).filter(Boolean).forEach((f) => changed.add(f));
  }

  const files = [...changed].filter((f) => {
    const inDir = dirs.some((d) => f === d || f.startsWith(d + '/'));
    return inDir && exts.has(path.extname(f));
  });

  const makeRe = (src) => {
    try { return new RegExp(src, 'u'); }
    catch { try { return new RegExp(src); } catch { return null; } }
  };

  const violations = [];
  for (const rel of files) {
    const abs = path.join(projectDir, rel);
    if (!existsSync(abs)) continue;
    let text;
    try { text = readFileSync(abs, 'utf8'); } catch { continue; }
    const lines = text.split('\n');
    for (const rule of rules) {
      // Per-rule directory scoping: a rule may narrow itself to specific dirs
      // (e.g. curly quotes only in content/, not in rendering components).
      if (rule.dirs && !rule.dirs.some((d) => rel === d || rel.startsWith(d + '/'))) continue;
      const re = makeRe(rule.regex);
      if (!re) continue;
      lines.forEach((line, i) => {
        if (re.test(line)) {
          violations.push({ file: rel, line: i + 1, id: rule.id, message: rule.message, snippet: line.trim().slice(0, 120) });
        }
      });
    }
  }
  return { violations };
}

/**
 * Run both invariants. Returns:
 *   { ok: true,  waived: boolean }                    -> allow
 *   { ok: false, reason: string, violations: [...] }  -> block
 *
 * Infrastructure failure (unusual git state) fails OPEN, with a warning, so an
 * odd checkout does not brick every publish. A missing or stale receipt fails
 * CLOSED, because that is the thing being gated.
 */
export function runChecks(projectDir = projectRoot()) {
  let reviewProblem = null;
  let waived = false;
  // Set when the receipt was stamped in container mode: the review ran, but the
  // browser-driven dimensions could not. It allows the publish and carries the
  // skip list through so the caller can say what nobody looked at.
  let container = false;
  let containerSkips = [];

  // Resolving the base ref is the one piece of "infrastructure" that must fail
  // CLOSED, not open.
  //
  // It used to fail open, and both invariants depended on it independently:
  // computeScope resolves origin/main for the receipt hash, and scanTells
  // resolves it again for the tell scan. So an unresolvable base disabled the
  // whole gate at once, and on the gh pr create path the only trace was a
  // stderr line the harness discards. That is not an exotic corruption case:
  // a shallow clone, a remote that has never been fetched, or a fork whose
  // remote is not literally named origin all produce it. Verified by landing
  // unreviewed content with a banned tell on a real remote.
  //
  // The reasoning is simple: if we cannot determine what is about to ship, we
  // cannot say it is safe to ship it. "I could not tell" must not resolve to
  // "go ahead" in the one component whose entire job is to tell.
  try {
    const r = checkReceipt();
    if (r.ok === false) reviewProblem = r.reason;
    else if (r.ok === null) {
      return {
        ok: false,
        indeterminate: true,
        reason: `the change set could not be determined (${r.reason}), so nothing can vouch for it`,
        violations: [],
        waived: false,
      };
    } else if (r.waived) {
      waived = true;
    } else if (r.container) {
      container = true;
      containerSkips = r.containerSkips || [];
    }
  } catch (e) {
    return {
      ok: false,
      indeterminate: true,
      reason: `the receipt check errored (${e.message}), so nothing can vouch for this change set`,
      violations: [],
      waived: false,
    };
  }

  // scanTells must not be able to throw its way to a silent allow. On the
  // PreToolUse path a non-zero exit is a NON-BLOCKING error, so an uncaught
  // crash there would let the very command it gates proceed. A malformed
  // ai-tells-lint.json (say scanDirs as a string instead of an array) is enough.
  let violations = [];
  try {
    const res = scanTells(projectDir);
    violations = res.violations;
    if (res.indeterminate) {
      // Same reasoning as above: could-not-determine is not could-not-find.
      return {
        ok: false,
        indeterminate: true,
        reason: `the shipping file set could not be determined (${res.indeterminate}), so the tell scan never ran`,
        violations: [],
        waived: false,
      };
    }
    // A configured-away scan is a different thing from an undeterminable one:
    // it is a deliberate local choice, so warn rather than refuse.
    if (res.skipped) {
      process.stderr.write(`[publish-checks] tell scan did NOT run: ${res.skipped} (fail-open).\n`);
    }
  } catch (e) {
    // A crash here cannot be allowed to become a silent allow. On the
    // PreToolUse path a non-zero exit is a NON-BLOCKING error, so throwing
    // would let the very command this gates proceed.
    return {
      ok: false,
      indeterminate: true,
      reason: `the tell scan errored (${e.message}), so nothing checked the content about to ship`,
      violations: [],
      waived: false,
    };
  }

  // The authoritative gate only exists if git was told where to find it.
  // core.hooksPath is local config, so a clone that never ran the prepare
  // script has no pre-push hook at all and is relying entirely on this
  // advisory one, which does not run for a human terminal or CI.
  const hooksPath = sh('git config --get core.hooksPath', projectDir).trim();
  const hooksInstalled = hooksPath === '.githooks';

  if (!reviewProblem && violations.length === 0) {
    return { ok: true, waived, container, containerSkips, hooksInstalled };
  }
  return { ok: false, reason: reviewProblem, violations, waived, container, containerSkips, hooksInstalled };
}

/** Build the human-facing block message from a failed runChecks() result. */
export function formatBlock(result) {
  const parts = [];
  const steps = [];

  if (result.violations && result.violations.length > 0) {
    const byRule = {};
    for (const v of result.violations) (byRule[v.id] ||= []).push(v);
    let s = `HUMANIZER: ${result.violations.length} AI writing tell(s) remain in content about to ship:\n`;
    for (const [id, vs] of Object.entries(byRule)) {
      s += `- ${id} (${vs.length}): ${vs[0].message}\n`;
      for (const v of vs.slice(0, 8)) s += `    ${v.file}:${v.line}  ${v.snippet}\n`;
      if (vs.length > 8) s += `    ...and ${vs.length - 8} more\n`;
    }
    parts.push(s);
    steps.push('rewrite the flagged content into agentclaw founder voice, following .claude/skills/code-review/references/voice/rewriting.md and the tell catalog beside it. Do NOT just delete the dash: rewrite the sentence so no dash was ever needed');
  }

  if (result.indeterminate) {
    return `PUBLISH BLOCKED by the agentclaw pre-publish gate.\n\n`
      + `INDETERMINATE: ${result.reason}.\n\n`
      + `This is not a finding against your change. The gate could not work out what is\n`
      + `about to ship, and refuses rather than guessing, because a gate that cannot tell\n`
      + `must not say yes.\n\n`
      + `Usual causes and fixes:\n`
      + `  - origin/main was never fetched:      git fetch origin main\n`
      + `  - the remote is not named "origin":   fetch the real remote, then retry\n`
      + `  - a shallow clone:                    git fetch --unshallow\n`;
  }

  if (result.reason) {
    parts.push(`CODE REVIEW: ${result.reason}.`);
    // One pass, no loop. The skill reviews with Sonnet, fixes with Opus, and
    // stamps. Fixes are not re-reviewed: the model tier is the quality control.
    steps.push('run /code-review. It reviews the change set, fixes what it finds, re-runs the build gate, and stamps a receipt in one pass. It only escalates factual claims about pricing, dates or clients, which need your answer');
  }

  let reason = `PUBLISH BLOCKED by the agentclaw pre-publish gate.\n\n${parts.join('\n')}\n\nTo publish:\n`;
  steps.forEach((s, i) => { reason += `  ${i + 1}. ${s}\n`; });
  reason += `  ${steps.length + 1}. retry the publish command.\n`;
  return reason;
}

/**
 * The one sentence both entry points say about a container-mode receipt. Shared
 * for the same reason runChecks is: a warning worded two ways is two warnings to
 * keep true. Returns null when the receipt was a normal one.
 */
export function formatContainerNotice(result) {
  if (!result.container) return null;
  const skips = (result.containerSkips || []).join('; ') || 'the browser-driven dimensions';
  return `REVIEWED IN CONTAINER MODE: every dimension ran except ${skips}, `
    + `which need a browser this environment does not have. Nothing rendered this change. `
    + `Say so when reporting what you published.`;
}

// CLI mode, used by .githooks/pre-push:
//   node publish-checks.mjs      exit 0 to allow, exit 1 to refuse
// Kept in this file rather than a separate runner so the two entry points
// cannot drift apart.
if (process.argv[1] && process.argv[1].endsWith('publish-checks.mjs')) {
  const result = runChecks();
  if (result.ok) {
    if (result.waived) {
      process.stderr.write('\n  !! REVIEW WAIVED. This change set was NOT reviewed.\n');
      process.stderr.write('  !! A waiver was recorded at explicit user request.\n\n');
    }
    // Print what the shared formatter returned, rather than re-describing it
    // here. Writing a second wording four lines under a function whose entire
    // job is to hold one is how the two channels start disagreeing.
    const containerNotice = formatContainerNotice(result);
    if (containerNotice) process.stderr.write(`\n  !! ${containerNotice}\n\n`);
    if (result.hooksInstalled === false) {
      process.stderr.write('\n  !! core.hooksPath is not set to .githooks in this clone.\n');
      process.stderr.write('  !! Run: pnpm install   (or: git config core.hooksPath .githooks)\n\n');
    }
    process.exit(0);
  }
  process.stderr.write(formatBlock(result));
  process.exit(1);
}
