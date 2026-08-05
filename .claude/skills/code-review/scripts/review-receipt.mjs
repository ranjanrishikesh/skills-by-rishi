#!/usr/bin/env node
// The code-review receipt.
//
// A receipt records that /code-review reviewed an exact change set and applied
// its own fixes to what it found. The publish gate reads it so a review is
// never demanded twice for the same code, and never skipped for code that has
// changed since it was reviewed.
//
// The receipt is keyed on a hash of the exact review scope, NOT on the HEAD
// SHA. The review deliberately covers uncommitted working-tree changes, so a
// SHA-keyed receipt would let you edit a file after review and still push
// clean.
//
// What moves the hash: editing a file in the change set, adding a new one,
// deleting one, or a base that resolves to a different merge-base commit.
//
// What deliberately does NOT move it: staging, committing, or amending. Those
// change where the bytes live, not what they are, and content is read from the
// working tree. Re-reviewing identical bytes is pure waste. By the same token,
// reverting an edit restores a receipt rather than demanding a fresh run.
//
// The receipt lives under .git/, so it can never be committed or shared
// between clones. It is local proof about local state.
//
// INCREMENTAL REVIEW.
//
// The receipt also carries a ledger of every commit SHA a review has covered.
// That ledger answers a different question from the hash, and the two are
// deliberately not the same check:
//
//   `check`  asks "is the code about to be pushed reviewed?"  -> the hash.
//   `scope`  asks "how much of it still needs reviewing?"     -> the ledger.
//
// Without the ledger, editing one byte after reviewing five commits sends the
// whole branch back through the expensive half of the review, because the hash
// is all-or-nothing by construction. With it, the reviewer diffs from the
// parent of the earliest UNREVIEWED commit instead of from the merge base, so
// five reviewed commits cost nothing on the sixth run.
//
// The hash stays the gate on its own. A commit SHA is immutable, so a reviewed
// SHA is permanently reviewed, but an uncommitted edit has no SHA to record and
// the ledger cannot see it. The hash can, which is why the gate keeps asking
// the hash and only the hash.
//
// What the ledger gives up, stated plainly: a reviewer that only reads commit
// six cannot judge how commit six interacts with commit three. The
// deterministic gate still runs over the whole tree every time, so structural
// breakage is still caught globally; what narrows is human-style judgment about
// cross-commit interaction. `scope --full` puts the whole branch back in range
// when that is the thing being looked for.
//
// CONTAINER MODE.
//
// `stamp --container` records a review that ran everywhere EXCEPT the
// browser-driven dimensions, which need Chrome DevTools and cannot run in a
// container that has no attachable browser. It allows a publish, exactly like a
// normal receipt, and marks itself so the audit trail says what was not looked
// at. That marking is the whole point: a container receipt that was
// indistinguishable from a full one would quietly mean "reviewed" while nothing
// had rendered the change in a browser, on every run, forever. Same reasoning as
// the waiver below, one notch less severe.
//
// Usage:
//   node review-receipt.mjs hash    prints the current scope hash
//   node review-receipt.mjs scope   prints JSON: what still needs reviewing
//   node review-receipt.mjs check   exit 0 if a valid receipt exists, else 1
//   node review-receipt.mjs stamp   writes a receipt for the current scope
//                                   --container marks the browser dimensions skipped
//   node review-receipt.mjs waive   records an explicit user waiver (NOT a review)
//   node review-receipt.mjs clear   removes the receipt
//
// stamp is only ever called by the /code-review skill, after it has reviewed
// the scope AND applied its fixes. The receipt attests "reviewed, and what was
// found was fixed", not "was clean on first read". Stamping a scope that was
// never reviewed is the one thing this must never do.

import { readFileSync, writeFileSync, existsSync, rmSync, lstatSync, readlinkSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { loadConfig, projectRoot } from './config.mjs';

const projectDir = projectRoot();

// Read once. Every default below resolves through here rather than naming a
// branch, so a repo on master, trunk or develop needs no edit to this file.
//
// A missing config is deliberately fine here and returns detected defaults.
// This script has to work before `init` has ever run, or nothing could
// bootstrap a repository in the first place. publish-checks.mjs makes the
// opposite call for the opposite reason, and both are correct: more review is
// the safe direction to fail, and allowing an unreviewed push is not.
const { config } = loadConfig(projectDir);

/**
 * The branch a review is measured against, when a caller does not name one.
 *
 * A function rather than a constant because it is used as a default parameter
 * value, which JavaScript evaluates at call time. That keeps every entry point
 * agreeing on one answer without any of them hardcoding it.
 */
function defaultBase() {
  return config.baseBranch;
}

function sh(cmd) {
  try {
    return execSync(cmd, {
      cwd: projectDir,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      maxBuffer: 64 * 1024 * 1024,
    });
  } catch { return ''; }
}

function gitDir() {
  const d = sh('git rev-parse --absolute-git-dir').trim();
  return d || path.join(projectDir, '.git');
}

export function receiptPath() {
  // Named from config so two skills, or a fork of this one, can coexist in one
  // clone without silently reading each other's receipts. Still under .git/,
  // which is the load-bearing part: a receipt is local proof about local state
  // and must never be committable or shareable between clones.
  return path.join(gitDir(), config.receiptName);
}

/**
 * Compute a hash of the exact review scope, matching step 1 of the
 * code-review skill: the tracked diff against the merge base (which covers
 * commits on this branch plus staged plus unstaged), plus the full content of
 * every untracked file.
 *
 * Returns { hash, base, branch } or { error } when git state is unusual.
 */
export function computeScope(baseRef = defaultBase()) {
  const base = sh(`git merge-base ${baseRef} HEAD`).trim();
  if (!base) return { error: `could not resolve merge-base against ${baseRef}` };

  const branch = sh('git rev-parse --abbrev-ref HEAD').trim();

  // Hash the CONTENT of every path in the change set, read from the working
  // tree, rather than hashing diff text plus untracked files in separate
  // buckets.
  //
  // The two-bucket approach had a guaranteed-failure bug: a new file hashed as
  // untracked content, then vanished from `ls-files --others` and reappeared
  // inside the diff text the moment it was staged. Same bytes, different hash.
  // So `git add` alone, with no edit at all, killed a valid receipt and forced
  // a full re-review before every push, which is the exact waste the receipt
  // exists to prevent.
  //
  // Reading content from the working tree is invariant across the
  // untracked -> staged -> committed transitions, because none of them change
  // what is on disk. Only a real edit moves the hash.
  // --no-renames matters: with rename detection on, an unstaged move reports
  // the old path (deleted) plus the new one as untracked, but a STAGED move
  // reports only the destination. Same bytes, different path set, different
  // hash, so staging a rename killed a valid receipt. This change set
  // contains three such renames.
  const changed = sh(`git diff --name-only --no-renames ${base}`)
    .split('\n').map((x) => x.trim()).filter(Boolean);
  const untracked = sh('git ls-files --others --exclude-standard')
    .split('\n').map((x) => x.trim()).filter(Boolean);
  const paths = [...new Set([...changed, ...untracked])].sort();

  const h = createHash('sha256');
  h.update('base\0' + base + '\0');
  // baseRef is deliberately NOT hashed. The resolved merge-base SHA above
  // already distinguishes different bases, so hashing the ref *label* adds no
  // safety and creates an unescapable block: reviewing against `main` stamps
  // the label `main` while the gate always checks the configured base, so the
  // hashes never match and re-running the review never terminates.
  for (const rel of paths) {
    h.update('path\0' + rel + '\0');
    const abs = path.join(projectDir, rel);
    try {
      const st = lstatSync(abs);
      if (st.isSymbolicLink()) {
        // Hash the link target, not the file it points at. readFileSync
        // dereferences, so retargeting a symlink between two files with
        // identical content was invisible even though git sees a real change.
        h.update('symlink\0' + readlinkSync(abs) + '\0');
      } else {
        // The executable bit is part of what git tracks, so a chmod on a file
        // already in the change set has to move the hash. Content alone missed it.
        h.update('mode\0' + ((st.mode & 0o111) ? 'x' : '-') + '\0');
        h.update('bytes\0');
        h.update(readFileSync(abs));
      }
    } catch { h.update('absent\0'); }   // deleted in the working tree
    h.update('\0');
  }

  return { hash: h.digest('hex'), base, baseRef, branch, fileCount: paths.length };
}

function readReceipt() {
  const p = receiptPath();
  if (!existsSync(p)) return null;
  try { return JSON.parse(readFileSync(p, 'utf8')); }
  catch (err) {
    // Absent and corrupt both end up as null here, and both correctly force a
    // full review, but they are not the same thing to a reader. Silently
    // discarding a ledger reports "nothing has been reviewed yet" when the truth
    // is that the history was lost. Say so. `checkReceipt` treats the same file
    // as a hard error, which is right for the push gate and wrong here, where
    // more review is the safe direction.
    process.stderr.write(`[review-receipt] ledger unreadable, treating as empty: ${err.message}\n`);
    return null;
  }
}

/**
 * What still needs reviewing, given what has already been reviewed.
 *
 * Returns the SHA to diff FROM, which is the parent of the earliest unreviewed
 * commit rather than each unreviewed commit in turn. Reviewing commit six and
 * then commit seven separately hides a defect that exists only because both
 * landed; one diff across the whole unreviewed span does not.
 */
export function computeReviewScope(baseRef = defaultBase(), { full = false } = {}) {
  const base = sh(`git merge-base ${baseRef} HEAD`).trim();
  if (!base) return { error: `could not resolve merge-base against ${baseRef}` };

  // Oldest first, so the earliest unreviewed commit is the first one that misses.
  const commits = sh(`git rev-list --reverse ${base}..HEAD`)
    .split('\n').map((x) => x.trim()).filter(Boolean);

  const receipt = readReceipt();
  const ledger = (receipt && !receipt.waived && receipt.reviewedCommits) || {};
  const reviewed = full ? [] : commits.filter((c) => ledger[c]);
  const unreviewed = full ? commits : commits.filter((c) => !ledger[c]);

  const dirty = sh('git status --porcelain').trim().length > 0;

  // Diff from the parent of the earliest unreviewed commit. When every commit is
  // reviewed there is nothing committed left to look at, so the floor is HEAD and
  // only the working tree remains in range.
  let reviewFrom = base;
  if (!full && unreviewed.length) {
    // A root commit has no parent; the merge base is the correct floor there
    // rather than an error.
    reviewFrom = sh(`git rev-parse ${unreviewed[0]}^`).trim() || base;
  } else if (!full && !unreviewed.length) {
    reviewFrom = sh('git rev-parse HEAD').trim() || base;
  }

  const scope = computeScope(baseRef);
  // `!receipt.waived` matters as much here as it does on the ledger above, and
  // for a worse reason. A waiver stores the same scopeHash shape as a review, so
  // without this guard an unedited waived scope reports mode 'none' with the
  // reason "no bytes have changed since the last review". Nothing was reviewed.
  // The skill treats mode as authoritative and stops, so asking for a review
  // after waiving one would silently do nothing at all.
  const hashMatches =
    !scope.error && receipt && !receipt.waived && receipt.scopeHash === scope.hash;

  // Order matters. `full` wins over everything, because it is an explicit
  // request to look at the whole branch again and an early 'none' would silently
  // refuse it. The hash is checked next: identical bytes are identical bytes,
  // however the commits around them have been rearranged.
  let mode;
  let reason;
  if (full) {
    mode = 'full';
    reason = 'full review requested, the ledger was ignored';
    reviewFrom = base;
  } else if (hashMatches) {
    mode = 'none';
    // Reached after a message-only amend or a rebase that moved no bytes: the
    // SHAs are strangers to the ledger while the content is the same code that
    // was already read. `mode` is authoritative, `unreviewedCommits` is not.
    reason = unreviewed.length
      ? 'no bytes have changed since the last review, only commit SHAs'
      : 'no bytes have changed since the last review';
  } else if (reviewed.length) {
    mode = 'incremental';
    reason = unreviewed.length
      ? `${reviewed.length} commit(s) already reviewed, ${unreviewed.length} to go plus any working-tree changes`
      : `${reviewed.length} commit(s) already reviewed, only working-tree changes remain`;
  } else {
    mode = 'full';
    reason = 'nothing on this branch has been reviewed yet';
  }

  return {
    mode,
    reason,
    base,
    reviewFrom,
    dirty,
    reviewedCommits: reviewed,
    unreviewedCommits: unreviewed,
    totalCommits: commits.length,
    branch: sh('git rev-parse --abbrev-ref HEAD').trim(),
  };
}

/**
 * The value of `mode` on a container receipt. A constant rather than a literal
 * at each end because `stamp` writes it and `checkReceipt` reads it, and a
 * mismatch between the two does not fail: `checkReceipt` falls through to the
 * normal-receipt return, and both gates then report a container review as a
 * full one with nothing skipped. That is the exact silent fail-open this whole
 * file is written to refuse.
 */
export const CONTAINER_MODE = 'container';

/**
 * What container mode does not look at. Single-sourced here so the receipt and
 * the publish warning cannot drift into describing different things.
 *
 * It does NOT reach the prose. SKILL.md and references/rubric.md name these same
 * two dimensions in hand-written markdown with no mechanical link to this array,
 * so renaming a dimension or adding a third browser-driven one updates the code
 * paths and leaves that prose stale. Keep them in sync by hand.
 */
export const CONTAINER_SKIPS = [
  'Interface (all passes)',
  'Discoverability Pass C (Lighthouse)',
];

/**
 * { ok: true } when a receipt exists and matches the current scope.
 * { ok: false, reason } otherwise. { ok: null, reason } when git state is
 * unusual and no judgment can be made (callers should fail open on this).
 */
export function checkReceipt(baseRef = defaultBase()) {
  const scope = computeScope(baseRef);
  if (scope.error) return { ok: null, reason: scope.error };

  const p = receiptPath();
  if (!existsSync(p)) return { ok: false, reason: 'no code review has been run for this change set' };

  let receipt;
  try { receipt = JSON.parse(readFileSync(p, 'utf8')); }
  catch { return { ok: false, reason: 'the review receipt is unreadable' }; }

  if (receipt.scopeHash !== scope.hash) {
    return {
      ok: false,
      reason: `the code has changed since the last review (reviewed ${receipt.reviewedAt || 'unknown'})`,
      staleSince: receipt.reviewedAt,
    };
  }
  if (receipt.waived) {
    return { ok: true, waived: true, receipt, scope };
  }
  // Container mode allows the publish and says what nobody looked at. Read the
  // skip list off the receipt rather than off CONTAINER_SKIPS: the receipt
  // records what was actually skipped at the time it was written, and this
  // constant can change afterwards.
  if (receipt.mode === CONTAINER_MODE) {
    return {
      ok: true,
      container: true,
      containerSkips: receipt.skippedDimensions || CONTAINER_SKIPS,
      receipt,
      scope,
    };
  }
  return { ok: true, receipt, scope };
}

function stamp(baseRef, { container = false } = {}) {
  const scope = computeScope(baseRef);
  if (scope.error) {
    process.stderr.write(`[review-receipt] cannot stamp: ${scope.error}\n`);
    process.exit(1);
  }
  const now = new Date().toISOString();
  const commits = sh(`git rev-list ${scope.base}..HEAD`)
    .split('\n').map((x) => x.trim()).filter(Boolean);

  // Carry the existing ledger forward. Overwriting it would erase the record of
  // every earlier run, so the very next edit would send all of them back through
  // a full review, which is the waste this ledger exists to stop.
  //
  // Only commits still reachable from HEAD are kept. A rebase or an amend gives
  // the same work a new SHA, and the old one describes code that is no longer on
  // this branch: keeping it grows the file forever and can never match anything
  // again. The new SHA is absent from the ledger, so rewritten history is
  // re-reviewed, which is the safe direction to fail.
  const prev = readReceipt();
  const carried = (prev && !prev.waived && prev.reviewedCommits) || {};
  const reviewedCommits = {};
  for (const c of commits) reviewedCommits[c] = carried[c] || now;
  const added = commits.filter((c) => !carried[c]).length;

  const receipt = {
    scopeHash: scope.hash,
    base: scope.base,
    baseRef: scope.baseRef,
    branch: scope.branch,
    head: sh('git rev-parse HEAD').trim(),
    fileCount: scope.fileCount,
    reviewedCommits,
    reviewedAt: now,
    // Present only in container mode. A full run stays byte-identical to what it
    // wrote before this flag existed, so an absent `mode` still means "everything
    // ran" and no existing receipt has to be migrated or re-interpreted.
    ...(container ? { mode: CONTAINER_MODE, skippedDimensions: CONTAINER_SKIPS } : {}),
    note: container
      ? 'Written by /code-review in CONTAINER MODE. Every dimension ran and its findings were fixed EXCEPT those in skippedDimensions, which need Chrome DevTools. Nothing rendered this change in a browser.'
      : 'Written by /code-review after a run whose findings were reviewed and fixed in the same pass.',
  };
  writeFileSync(receiptPath(), JSON.stringify(receipt, null, 2) + '\n');
  process.stdout.write(
    `stamped${container ? ' (CONTAINER MODE)' : ''} ${scope.hash.slice(0, 12)} (branch ${scope.branch}), ` +
      `${commits.length} commit${commits.length === 1 ? '' : 's'} reviewed` +
      `${added ? `, ${added} newly` : ''}\n`,
  );
  if (container) {
    process.stdout.write(`  not looked at: ${CONTAINER_SKIPS.join('; ')}\n`);
  }
}

const cmd = process.argv[2];
// Find the ref wherever it sits rather than demanding position 3, so a flag may
// precede it. Two real failures came from taking argv[3] literally: `scope
// --full main` silently fell back to the default base, a plausible-looking
// wrong answer rather than an error, and `stamp --container` read the flag as a
// base ref and died on an unresolvable merge-base. Git refuses to name a ref
// with a leading `--`, so skipping flag-shaped tokens can never skip a real one.
// `waive` does NOT use this: its argv[3] is the reason, which may look like
// anything at all.
const baseArg = process.argv.slice(3).find((a) => !a.startsWith('--')) || defaultBase();

if (cmd === 'hash') {
  const s = computeScope(baseArg);
  if (s.error) { process.stderr.write(s.error + '\n'); process.exit(1); }
  process.stdout.write(s.hash + '\n');
} else if (cmd === 'scope') {
  // `--full` is the escape hatch: it ignores the ledger and puts the whole
  // branch back in range, for when cross-commit interaction is the thing being
  // looked for and an incremental diff would hide it.
  const full = process.argv.includes('--full');
  const s = computeReviewScope(baseArg, { full });
  if (s.error) { process.stderr.write(s.error + '\n'); process.exit(1); }
  process.stdout.write(JSON.stringify(s, null, 2) + '\n');
} else if (cmd === 'check') {
  const r = checkReceipt(baseArg);
  if (r.ok === true) { process.stdout.write('valid\n'); process.exit(0); }
  process.stdout.write(`invalid: ${r.reason}\n`);
  process.exit(1);
} else if (cmd === 'stamp') {
  // `--container` records that the browser-driven dimensions could not run here.
  // It still allows a publish; it just refuses to let the receipt claim they were
  // looked at. See CONTAINER MODE at the top of this file.
  stamp(baseArg, { container: process.argv.includes('--container') });
} else if (cmd === 'waive') {
  // NOTE the argument shape: `waive` takes the REASON as argv[3] and an
  // optional base ref as argv[4]. Every other subcommand takes the base ref as
  // argv[3]. Reusing argv[3] for both made the reason get parsed as a ref.
  const waiveBase = process.argv[4] || defaultBase();
  // Explicit user waiver. Deliberately NOT the same shape as a clean receipt:
  // it records that review was skipped on request, so a waived publish can
  // never be mistaken later for a reviewed one.
  const scope = computeScope(waiveBase);
  if (scope.error) {
    process.stderr.write(`[review-receipt] cannot waive: ${scope.error}\n`);
    process.exit(1);
  }
  writeFileSync(receiptPath(), JSON.stringify({
    scopeHash: scope.hash,
    base: scope.base,
    branch: scope.branch,
    head: sh('git rev-parse HEAD').trim(),
    fileCount: scope.fileCount,
    waived: true,
    waivedAt: new Date().toISOString(),
    reason: process.argv[3] || 'user asked to skip code review and merge',
    note: 'REVIEW WAIVED at explicit user request. This change set was NOT reviewed.',
  }, null, 2) + '\n');
  process.stdout.write(`WAIVED ${scope.hash.slice(0, 12)}: review skipped at user request, change set is unreviewed\n`);
} else if (cmd === 'clear') {
  const p = receiptPath();
  if (existsSync(p)) rmSync(p);
  process.stdout.write('cleared\n');
} else if (cmd) {
  process.stderr.write('usage: review-receipt.mjs hash|check|clear [baseRef] | stamp [baseRef] [--container] | scope [baseRef] [--full] | waive <reason> [baseRef]\n');
  process.exit(2);
}
