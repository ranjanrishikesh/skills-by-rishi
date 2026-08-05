#!/usr/bin/env node
// Publish checks, shared by both enforcement points.
//
// Two things guard publishing, and they are not equals:
//
//   1. the pre-push hook  -- AUTHORITATIVE. Git invokes it on the actual push,
//      after the shell has finished doing whatever it was going to do. It
//      cannot be fooled by how the command was spelled.
//
//   2. pretooluse-gate.mjs -- ADVISORY. A PreToolUse hook that guesses from the
//      command string, so an agent gets the message before it wastes a round
//      trip. It also covers `gh pr create`, which no git hook sees.
//
// THE SPLIT IS ALSO WHAT MAKES THIS AGENT-AGNOSTIC.
//
// Git runs the pre-push hook itself, with no agent involved, so enforcement
// works identically under Claude Code, Codex, Cursor, a bare terminal or CI.
// The PreToolUse half is the only part bound to one harness, and losing it
// costs fast feedback and `gh pr create` coverage, never enforcement. Do not
// invert that relationship.
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
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { checkReceipt } from './review-receipt.mjs';
import { loadConfig, projectRoot, CONFIG_NAME } from './config.mjs';

export { projectRoot };

function sh(cmd, cwd) {
  try { return execSync(cmd, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }); }
  catch { return ''; }
}

/**
 * Whether the hook git will ACTUALLY run on push calls these checks.
 *
 * The version this was ported from compared `core.hooksPath` to the literal
 * string `.githooks`, which is wrong in a portable skill for a reason that bites
 * immediately: git allows exactly one hooks directory per repository, and husky
 * and lefthook both claim it. In such a repo our hook is correctly installed by
 * chaining into the existing pre-push, and the old check would report it
 * missing forever while it worked perfectly.
 *
 * So ask the real question instead. Find the pre-push git would run, wherever
 * that is, and look for a call to this file inside it.
 */
export function hooksInstalled(projectDir) {
  const configured = sh('git config --get core.hooksPath', projectDir).trim();
  const gitDir = sh('git rev-parse --absolute-git-dir', projectDir).trim() || path.join(projectDir, '.git');
  const dir = configured
    ? (path.isAbsolute(configured) ? configured : path.join(projectDir, configured))
    : path.join(gitDir, 'hooks');
  const hook = path.join(dir, 'pre-push');
  if (!existsSync(hook)) return false;
  try { return readFileSync(hook, 'utf8').includes('publish-checks.mjs'); }
  catch { return false; }
}

/**
 * Scan the audience-facing files about to ship for hard-banned AI writing
 * tells. Returns an array of violations, possibly empty.
 */
export function scanTells(projectDir, cfg) {
  // The rules file is named by review.config.json rather than found at a fixed
  // path, because what counts as a banned tell is a property of the repository
  // and not of this skill. A repo that wants none simply sets it to null.
  const rulesPath = cfg.publishGate && cfg.publishGate.rules;
  if (!rulesPath) return { violations: [], skipped: 'no tell-rules file configured' };

  let ruleFile = {};
  let rules = [];
  try {
    ruleFile = JSON.parse(readFileSync(path.resolve(projectDir, rulesPath), 'utf8'));
    rules = (ruleFile.rules || []).filter((r) => r.severity === 'block');
  } catch {
    return { violations: [], skipped: `${rulesPath} unreadable` };
  }
  if (rules.length === 0) return { violations: [], skipped: 'no blocking rules configured' };

  // Config wins over the rules file, which wins over nothing. The rules file
  // may carry its own scanDirs so a shared ruleset stays self-describing, but
  // the repo it is installed into gets the final say on what may be scanned.
  const dirs = (cfg.publishGate.scanDirs && cfg.publishGate.scanDirs.length)
    ? cfg.publishGate.scanDirs
    : (ruleFile.scanDirs || []);
  const exts = new Set(
    (cfg.publishGate.scanExt && cfg.publishGate.scanExt.length)
      ? cfg.publishGate.scanExt
      : (ruleFile.scanExt || []),
  );
  if (dirs.length === 0) return { violations: [], skipped: 'no scan directories configured' };

  // The base ref comes from config. It was hardcoded to origin/main here while
  // the receipt took it as a parameter everywhere, so this scan and the receipt
  // check could measure two different change sets. Worse, on any repo whose
  // default branch is not main it resolved to nothing, and the indeterminate
  // path below correctly fails closed, which means every push was blocked with
  // an error that reads like a fetch problem.
  const baseRef = cfg.baseBranch;
  const base = sh(`git merge-base ${baseRef} HEAD`, projectDir).trim();
  // Not a skip. If the base cannot be resolved we do not know what is shipping,
  // and the caller must refuse rather than wave it through. See runChecks.
  if (!base) return { violations: [], indeterminate: `could not resolve ${baseRef}` };

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
  // The config is read FIRST and a bad one refuses, for the same reason an
  // unresolvable base ref refuses below: this component's entire job is to say
  // what is about to ship, and it cannot do that on assumptions.
  //
  // Note the asymmetry with review-receipt.mjs, which happily runs on detected
  // defaults when no config exists. That is deliberate. There, guessing costs
  // an unnecessary review. Here, guessing costs an unreviewed push.
  const loaded = loadConfig(projectDir);
  if (loaded.invalid) {
    return {
      ok: false,
      indeterminate: true,
      reason: `${CONFIG_NAME} is unusable (${loaded.problems[0]}), so nothing can say what is about to ship`,
      violations: [],
      waived: false,
      notConfigured: true,
    };
  }
  if (loaded.missing) {
    return {
      ok: false,
      indeterminate: true,
      reason: `no ${CONFIG_NAME} in this repository, so the gate does not know what to check`,
      violations: [],
      waived: false,
      notConfigured: true,
    };
  }
  const cfg = loaded.config;

  // An installed hook with the gate switched off is a real configuration, not a
  // mistake: a repo may want the review skill and no enforcement. Say yes
  // plainly rather than half-checking.
  if (cfg.publishGate && cfg.publishGate.enabled === false) {
    return { ok: true, waived: false, container: false, containerSkips: [], disabled: true, hooksInstalled: hooksInstalled(projectDir) };
  }

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
  // computeScope resolves the base for the receipt hash, and scanTells resolves
  // it again for the tell scan. So an unresolvable base disabled the
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
    const r = checkReceipt(cfg.baseBranch);
    if (r.ok === false) reviewProblem = r.reason;
    else if (r.ok === null) {
      return {
        ok: false,
        indeterminate: true,
        reason: `the change set could not be determined (${r.reason}), so nothing can vouch for it`,
        violations: [],
        waived: false,
        baseBranch: cfg.baseBranch,
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
      baseBranch: cfg.baseBranch,
    };
  }

  // scanTells must not be able to throw its way to a silent allow. On the
  // PreToolUse path a non-zero exit is a NON-BLOCKING error, so an uncaught
  // crash there would let the very command it gates proceed. A malformed rules
  // file (say scanDirs as a string instead of an array) is enough, which is why
  // config.mjs validates that shape before anything reaches here.
  let violations = [];
  try {
    const res = scanTells(projectDir, cfg);
    violations = res.violations;
    if (res.indeterminate) {
      // Same reasoning as above: could-not-determine is not could-not-find.
      return {
        ok: false,
        indeterminate: true,
        reason: `the shipping file set could not be determined (${res.indeterminate}), so the tell scan never ran`,
        violations: [],
        waived: false,
        baseBranch: cfg.baseBranch,
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
      baseBranch: cfg.baseBranch,
    };
  }

  // The authoritative gate only exists if git was told where to find it. Hook
  // installation is local config and is never committed, so a fresh clone that
  // never ran the installer has no pre-push hook at all and is relying entirely
  // on this advisory one, which does not run for a human terminal or CI.
  const installed = hooksInstalled(projectDir);

  if (!reviewProblem && violations.length === 0) {
    return { ok: true, waived, container, containerSkips, hooksInstalled: installed };
  }
  return { ok: false, reason: reviewProblem, violations, waived, container, containerSkips, hooksInstalled: installed };
}

/**
 * Where this skill is installed, derived from this file's own location rather
 * than assumed. The skill can be vendored anywhere, and a block message that
 * points at a path which does not exist in this repo is worse than one that
 * points at nothing.
 */
function skillDir(projectDir) {
  const abs = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
  const rel = path.relative(projectDir, abs);
  return rel.startsWith('..') ? abs : rel;
}

/** Build the human-facing block message from a failed runChecks() result. */
export function formatBlock(result, projectDir = projectRoot()) {
  const parts = [];
  const steps = [];
  const skill = skillDir(projectDir);

  if (result.violations && result.violations.length > 0) {
    const byRule = {};
    for (const v of result.violations) (byRule[v.id] ||= []).push(v);
    let s = `TELLS: ${result.violations.length} banned writing tell(s) remain in content about to ship:\n`;
    for (const [id, vs] of Object.entries(byRule)) {
      s += `- ${id} (${vs.length}): ${vs[0].message}\n`;
      for (const v of vs.slice(0, 8)) s += `    ${v.file}:${v.line}  ${v.snippet}\n`;
      if (vs.length > 8) s += `    ...and ${vs.length - 8} more\n`;
    }
    parts.push(s);
    steps.push(`rewrite the flagged content into this repo's voice, following ${skill}/references/voice/rewriting.md and the tell catalog beside it. Do NOT just delete the offending character: rewrite the sentence so it was never needed`);
  }

  if (result.indeterminate) {
    // Only offer remediation that applies. An unconfigured repo has no base
    // branch to name, and printing "git fetch the configured base branch" as
    // though it were a command is worse than printing nothing: it sends the
    // reader off to fix something that is not the problem.
    const fixes = result.notConfigured
      ? [`  - run: /code-review init   (or: node ${skill}/scripts/install.mjs)`]
      : [
          `  - ${result.baseBranch} was never fetched:  git fetch ${String(result.baseBranch).replace('/', ' ')}`,
          `  - the configured base is wrong:  fix "baseBranch" in ${CONFIG_NAME}`,
          `  - a shallow clone:               git fetch --unshallow`,
        ];
    return `PUBLISH BLOCKED by the pre-publish gate.\n\n`
      + `INDETERMINATE: ${result.reason}.\n\n`
      + `This is not a finding against your change. The gate could not work out what is\n`
      + `about to ship, and refuses rather than guessing, because a gate that cannot tell\n`
      + `must not say yes.\n\n`
      + `To fix:\n${fixes.join('\n')}\n`;
  }

  if (result.reason) {
    parts.push(`CODE REVIEW: ${result.reason}.`);
    // One pass, no loop. The skill reviews with the mid tier, fixes with the
    // strong one, and stamps. Fixes are not re-reviewed: the model tier is the
    // quality control.
    steps.push('run /code-review. It reviews the change set, fixes what it finds, re-runs the deterministic gate, and stamps a receipt in one pass. It only escalates factual claims that only you can settle');
  }

  let reason = `PUBLISH BLOCKED by the pre-publish gate.\n\n${parts.join('\n')}\n\nTo publish:\n`;
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

// CLI mode, used by the pre-push hook:
//   node publish-checks.mjs      exit 0 to allow, exit 1 to refuse
// Kept in this file rather than a separate runner so the two entry points
// cannot drift apart.
if (process.argv[1] && process.argv[1].endsWith('publish-checks.mjs')) {
  const dir = projectRoot();
  const result = runChecks(dir);
  if (result.ok) {
    if (result.disabled) {
      process.stderr.write('\n  !! the publish gate is disabled in review.config.json. Nothing was checked.\n\n');
    }
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
      process.stderr.write('\n  !! no pre-push hook in this clone calls these checks.\n');
      process.stderr.write(`  !! Run: node ${skillDir(dir)}/scripts/install.mjs\n\n`);
    }
    process.exit(0);
  }
  process.stderr.write(formatBlock(result, dir));
  process.exit(1);
}
