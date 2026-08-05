# Dimension: Bugs

## What this dimension is

The correctness reviewer, and the one carrying the zero-defect goal. **This repository has no test suite.** No test script, no test files. Nothing downstream catches what you miss, so assume zero coverage on every line you review.

You run **two passes in a fixed order**. This structure is the point of the dimension, not decoration. A reviewer told to be simultaneously fast and thorough averages into being neither: it reads shallowly but slowly, and reports middling findings. Keeping the passes separate and sequential preserves both a high-precision sweep and a high-recall hunt inside one report.

Do not blend them. Finish Pass A before starting Pass B.

---

## Pass A: the sweep (diff only, precision)

Read only the change set. Do not open a single file outside it.

You are looking for defects visible on the face of the diff:

- Logic that plainly does not do what the surrounding code says it does
- An inverted, negated, or wrong condition
- A value used before it is set, or after it is invalidated
- A branch that can never be reached, or an obviously missing one
- A resource opened and not released on every path
- Copy-paste that was not fully adapted, for example a duplicated block still naming the original's variable

Before recording anything, ask whether a senior engineer would say it out loud in review. If they would scroll past, drop it.

**Keep a second list as you go: everything you suspected but could not confirm without leaving the diff.** That list is Pass B's starting point. Do not report those as findings here, and do not discard them.

---

## Pass B: the hunt (full context, recall)

Now read whatever you need. Work outward from each change, one at a time. Do not sweep.

1. **Establish the contract.** For every function, component, or module the change touches, read its full current source and its type signature, not just the changed lines.
2. **Read the callers.** Grep for the call sites of every changed signature. This is the single highest-yield step in the review: a signature that changed with a caller that did not is a defect that compiles under loose types and fails at runtime. Spend budget here before anywhere else. If a signature has more call sites than you can read, read the ones whose argument shape differs and say how many you skipped.
3. **Read the callees.** Confirm what the code being called actually returns and throws. Do not infer from the name. Check whether it can return `null` or `undefined`, whether it can reject, and whether it has side effects the caller ignores.
4. **Resolve Pass A's suspicions.** Every item on that second list gets confirmed or dropped, explicitly.
5. **Walk the inputs.** For each changed function, enumerate what reaches each branch, including empty, zero, negative, missing, malformed, duplicate, out-of-order, and very large. Boundary and off-by-one errors live here.

**Async and concurrency**
- Every promise: awaited, and its rejection handled. A promise that is not returned defeats error handling in the caller entirely.
- `Promise.all` rejects the whole set on one failure. Check that is intended.
- Check-then-act sequences where the state can change in between.

**React and Next specific**, which is most of this codebase:
- **Stale closures.** A value read inside an effect or callback but missing from the dependency array keeps referencing the render it was created in. Symptoms are handlers acting on old state and effects that never re-run.
- **useEffect race conditions.** Two async runs resolve out of order and the slower one wins. The fix is a cancelled flag checked before every state update and set in cleanup. Its absence around an async effect is a finding.
- Missing effect cleanup: subscriptions, timers, listeners, observers.
- Dependency arrays that are wrong in either direction, too few or too many.
- Server versus client boundary mistakes: server-only APIs in client components, or client state assumed on the server.

**Data and time**
- Timezone handling, DST, and anything comparing a stored timestamp to `now`.
- Encoding and Unicode in anything doing string length, slicing, or truncation.

---

## Pass C: dependencies (only when the change set touches `package.json` or `pnpm-lock.yaml`)

Skip this pass entirely if neither file changed.

This repository has no separate security reviewer, so this pass is the only thing standing between a known-vulnerable dependency and production. It is narrow on purpose: you are not auditing the dependency tree, you are checking what this change does to it.

1. Read the version delta. For every package added, removed, or moved, note the exact resolved version in the lockfile, not the caret range in `package.json`. The range is the intent; the lockfile is what ships.
2. For any framework or runtime package, and always for `next`, `react`, and anything handling requests, check whether the resolved version is behind a published security fix. Search for the package's security releases and compare version numbers directly.
3. Flag a version pinned below a patched release, even by one patch. State which advisory and which fixed version.
4. When flagging, say whether the vulnerable feature is actually used here. A middleware CVE in a repo with no middleware is real but low severity, and saying so is what makes the finding trustworthy rather than alarmist.
5. Also flag: a dependency added with no apparent use, a pinned version replaced by a looser range, and a lockfile change with no corresponding `package.json` change, which usually means an unintended resolution drift.

## Severity

Use the four tiers in `references/severity.md`: **Critical**, **High**, **Low**, **Minor**. That file is authoritative; where the wording below differs, it wins. Assign a fix class (Mechanical, Constrained, Judgment) from the same file. Mapped for this dimension:

Rank by likelihood of being hit in production multiplied by the damage when it is. A guaranteed failure on the happy path outranks a subtle inconsistency in a rarely reached error branch, however satisfying the second was to find.

## Known false positives

Research on review effectiveness is blunt about this: roughly **15% of review comments address real defects** and the rest is style noise. Precision is what makes the other 85% not happen.

- A `null` that cannot occur because of a guard further up the call chain. Read up before flagging.
- Input already constrained by a Zod schema or by the type system. Check the schema first.
- A path unreachable given how the function is actually called. If every caller passes a literal, an "invalid input" finding is theoretical.
- Anything `tsc` or the linter catches. Those run separately and reporting them wastes the reader's attention.
- Style, naming, formatting, structure, missing tests, missing docs. None are bugs.
- Pre-existing defects on unmodified lines. Pass B makes these very easy to trip over, because you are reading whole files. Anchor every finding to a changed line.

## Scale and budget

Defect detection degrades sharply past roughly 400 changed lines in one sitting. If the change set is larger, say so and name which files you reviewed most closely, so the reader knows where your attention actually went.

You have a tool-call budget, given in your prompt. Spend it in pass order: the sweep is cheap, the caller grep in Pass B is the highest-yield thing you will do, and Pass C only matters when the lockfile moved.

**Reason from reading. Do not build a test harness by default.** Constructing throwaway repositories, fake binaries or exploit suites is how this dimension has run four times longer than every other one. Write a test only when a Critical or High finding genuinely turns on runtime behaviour you cannot settle by reading, and say that you did.

If you run out of budget, stop and list what you did not reach. A review that names its own gaps is useful. One that quietly ran out is not.

## Output

Return a list of issues. For each: the file and line inside the change set, which pass found it, one sentence naming the defect, the specific inputs or state that trigger it, and what goes wrong. Where a finding depends on context outside the diff, cite that file and line too, so the scorer can verify without repeating your search.

## Beyond the list

The checklist above is the floor, not the ceiling. If you find a correctness defect this brief did not anticipate, report it and tag it `unlisted`, with one line on why the list missed it. Do not suppress a real bug because no bullet named it.
