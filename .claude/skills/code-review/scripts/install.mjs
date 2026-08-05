#!/usr/bin/env node
// Install the code-review skill into whatever repository it finds itself in.
//
//   node install.mjs                detect, write review.config.json, arm hooks
//   node install.mjs --dry-run      print what it would do, change nothing
//   node install.mjs --no-hooks     config only, no enforcement
//   node install.mjs --force        overwrite an existing config
//   node install.mjs --uninstall    remove the hooks it installed
//
// THE TWO RULES THIS FILE EXISTS TO OBEY
//
// 1. VERIFY BEFORE ARMING. The publish gate fails closed by design, which is
//    correct once it is configured and catastrophic before. Arming a gate whose
//    base branch does not resolve blocks every push in the repository, with an
//    error that reads like a fetch problem. So the base ref is resolved and the
//    gate runners are probed BEFORE any hook is written, and a failure here
//    stops the install rather than producing a broken one.
//
// 2. NEVER CLAIM core.hooksPath. Git allows exactly one hooks directory per
//    repository. husky and lefthook both take it. Setting it to ours would
//    silently disable every hook the repo already had, which is a far worse
//    outcome than not installing at all. So: detect what owns the path, and
//    chain into the existing pre-push instead of replacing it.
//
// WHAT DETECTION MAY AND MAY NOT DO
//
// It proposes; it never silently decides. Gate commands in particular are
// unguessable: `npm test` is three seconds in one repo and a twenty-minute
// integration suite needing a live database in another. Detection writes its
// best reading into the config and prints every line of it, so the first thing
// anyone does is read and correct it. What it must never do is invent a gate
// step that quietly does nothing, because a step that does nothing still
// reports as passing.

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, chmodSync, cpSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { CONFIG_NAME, DEFAULTS, detectBaseBranch, projectRoot, validate } from './config.mjs';

const SOURCE_SKILL = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const MARK_START = '# >>> code-review publish gate >>>';
const MARK_END = '# <<< code-review publish gate <<<';
const VENDOR_AT = '.claude/skills/code-review';

const argv = process.argv.slice(2);
const DRY = argv.includes('--dry-run');
const NO_HOOKS = argv.includes('--no-hooks');
const FORCE = argv.includes('--force');
const UNINSTALL = argv.includes('--uninstall');
const NO_VENDOR = argv.includes('--no-vendor');

const dir = projectRoot();

/**
 * Where the skill lives RELATIVE TO THE REPOSITORY BEING INSTALLED INTO, which
 * is not always where this script is running from.
 *
 * The normal way to install is to run this file straight out of the skills
 * repository, against some other project. That means the skill starts outside
 * the target, and a hook written with a relative path back to it comes out as
 * `../../../../Users/someone/skills/...`, which breaks the moment either
 * repository moves and is meaningless on anybody else's machine.
 *
 * So the default is to vendor: copy the skill into the target repository first,
 * then install against the copy. The skill becomes part of the repo, travels
 * with it, and is reviewable in its own diff. Caught by installing from an
 * out-of-tree checkout and reading the hook that came out.
 */
let SKILL_ABS = SOURCE_SKILL;
let skillRel = path.relative(dir, SKILL_ABS) || '.';
const isExternal = skillRel.startsWith('..') || path.isAbsolute(skillRel);

const notes = [];
const warns = [];
const say = (s) => process.stdout.write(s + '\n');

function sh(cmd) {
  try { return execSync(cmd, { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }); }
  catch { return ''; }
}
function ok(cmd) {
  try { execSync(cmd, { cwd: dir, stdio: 'ignore' }); return true; }
  catch { return false; }
}
const has = (p) => existsSync(path.join(dir, p));
function readJson(p) {
  try { return JSON.parse(readFileSync(path.join(dir, p), 'utf8')); } catch { return null; }
}
function write(rel, body, mode) {
  if (DRY) { say(`  would write ${rel}`); return; }
  const abs = path.join(dir, rel);
  mkdirSync(path.dirname(abs), { recursive: true });
  writeFileSync(abs, body);
  if (mode) chmodSync(abs, mode);
  say(`  wrote ${rel}`);
}

// ---------------------------------------------------------------------------
// Detection
// ---------------------------------------------------------------------------

/** Which package manager, from the lockfile that is actually present. */
function detectPackageManager() {
  if (has('pnpm-lock.yaml')) return 'pnpm';
  if (has('bun.lockb') || has('bun.lock')) return 'bun';
  if (has('yarn.lock')) return 'yarn';
  if (has('package-lock.json')) return 'npm';
  if (has('package.json')) return 'npm';
  return null;
}

/**
 * Gate steps, in cheapest-first order.
 *
 * Only script names the repo actually declares become steps. A guessed step
 * that does not exist would fail on every run and be indistinguishable from a
 * real failure, so the roster is derived from package.json rather than from a
 * list of names that are usually right.
 */
function detectGate() {
  const steps = [];
  const pkg = readJson('package.json');

  if (pkg && pkg.scripts) {
    const pm = detectPackageManager();
    const run = (s) => (pm === 'npm' ? `npm run ${s}` : `${pm} run ${s}`);
    // Order is deliberate and is the one thing detection does opinionate on:
    // a type error must not cost a full build. Anything reading build output
    // is marked needsBuild so the skill keeps it after the build step.
    const order = [
      ['typecheck', false], ['type-check', false], ['tsc', false],
      ['lint', false],
      ['build', false],
      ['test', true], ['test:unit', true],
    ];
    for (const [name, needsBuild] of order) {
      if (pkg.scripts[name]) steps.push({ name, run: run(name), blocking: true, needsBuild });
    }
    return { steps, kind: 'node', pm };
  }

  if (has('Cargo.toml')) {
    return { kind: 'rust', pm: 'cargo', steps: [
      { name: 'check', run: 'cargo check', blocking: true, needsBuild: false },
      { name: 'clippy', run: 'cargo clippy -- -D warnings', blocking: true, needsBuild: false },
      { name: 'test', run: 'cargo test', blocking: true, needsBuild: false },
    ] };
  }
  if (has('go.mod')) {
    return { kind: 'go', pm: 'go', steps: [
      { name: 'vet', run: 'go vet ./...', blocking: true, needsBuild: false },
      { name: 'build', run: 'go build ./...', blocking: true, needsBuild: false },
      { name: 'test', run: 'go test ./...', blocking: true, needsBuild: false },
    ] };
  }
  if (has('pyproject.toml') || has('setup.py') || has('requirements.txt')) {
    // Probed rather than assumed: a Python repo that has neither ruff nor mypy
    // installed would otherwise get two gate steps that fail on every run.
    const steps = [];
    if (ok('ruff --version')) steps.push({ name: 'lint', run: 'ruff check .', blocking: true, needsBuild: false });
    if (ok('mypy --version')) steps.push({ name: 'typecheck', run: 'mypy .', blocking: true, needsBuild: false });
    if (ok('pytest --version')) steps.push({ name: 'test', run: 'pytest -q', blocking: true, needsBuild: false });
    return { kind: 'python', pm: 'python', steps };
  }

  return { kind: 'generic', pm: null, steps: [] };
}

/** Does this repo render pages a browser could load? Decides the web dimensions. */
function detectWeb() {
  const pkg = readJson('package.json');
  const deps = pkg ? { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) } : {};
  const frameworks = ['next', 'astro', 'nuxt', '@remix-run/react', 'vite', '@sveltejs/kit', 'gatsby'];
  const found = frameworks.filter((f) => f in deps);
  const configs = ['next.config.js', 'next.config.mjs', 'next.config.ts', 'astro.config.mjs', 'nuxt.config.ts', 'vite.config.ts', 'vite.config.js']
    .filter(has);
  return { isWeb: found.length > 0 || configs.length > 0 || has('index.html'), found, configs };
}

/** The dev server, needed by the Interface dimension. */
function detectDev(gate) {
  const pkg = readJson('package.json');
  if (!pkg || !pkg.scripts) return null;
  const name = ['dev', 'start', 'serve'].find((s) => pkg.scripts[s]);
  if (!name) return null;
  const pm = gate.pm || 'npm';
  return { run: pm === 'npm' ? `npm run ${name}` : `${pm} run ${name}`, url: 'http://localhost:3000' };
}

/**
 * Path classes, from directories that exist.
 *
 * The version this was ported from hardcoded a Next.js App Router layout, so
 * every non-Next repo classified every file as TOOLING and the Bugs dimension
 * never ran on anything. Built from the tree instead.
 */
function detectClasses() {
  const classes = {};
  const add = (k, globs) => { const g = globs.filter((x) => has(x.split('/**')[0])); if (g.length) classes[k] = g; };
  add('UI-CODE', ['components/**', 'app/**/*.tsx', 'src/components/**', 'src/app/**/*.tsx', 'pages/**/*.tsx']);
  add('LOGIC', ['lib/**', 'src/**', 'internal/**', 'pkg/**', 'app/api/**']);
  add('CONTENT', ['content/**', 'posts/**', 'data/**']);
  add('TESTS', ['test/**', 'tests/**', '__tests__/**', 'spec/**']);
  add('CONFIG', ['tsconfig.json', 'next.config.*', 'pyproject.toml', 'Cargo.toml', 'go.mod']);
  add('TOOLING', ['docs/**', 'scripts/**', '.claude/**', '.github/**']);
  const deps = [];
  for (const f of ['package.json', 'pnpm-lock.yaml', 'package-lock.json', 'yarn.lock', 'Cargo.lock', 'go.sum', 'poetry.lock', 'requirements.txt']) {
    if (has(f)) deps.push(f);
  }
  if (deps.length) classes.DEPS = deps;
  return classes;
}

/** Every agent instruction file the repo carries, whichever agent wrote it. */
function detectInstructionFiles() {
  const candidates = ['CLAUDE.md', 'AGENTS.md', 'GEMINI.md', '.cursorrules', '.windsurfrules', '.github/copilot-instructions.md'];
  const found = candidates.filter(has);
  if (has('.cursor/rules')) {
    try {
      for (const f of readdirSync(path.join(dir, '.cursor/rules'))) found.push(`.cursor/rules/${f}`);
    } catch { /* unreadable directory is not a reason to fail the install */ }
  }
  return found;
}

// ---------------------------------------------------------------------------
// Verification, which runs BEFORE anything is armed
// ---------------------------------------------------------------------------

function verify(config, gate) {
  const problems = [];

  // The single most important check in this file. See rule 1 at the top.
  if (!sh(`git rev-parse --verify --quiet ${config.baseBranch}`).trim()) {
    problems.push(
      `base branch "${config.baseBranch}" does not resolve in this clone.\n` +
      `      Arming the gate now would block every push. Fetch it first:\n` +
      `        git fetch ${config.baseBranch.replace('/', ' ')}\n` +
      `      or set a different "baseBranch" in ${CONFIG_NAME}.`,
    );
  }

  // Probe the runner, not the build. Running the real gate here could take
  // minutes and is the skill's job, not the installer's. What this catches is
  // the common breakage: a config naming a package manager that is not on PATH.
  const runners = [...new Set(gate.steps.map((s) => s.run.split(/\s+/)[0]))];
  for (const r of runners) {
    if (!ok(`command -v ${r}`)) problems.push(`gate step runner "${r}" is not on PATH`);
  }

  const shape = validate(config);
  for (const p of shape) problems.push(`generated config is invalid, which is a bug in this installer: ${p}`);

  return problems;
}

// ---------------------------------------------------------------------------
// Hook installation
// ---------------------------------------------------------------------------

/** Where git will look for hooks, and who owns that decision. */
function resolveHookDir() {
  const configured = sh('git config --get core.hooksPath').trim();
  if (configured) {
    const abs = path.isAbsolute(configured) ? configured : path.join(dir, configured);
    return { dir: abs, rel: configured, owner: 'existing core.hooksPath', claimable: false };
  }
  const gitDir = sh('git rev-parse --absolute-git-dir').trim() || path.join(dir, '.git');
  const stock = path.join(gitDir, 'hooks');

  // Setting core.hooksPath orphans everything already in .git/hooks. That is
  // fine when the only things there are the .sample files git ships, and is a
  // silent breakage when it is not.
  let live = [];
  try {
    live = readdirSync(stock).filter((f) => !f.endsWith('.sample'));
  } catch { /* no hooks dir yet */ }

  if (live.length) {
    return { dir: stock, rel: path.relative(dir, stock), owner: `existing hooks in .git/hooks (${live.join(', ')})`, claimable: false };
  }
  return { dir: path.join(dir, '.githooks'), rel: '.githooks', owner: null, claimable: true };
}

/**
 * The shell that resolves the checks script.
 *
 * Repo-relative when the skill is vendored, which is the normal case and the
 * one that survives being cloned. Absolute only under --no-vendor, where
 * gluing the two together would produce `/repo//Users/...` and silently never
 * match, so the gate would fail open on every push.
 */
function checksExpr() {
  return path.isAbsolute(skillRel)
    ? `"${skillRel}/scripts/publish-checks.mjs"`
    : `"$(git rev-parse --show-toplevel)/${skillRel}/scripts/publish-checks.mjs"`;
}

function ourBlock() {
  return [
    MARK_START,
    '# Installed by the code-review skill. Edit via the installer, not by hand.',
    `CR_CHECKS=${checksExpr()}`,
    'if [ -f "$CR_CHECKS" ] && command -v node >/dev/null 2>&1; then',
    '  CLAUDE_PROJECT_DIR="$(git rev-parse --show-toplevel)" node "$CR_CHECKS" || exit 1',
    'fi',
    MARK_END,
  ].join('\n');
}

/**
 * Add our checks to an existing pre-push without breaking it.
 *
 * Two details matter and both were found by reading real hooks:
 *
 *  - Idempotence. Re-running the installer must replace our block, not stack a
 *    second copy, so the block is fenced by markers and matched on them.
 *  - A trailing `exit 0`. Very common at the foot of a hand-written hook, and
 *    anything appended after it never runs. Insert before it instead, which is
 *    why this does not simply concatenate.
 */
function chain(existing) {
  const block = ourBlock();
  if (existing.includes(MARK_START)) {
    const before = existing.slice(0, existing.indexOf(MARK_START));
    const afterIdx = existing.indexOf(MARK_END);
    const after = afterIdx === -1 ? '' : existing.slice(afterIdx + MARK_END.length);
    return before + block + after;
  }
  const lines = existing.replace(/\s+$/, '').split('\n');
  let insertAt = lines.length;
  for (let i = lines.length - 1; i >= 0; i--) {
    const t = lines[i].trim();
    if (t === '' || t.startsWith('#')) continue;
    if (/^exit\s+0$/.test(t)) insertAt = i;
    break;
  }
  lines.splice(insertAt, 0, '', block, '');
  return lines.join('\n') + '\n';
}

function installHooks() {
  const target = resolveHookDir();
  const hookPath = path.join(target.dir, 'pre-push');
  const hookRel = path.relative(dir, hookPath);

  if (target.claimable) {
    // Nothing owns the hooks path and nothing lives in .git/hooks, so take it.
    // .githooks is committable, which means the hook travels with the repo and
    // only `git config core.hooksPath .githooks` is needed per clone.
    let body = readFileSync(path.join(SOURCE_SKILL, 'templates/pre-push'), 'utf8');
    // Same absolute-versus-relative care as checksExpr(), for the same reason.
    body = path.isAbsolute(skillRel)
      ? body.replace('"$ROOT/__SKILL_DIR__/scripts/publish-checks.mjs"', `"${skillRel}/scripts/publish-checks.mjs"`)
      : body.replace('__SKILL_DIR__', skillRel);
    write(hookRel, body, 0o755);
    if (DRY) say(`  would run: git config core.hooksPath ${target.rel}`);
    else { sh(`git config core.hooksPath ${target.rel}`); say(`  set core.hooksPath = ${target.rel}`); }
    notes.push(`The hook lives in ${target.rel} and is committable. Every other clone needs one command: git config core.hooksPath ${target.rel}`);
    return;
  }

  // Something else owns the hooks directory. Chain, never claim.
  const existing = existsSync(hookPath) ? readFileSync(hookPath, 'utf8') : '#!/usr/bin/env bash\nset -uo pipefail\n';
  const merged = chain(existing);
  write(hookRel, merged, 0o755);
  warns.push(
    `core.hooksPath is owned by ${target.owner}, so the checks were CHAINED into ${hookRel} ` +
    `rather than replacing it. Nothing that was already installed was removed.`,
  );
  if (!existsSync(hookPath)) notes.push(`Created ${hookRel}, which did not exist.`);
}

/**
 * Register the advisory PreToolUse hook, for Claude Code only.
 *
 * Deliberately additive and deliberately skippable. This half is a convenience:
 * enforcement is the git hook, which is already installed by the time this
 * runs. On any other agent this file simply is not written and nothing is lost
 * except fast feedback and `gh pr create` coverage.
 */
function installPreToolUse() {
  const rel = '.claude/settings.json';
  const abs = path.join(dir, rel);
  const cmd = `node "$CLAUDE_PROJECT_DIR/${skillRel}/scripts/pretooluse-gate.mjs"`;

  let settings = {};
  if (existsSync(abs)) {
    try { settings = JSON.parse(readFileSync(abs, 'utf8')); }
    catch {
      // Never overwrite a file we could not parse. Someone's whole harness
      // configuration lives here.
      warns.push(`${rel} is not valid JSON, so the advisory PreToolUse hook was NOT registered. The git hook is installed and enforcement is unaffected.`);
      return;
    }
  }

  settings.hooks ||= {};
  settings.hooks.PreToolUse ||= [];
  const already = JSON.stringify(settings.hooks.PreToolUse).includes('pretooluse-gate.mjs');
  if (already) { say(`  ${rel} already registers the advisory hook`); return; }

  settings.hooks.PreToolUse.push({ matcher: 'Bash', hooks: [{ type: 'command', command: cmd }] });
  write(rel, JSON.stringify(settings, null, 2) + '\n');
}

function uninstall() {
  const target = resolveHookDir();
  const hookPath = path.join(target.dir, 'pre-push');
  if (existsSync(hookPath)) {
    const body = readFileSync(hookPath, 'utf8');
    if (body.includes(MARK_START)) {
      const before = body.slice(0, body.indexOf(MARK_START));
      const after = body.slice(body.indexOf(MARK_END) + MARK_END.length);
      write(path.relative(dir, hookPath), (before + after).replace(/\n{3,}/g, '\n\n'), 0o755);
      say('  removed the chained block; the rest of the hook was left alone');
    } else if (body.includes('publish-checks.mjs')) {
      say(`  ${path.relative(dir, hookPath)} is ours alone. Delete it by hand if you want it gone:`);
      say(`    rm ${path.relative(dir, hookPath)} && git config --unset core.hooksPath`);
    }
  }
  say('  review.config.json was left in place. Delete it by hand if you want it gone.');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

say(`code-review installer`);
say(`  repository: ${dir}`);
say('');

if (!sh('git rev-parse --git-dir').trim()) {
  process.stderr.write('This is not a git repository. The receipt, the scope and the gate are all defined in terms of git.\n');
  process.exit(1);
}

if (UNINSTALL) { say('Uninstalling:'); uninstall(); process.exit(0); }

// DECIDE where the skill will live, but do not copy anything yet.
//
// Every write in this script has to happen after verification, or the refusal
// message ("Nothing was written and no hook was armed") is a lie. Vendoring ran
// before the check in the first version and left a half-installed .claude/
// behind in a repo the installer had just told the user it had not touched.
// Splitting the decision from the copy is what keeps that message true.
if (isExternal && !NO_VENDOR) {
  SKILL_ABS = path.join(dir, VENDOR_AT);
  skillRel = VENDOR_AT;
} else if (isExternal && NO_VENDOR) {
  SKILL_ABS = SOURCE_SKILL;
  skillRel = SOURCE_SKILL;
  warns.push(
    `--no-vendor: the hook will reference an absolute path outside this repository (${SOURCE_SKILL}). ` +
    `That works on this machine only. Nobody else's clone, and no CI runner, will have a gate.`,
  );
}
say(`  skill: ${skillRel}${isExternal && !NO_VENDOR ? '  (will be vendored)' : ''}`);
say('');

/** Perform the copy decided above. Called only after verification passes. */
function vendor() {
  if (!isExternal || NO_VENDOR) return;
  const dest = path.join(dir, VENDOR_AT);
  say('Vendoring the skill into this repository:');
  if (existsSync(dest) && !FORCE) {
    say(`  ${VENDOR_AT} already exists. Left alone. Re-run with --force to refresh it.`);
  } else if (DRY) {
    say(`  would copy the skill to ${VENDOR_AT}`);
  } else {
    // Copy only what the skill IS, never dotfiles it may have accumulated.
    cpSync(SOURCE_SKILL, dest, {
      recursive: true,
      filter: (src) => !path.basename(src).startsWith('.'),
    });
    say(`  copied to ${VENDOR_AT}`);
  }
  notes.push(`The skill now lives at ${VENDOR_AT} inside this repository. Commit it: the hook, the config and the review all reference that path, so a clone without it has no gate.`);
}

const gate = detectGate();
const web = detectWeb();
const classes = detectClasses();
const instructionFiles = detectInstructionFiles();
const base = detectBaseBranch(dir);
const dev = detectDev(gate);

const config = {
  ...DEFAULTS,
  baseBranch: base,
  receiptName: DEFAULTS.receiptName,
  install: gate.pm && gate.kind === 'node' ? { run: `${gate.pm} install`, detect: 'node_modules' } : null,
  gate: gate.steps,
  classes,
  dimensions: {
    ...DEFAULTS.dimensions,
    discoverability: web.isWeb,
    interface: web.isWeb,
  },
  repoFacts: { ...DEFAULTS.repoFacts, instructionFiles },
  dev,
  publishGate: {
    // Enabled, but scanning nothing until someone names directories. The gate
    // still enforces the review receipt, which is the half that matters; the
    // tell scan is opt-in because a ruleset nobody chose would start blocking
    // pushes over punctuation on day one.
    enabled: true,
    scanDirs: [],
    scanExt: DEFAULTS.publishGate.scanExt,
    rules: `${skillRel}/templates/ai-tells-lint.json`,
  },
};

say('Detected:');
say(`  stack:        ${gate.kind}${gate.pm ? ` (${gate.pm})` : ''}`);
say(`  base branch:  ${base}`);
say(`  gate:         ${gate.steps.length ? gate.steps.map((s) => s.name).join(' -> ') : 'none found'}`);
say(`  web app:      ${web.isWeb ? `yes (${[...web.found, ...web.configs].join(', ')})` : 'no'}`);
say(`  classes:      ${Object.keys(classes).join(', ') || 'none'}`);
say(`  instructions: ${instructionFiles.join(', ') || 'none found'}`);
say('');

if (!gate.steps.length) {
  warns.push('No deterministic gate commands were found, so the review will run with no build gate. That is honest for this repo, but it means nothing catches a type error before the reviewers run. Add steps to "gate" in the config if the repo has them.');
}
if (!instructionFiles.length) {
  warns.push('No agent instruction file was found (CLAUDE.md, AGENTS.md and friends). The instructions-compliance dimension has nothing to enforce and will report that it did not apply.');
}

say('Verifying before arming anything:');
const problems = verify(config, gate);
if (problems.length) {
  say('');
  process.stderr.write('INSTALL STOPPED. Nothing was written and no hook was armed.\n\n');
  for (const p of problems) process.stderr.write(`  - ${p}\n`);
  process.stderr.write('\nThe gate fails closed once armed, so installing it on top of any of the above\n');
  process.stderr.write('would block every push in this repository. Fix and re-run.\n');
  process.exit(1);
}
say('  base branch resolves, gate runners are on PATH, generated config is valid');
say('');

// Everything below this line writes. Nothing above it does.
vendor();
say('');

const configPath = path.join(dir, CONFIG_NAME);
if (existsSync(configPath) && !FORCE) {
  say(`${CONFIG_NAME} already exists. Left alone. Re-run with --force to overwrite.`);
} else {
  say('Writing:');
  write(CONFIG_NAME, JSON.stringify(config, null, 2) + '\n');
}

if (!NO_HOOKS) {
  say('');
  say('Arming the publish gate:');
  installHooks();
  installPreToolUse();
} else {
  say('');
  say('Skipped hook installation (--no-hooks). The review skill works; nothing enforces it.');
}

if (notes.length) { say(''); say('Notes:'); for (const n of notes) say(`  - ${n}`); }
if (warns.length) { say(''); say('Read these:'); for (const w of warns) say(`  ! ${w}`); }

say('');
say(DRY ? 'Dry run. Nothing was changed.' : 'Done. Next: open review.config.json and correct the gate commands.');
