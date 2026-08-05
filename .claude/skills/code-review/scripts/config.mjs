#!/usr/bin/env node
// The one file that knows anything about the host repository.
//
// Everything else in this skill is methodology. This is where "which branch",
// "which build commands", "which paths are UI code", "which model tier" and
// "what may this gate scan" come from, so that porting the skill to a new repo
// is editing one JSON file rather than grepping four hundred lines of prose for
// hardcoded assumptions. That is not an aesthetic preference: the version this
// was extracted from had `origin/main` compiled into two separate enforcement
// points, and a repo on `master` would have had every push blocked by an error
// message about fetching.
//
// WHY THE CONFIG LIVES AT THE REPO ROOT, NOT UNDER .claude/
//
// The point of this file is that the skill is agent-agnostic. Burying its
// configuration inside a directory named after one specific agent would
// contradict the thing it exists to enable. A pre-push hook run by git, on a
// machine with no agent installed at all, still has to find this.
//
// FAIL-CLOSED VS FAIL-OPEN, WHICH IS NOT THE SAME QUESTION EVERYWHERE
//
// A missing config is NOT an error here. `loadConfig` returns defaults with
// `missing: true` and lets the caller decide, because the two callers need
// opposite behaviour:
//
//   - review-receipt.mjs must work before a config exists, or `init` could
//     never bootstrap a repo in the first place.
//   - publish-checks.mjs must refuse, because a gate that cannot tell what it
//     is gating must not say yes. Same reasoning as its own indeterminate path.
//
// A malformed config, by contrast, is an error for everybody. Silently falling
// back to defaults when someone typed `"scanDirs": "src"` instead of
// `["src"]` would mean the gate scans a list of single characters and reports
// clean. Validation below is deliberately strict and names the offending key.

import { readFileSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import path from 'node:path';

export const CONFIG_NAME = 'review.config.json';

function sh(cmd, cwd) {
  try {
    return execSync(cmd, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch { return ''; }
}

/**
 * Where the repository is.
 *
 * CLAUDE_PROJECT_DIR first because the Claude Code harness sets it and it is
 * exact. Then git, which is correct on every agent and in a bare terminal, and
 * is the reason this works under a pre-push hook that no agent invoked. cwd
 * last, and only as a floor: a hook can run from a subdirectory, and resolving
 * `review.config.json` against the wrong directory would silently find nothing
 * and hand back defaults.
 */
export function projectRoot(start = process.cwd()) {
  if (process.env.CLAUDE_PROJECT_DIR) return process.env.CLAUDE_PROJECT_DIR;
  const top = sh('git rev-parse --show-toplevel', start).trim();
  return top || start;
}

/**
 * The base branch, when the config does not name one.
 *
 * `origin/HEAD` is what the remote itself says its default branch is, so this
 * is correct on master, main, trunk, develop or anything else without guessing.
 * It is not always present: it is set by `git clone` but not by `git remote
 * add`, so the fallbacks below matter. They are ordered by how likely they are
 * to be right, and `origin/main` is last rather than first for the same reason
 * this function exists at all.
 */
export function detectBaseBranch(dir = projectRoot()) {
  const head = sh('git symbolic-ref --quiet refs/remotes/origin/HEAD', dir).trim();
  if (head) return head.replace(/^refs\/remotes\//, '');
  for (const candidate of ['origin/main', 'origin/master', 'origin/trunk', 'origin/develop']) {
    if (sh(`git rev-parse --verify --quiet ${candidate}`, dir).trim()) return candidate;
  }
  return 'origin/main';
}

/**
 * Defaults for a repository that has not been initialised yet.
 *
 * Deliberately minimal rather than clever. An empty `gate` runs no build
 * commands, which is honest for an unknown repo; a guessed `npm test` that
 * turns out to be a twenty-minute integration suite needing a database is not.
 * `init` fills this in from detection plus confirmation, and until it does, the
 * skill reports that it ran no deterministic gate rather than pretending to.
 */
export const DEFAULTS = {
  baseBranch: null,              // null means detect
  receiptName: 'code-review-receipt.json',
  install: null,                 // { run, detect } or null
  gate: [],                      // [{ name, run, blocking, needsBuild }]
  models: { scan: 'fast', review: 'mid', fix: 'strong' },
  modelIds: {},                  // { fast: "...", mid: "...", strong: "..." }
  classes: {},                   // { CLASS: [glob, ...] }
  dimensions: {
    'instructions-compliance': true,
    bugs: true,
    truth: true,
    reuse: true,
    discoverability: false,
    interface: false,
    voice: false,
    'keyword-contract': false,
  },
  repoFacts: {
    instructionFiles: [],
    sourcesOfRecord: [],
    routeMap: null,
    voiceSpec: null,
  },
  dev: null,                     // { run, url } or null
  publishGate: {
    enabled: false,
    scanDirs: [],
    scanExt: ['.md', '.mdx', '.txt'],
    rules: null,                 // path to an ai-tells-lint.json, or null
  },
};

const isStr = (v) => typeof v === 'string' && v.length > 0;
const isStrArray = (v) => Array.isArray(v) && v.every(isStr);

/**
 * Validate shape, not taste. Every check here corresponds to a way the value
 * gets used downstream where a wrong type would fail silently rather than
 * loudly: a string where an array is expected iterates as characters, a missing
 * `run` makes a gate step a no-op that still reports as passing.
 *
 * Returns an array of human-readable problems, empty when the config is usable.
 */
export function validate(raw) {
  const problems = [];
  const at = (k, msg) => problems.push(`${k}: ${msg}`);

  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    return ['the config must be a JSON object'];
  }

  if ('baseBranch' in raw && raw.baseBranch !== null && !isStr(raw.baseBranch)) {
    at('baseBranch', 'must be a string like "origin/main", or null to auto-detect');
  }
  if ('receiptName' in raw && !isStr(raw.receiptName)) {
    at('receiptName', 'must be a non-empty string');
  }

  if ('gate' in raw) {
    if (!Array.isArray(raw.gate)) {
      at('gate', 'must be an array of steps, in the order they should run');
    } else {
      raw.gate.forEach((step, i) => {
        if (step === null || typeof step !== 'object') return at(`gate[${i}]`, 'must be an object');
        if (!isStr(step.name)) at(`gate[${i}].name`, 'must be a non-empty string');
        // A step with no command is the dangerous case: it would be skipped
        // while still counting as a step that ran clean.
        if (!isStr(step.run)) at(`gate[${i}].run`, 'must be the shell command to run');
        if ('blocking' in step && typeof step.blocking !== 'boolean') {
          at(`gate[${i}].blocking`, 'must be true or false');
        }
        if ('needsBuild' in step && typeof step.needsBuild !== 'boolean') {
          at(`gate[${i}].needsBuild`, 'must be true or false');
        }
      });
    }
  }

  if ('classes' in raw) {
    if (raw.classes === null || typeof raw.classes !== 'object' || Array.isArray(raw.classes)) {
      at('classes', 'must be an object mapping a class name to an array of globs');
    } else {
      for (const [cls, globs] of Object.entries(raw.classes)) {
        if (!isStrArray(globs)) at(`classes.${cls}`, 'must be an array of glob strings');
      }
    }
  }

  if ('dimensions' in raw) {
    if (raw.dimensions === null || typeof raw.dimensions !== 'object' || Array.isArray(raw.dimensions)) {
      at('dimensions', 'must be an object mapping a dimension id to true or false');
    } else {
      for (const [dim, on] of Object.entries(raw.dimensions)) {
        if (typeof on !== 'boolean') at(`dimensions.${dim}`, 'must be true or false');
        if (!(dim in DEFAULTS.dimensions)) {
          at(`dimensions.${dim}`, `is not a known dimension (known: ${Object.keys(DEFAULTS.dimensions).join(', ')})`);
        }
      }
    }
  }

  if ('models' in raw && raw.models !== null && typeof raw.models === 'object') {
    for (const role of ['scan', 'review', 'fix']) {
      if (role in raw.models && !isStr(raw.models[role])) {
        at(`models.${role}`, 'must be a tier name: "fast", "mid" or "strong"');
      }
    }
  }

  if ('publishGate' in raw && raw.publishGate !== null && typeof raw.publishGate === 'object') {
    const g = raw.publishGate;
    if ('enabled' in g && typeof g.enabled !== 'boolean') at('publishGate.enabled', 'must be true or false');
    // The specific mistake this catches is a string where an array belongs.
    // scanDirs as "src" would be iterated character by character, so every
    // path check compares against "s", "r", "c" and the scan reports clean.
    if ('scanDirs' in g && !isStrArray(g.scanDirs)) at('publishGate.scanDirs', 'must be an array of directory strings');
    if ('scanExt' in g && !isStrArray(g.scanExt)) at('publishGate.scanExt', 'must be an array of extension strings like ".md"');
    if ('rules' in g && g.rules !== null && !isStr(g.rules)) at('publishGate.rules', 'must be a path string, or null');
  }

  if ('repoFacts' in raw && raw.repoFacts !== null && typeof raw.repoFacts === 'object') {
    const f = raw.repoFacts;
    if ('instructionFiles' in f && !isStrArray(f.instructionFiles)) {
      at('repoFacts.instructionFiles', 'must be an array of paths like ["CLAUDE.md", "AGENTS.md"]');
    }
    if ('sourcesOfRecord' in f && !isStrArray(f.sourcesOfRecord)) {
      at('repoFacts.sourcesOfRecord', 'must be an array of paths');
    }
  }

  return problems;
}

/** Shallow-merge one level deep, so a partial config keeps unspecified defaults. */
function merge(base, over) {
  const out = { ...base };
  for (const [k, v] of Object.entries(over)) {
    if (v !== null && typeof v === 'object' && !Array.isArray(v) && base[k] && typeof base[k] === 'object' && !Array.isArray(base[k])) {
      out[k] = { ...base[k], ...v };
    } else {
      out[k] = v;
    }
  }
  return out;
}

/**
 * Read and validate the config.
 *
 * Returns { config, missing, invalid, problems, path, dir }.
 *
 * `missing` and `invalid` are separate on purpose. Missing means "not
 * initialised", which is a normal state the skill can bootstrap out of.
 * Invalid means someone edited it into a shape that cannot be trusted, and no
 * caller should proceed on defaults as if nothing were wrong.
 */
export function loadConfig(dir = projectRoot()) {
  const p = path.join(dir, CONFIG_NAME);
  if (!existsSync(p)) {
    return { config: resolve(DEFAULTS, dir), missing: true, invalid: false, problems: [], path: p, dir };
  }
  let raw;
  try {
    raw = JSON.parse(readFileSync(p, 'utf8'));
  } catch (err) {
    return {
      config: resolve(DEFAULTS, dir), missing: false, invalid: true,
      problems: [`${CONFIG_NAME} is not valid JSON: ${err.message}`], path: p, dir,
    };
  }
  const problems = validate(raw);
  if (problems.length) {
    return { config: resolve(DEFAULTS, dir), missing: false, invalid: true, problems, path: p, dir };
  }
  return { config: resolve(merge(DEFAULTS, raw), dir), missing: false, invalid: false, problems: [], path: p, dir };
}

/** Fill in the values that are computed rather than written down. */
function resolve(cfg, dir) {
  const out = { ...cfg };
  out.baseBranch = cfg.baseBranch || detectBaseBranch(dir);
  return out;
}

/** The model id for a role, when the host has been mapped. Null means "let the host decide". */
export function modelFor(config, role) {
  const tier = (config.models || {})[role];
  if (!tier) return null;
  return (config.modelIds || {})[tier] || null;
}

// CLI, for humans and for the skill's own reporting:
//   node config.mjs           print the resolved config
//   node config.mjs check     exit 0 if usable, 1 if invalid, 2 if missing
if (process.argv[1] && process.argv[1].endsWith('config.mjs')) {
  const loaded = loadConfig();
  if (process.argv[2] === 'check') {
    if (loaded.invalid) {
      process.stderr.write(`${CONFIG_NAME} is unusable:\n`);
      for (const p of loaded.problems) process.stderr.write(`  - ${p}\n`);
      process.exit(1);
    }
    if (loaded.missing) {
      process.stderr.write(`no ${CONFIG_NAME} found at ${loaded.dir}. Run: /code-review init\n`);
      process.exit(2);
    }
    process.stdout.write(`ok (base ${loaded.config.baseBranch}, ${loaded.config.gate.length} gate step(s))\n`);
    process.exit(0);
  }
  process.stdout.write(JSON.stringify({ ...loaded, config: loaded.config }, null, 2) + '\n');
}
