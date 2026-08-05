---
name: code-review
description: >
  Multi-agent review of everything about to go into the PR, run BEFORE the PR
  exists. Reads review.config.json to learn this repo, runs its declared gate
  commands as a blocking step first, then a rubric decides which review
  dimensions apply to this change set (instructions compliance, bugs, truth,
  reuse, and on web repos discoverability and interface, plus optional voice and
  keyword contract), then launches one parallel reviewer per selected dimension
  on the mid model tier. Interface renders the page in a browser and checks
  appearance, behaviour, readability and mobile; Discoverability adds a
  Lighthouse audit. Where no browser can be attached, those two run in container
  mode instead: everything else reviews normally and the receipt records what
  nobody rendered. Findings are scored 0-100 for confidence, anything under 80
  is dropped, then survivors are tiered Critical / High / Low / Minor. Critical
  and High are fixed by the strong tier in the same pass; Low and Minor are not
  fixed, they are reported with a recommended fix each for the owner to accept
  or decline. Reviewers get the diff inline and a tool-call budget, and reason
  from reading rather than building test harnesses. Fixes are not re-reviewed:
  the model tier is the quality control. Scope is incremental: commits a
  previous run already reviewed are recorded and skipped, so a run covers only
  the unreviewed commits plus the working tree (staged, unstaged, untracked).
  Pass "full" to review the whole branch again. Pass "init" to set the skill up
  in a repo that has never used it. Does not touch GitHub and posts nothing.
argument-hint: "[init] [optional: base branch] [full]"
disable-model-invocation: false
allowed-tools: Bash(git diff:*), Bash(git status:*), Bash(git merge-base:*), Bash(git ls-files:*), Bash(git fetch:*), Bash(git rev-parse:*), Bash(git log:*), Bash(node:*), Bash(npm:*), Bash(pnpm:*), Bash(yarn:*), Bash(bun:*), Bash(cargo:*), Bash(go:*), Bash(make:*), Bash(pytest:*), Bash(ruff:*), Bash(mypy:*), Bash(lsof:*), Bash(kill:*), Bash(pkill:*), Bash(curl:*), Task, Agent, Read, Edit, Grep, Glob, WebSearch, mcp__chrome-devtools__*
---

# Code review (pre-PR)

Review everything that is about to go into the pull request, before the pull request is created. There is no PR to read and no PR to comment on. The subject of review is the local change set.

Make a todo list first.

**All paths below beginning `scripts/`, `references/` or `templates/` are relative to this skill's own directory**, wherever it has been vendored. Everything else is relative to the repository root.

## 0. Read the config, and check what this host can do

**Read `review.config.json` at the repository root.** It is the only thing that knows this repo: its base branch, its gate commands, what its paths mean, which dimensions are switched on, which model tiers to use, and where its sources of record live.

If it is absent, this repo has never been set up. Run the installer and stop:

```
node <skill>/scripts/install.mjs
```

It detects the stack, writes the config, and arms the publish gate. Then report what it detected and ask the user to check the gate commands before the first real run. **Do not invent a config and do not proceed on a guessed layout.** The rubric explains why: a review that runs the wrong dimensions reports clean.

Then take stock of the host, because the rest of this file assumes capabilities that not every agent has:

| Capability | If present | If absent |
|---|---|---|
| Parallel subagents (`Task`/`Agent`) | one agent per dimension, in parallel | run the dimensions **sequentially in this context**, in rubric order, and say so in the report and on the receipt |
| A findings-report tool (`ReportFindings`) | report through it **and** in the reply | the reply is the only channel, which step 13 already requires anyway |
| A browser (`mcp__chrome-devtools__*`) | Interface and Discoverability Pass C run | container mode, per step 14 |
| Model selection per agent | use the tiers in `config.models` | one model does everything; say so, because the tier split is what makes step 12 safe |

Degrading is fine. Degrading silently is not. Whatever is missing goes in the report.

## 1. Establish the review scope

The base branch is `config.baseBranch` unless the invocation names another.

**If the invocation contains the word `full`, append `--full` to the `scope` call in (b) and review the whole branch.** Anything else, including no argument at all, runs incrementally.

   a. `git fetch` the base ref so it is not stale.
   b. **Ask what still needs reviewing.** Commits this skill has already reviewed are recorded, and reviewing them a second time is pure waste:

```
node <skill>/scripts/review-receipt.mjs scope [base]
```

   It returns JSON: `mode`, `reason`, `reviewFrom`, `dirty`, `reviewedCommits`, `unreviewedCommits`.

   - **`mode: "none"`** nothing has changed since the last review. Say so and stop.
   - **`mode: "incremental"`** some commits are already reviewed. `reviewFrom` is the parent of the earliest unreviewed commit, so the diff covers the unreviewed span as one piece.
   - **`mode: "full"`** nothing on this branch has been reviewed yet, or a full pass was asked for. `reviewFrom` is the merge base.

   Then `BASE=$REVIEWFROM` for everything below.

   **`mode` is authoritative, `unreviewedCommits` is not.** A message-only amend or a rebase that moved no bytes leaves SHAs the ledger has never seen while the code is the same code already read; `reason` says which case you are in.

   c. `git diff $BASE` gives every tracked change in range.
   d. `git ls-files --others --exclude-standard` gives new untracked files. **Read these in full.** They are entirely new code and appear in no diff.

The scope is the union of (c) and (d). Nothing outside that union is in scope.

**Say in the report which mode ran, and how many commits were skipped as already reviewed.** A reader told "no findings" is entitled to know whether that covered six commits or one.

**Use `scope <base> --full` when cross-commit interaction is the question.** An incremental pass reads the unreviewed span as a single diff, so it still catches a defect that needs two of those commits together, but it cannot see a commit that breaks something an already-reviewed commit established. The deterministic gate in step 3 runs over the whole tree every time regardless, so structural breakage is still caught; what narrows is judgment. Force a full pass before a merge that matters, and after any rebase that reordered work.

**A non-default base does not produce a valid receipt, and cannot.** The publish gate always measures against `config.baseBranch`, so a review against any other base resolves to a different merge-base, a different scope, and a hash the gate will reject. Reviewing against another base is fine for looking at something, but say plainly in the report that no receipt was stamped and that publishing still requires a run against the configured base.

## 2. Bail if the scope is empty

If (c) is empty and (d) lists no files, there is nothing about to go into a PR. Say so and stop. `mode: "none"` at step 1 is the same conclusion reached earlier and more cheaply: every byte in range has already been reviewed, so stop there rather than running the gate over an empty scope.

## 3. Deterministic gate (blocking)

**Run every step in `config.gate`, in the order it lists them, and stop at the first failure.** The order is cheapest-first by construction, so a type error does not cost a full build. Steps marked `needsBuild` read build output and must run after the build step, which is why the order in the file is load-bearing and must not be rearranged for convenience.

**If any fails, stop. Do not run the rubric and do not launch a single reviewer.** Report the failure output as the result of the review.

That is not caution, it is arithmetic. These commands catch an entire class of defect deterministically, with zero false positives, for the cost of one command each. Launching a fleet of language models at a tree that does not compile spends far more to find less, and buries the one finding that matters under a fleet's worth of speculation about code that was never going to run.

**If `config.gate` is empty, say so plainly in the report and continue.** Some repos genuinely have no gate. What must not happen is a report that reads as though one ran.

There is usually no CI at this point, because there is no PR. If this skill does not run these, nothing does before the push.

Two conditions to handle rather than fail on:

- **Dependencies not installed.** If `config.install` is set and its `detect` path is absent, run `config.install.run` once, then continue. Do not treat a missing install as a gate failure.
- **A failure that predates the change set.** If a check fails on something no changed file touches, say so explicitly, report it, and stop anyway. A broken baseline still needs fixing, but the reader deserves to know it was not their change.

## 4. Run the rubric

**Read `references/rubric.md` and follow it.** It classifies the changed files against `config.classes`, decides which dimensions apply, sets the render gate, measures the size, and prints the plan.

Do this before launching anything. A dimension that runs on an irrelevant change is noise; a dimension that silently does not run is false confidence.

## 5. Gather the instruction files

Use a **fast-tier** agent to return a list of file paths to (but not the contents of) the repo's agent instruction files: everything in `config.repoFacts.instructionFiles`, plus any equivalent file in a directory the change set touched.

Those are `CLAUDE.md`, `AGENTS.md`, `GEMINI.md`, `.cursorrules` and their siblings. Which ones exist is a property of the repo, not of the agent running this review: a repo written for one agent still carries rules a different agent must not break.

## 6. Summarise the change

Use a **fast-tier** agent to read the change set and return a summary.

## 7. Start the dev server, only if the rubric said to

If the render gate qualified Interface or Discoverability, start **one** dev server now using `config.dev.run`, and note its base URL from `config.dev.url`. Check whether one is already running first, and if so use it and do not stop it later. If neither qualified, or `config.dev` is null, skip this step.

Check for the browser before starting anything. If the browser tools are not available, no dev server will help: **do not start one**, do not launch Interface, and tell Discoverability to run its source-only passes and skip the audit pass. Every other dimension runs normally, and step 14 stamps in container mode so the receipt says what was not looked at.

## 8. Launch the reviewers

Launch one parallel agent per dimension **the rubric selected**, not per entry in the list below.

**Every reviewing agent runs on the mid tier (`config.models.review`). No exceptions.** Reviewing is a wide, parallel, read-heavy job: many agents run at once, each reads a lot and returns a short list. The mid tier is the right shape for that, and holding every dimension to one model keeps their findings comparable, which is what makes the tier normalisation in step 11 mean anything. Do not silently upgrade a dimension because it feels harder.

### Give them the change set. Do not make them fetch it.

Capture the diff **once**, here, and put it in every agent's prompt:

- Include the output of `git diff $BASE` inline in the prompt, and the full contents of every untracked file.
- If that exceeds roughly 1500 lines, write it to a file once and pass the path instead, with a one-line note of what was truncated.

Agents that each re-derive the scope run `git diff` and then open the same files independently. With three or more reviewers that is the same reading done three or more times before any reviewing starts, and it is pure duplicated latency on the critical path.

### Budget

**Give every agent an explicit tool-call budget, stated in its prompt.** The per-dimension numbers are in the list below.

Wall-clock for this step is the slowest single agent, and runtime tracks tool-call count almost linearly. An unbounded reviewer will keep pulling threads long after the marginal finding stops being worth the wait.

Tell each agent, in these terms: *"You have a budget of roughly N tool calls. Spend them on the highest-yield checks in your brief first. If you run out, stop and say what you did not get to."* A review that names its own gaps is honest. One that quietly ran out of road is not.

### Reason first, test only when reading cannot settle it

**Do not tell agents to verify empirically, attack the code, or build test harnesses.** That instruction produces exploit suites, throwaway repositories and fake binaries on the PATH, and it is the single largest driver of review latency.

The standing instruction is the opposite: **reason from reading the code.** Construct a test only when a finding genuinely turns on runtime behaviour you cannot determine by reading, and when the finding is Critical or High. Say so when you do.

This is a real trade and it is being made deliberately. Deep empirical passes have found true defects that reading missed. They also cost four times the wall clock. Reading first, testing on demand, is where the ratio sits best.

### For every agent

- Give it the inline change set, per above.
- Give it the instruction file paths from step 5.
- Give it the dev server base URL, if one is running and the dimension renders.
- Give it its tool-call budget.
- Tell it to **read its brief file first, in full, before reviewing anything**, and to read `references/severity.md` for the tier and fix-class definitions. The brief is the agent's complete instruction set. Do not paraphrase or summarise it into the prompt. Pass the path.
- Tell it to return a list of issues, each with the reason it was flagged, its tier, and its fix class, plus anything it ran out of budget to check.

<!-- BEGIN REVIEW DIMENSIONS: add or remove entries here. One agent is launched per selected entry. To add a dimension, write a brief under references/dimensions/ following the structure of the existing ones, add a line here with a budget, add a row to references/rubric.md, and add its id to `dimensions` in review.config.json. Describe the roster by name rather than by count, so adding one does not leave a stale number behind. -->

**Core, on in every repo:**

   a. Instructions compliance: `references/dimensions/core/01-instructions-compliance.md` (budget: 15)
   b. Bugs: `references/dimensions/core/02-bugs.md` (budget: 30)
   c. Truth: `references/dimensions/core/03-truth.md` (budget: 25)
   d. Reuse: `references/dimensions/core/04-reuse.md` (budget: 25)

**Web, on when the repo serves pages:**

   e. Discoverability: `references/dimensions/web/05-discoverability.md` (budget: 25)
   f. Interface: `references/dimensions/web/06-interface.md` (budget: 30)

**Content, on only when the repo has configured what they measure against:**

   g. Voice: `references/dimensions/content/07-voice.md` (budget: 20)
   h. Keyword contract: `references/dimensions/content/08-keyword-contract.md` (budget: 20)

<!-- END REVIEW DIMENSIONS -->

Budgets are guidance for the agent, not a hard cut-off enforced by the harness. Bugs and Interface get more because one reads outward through callers and the other drives a browser. Instructions compliance gets least because it is quote-matching against a small set of files.

Shared context lives in `references/severity.md` (tiers and fix authority) and, where the repo supplies one, the route map named by `config.repoFacts.routeMap`.

Two structures are deliberate and must not be flattened:
- **Bugs** runs a shallow diff-only pass, then a deep pass reading callers and callees, then a dependency pass when the dependency set changed. Do not split it into separate agents and do not let it collapse into one blended pass.
- **Interface** and **Discoverability** each share a browser session across their own passes. Do not split them.

## 9. Score every finding for confidence

Confidence and severity are different questions. This step asks **is it real**. Step 11 asks **does it matter**.

For each issue from step 8, launch a parallel **fast-tier** agent that takes the change set, the issue description, and the instruction file paths from step 5, and returns a confidence score. For issues flagged on instruction-file grounds, the agent must verify that file actually calls out that issue specifically. Give this rubric to the agent verbatim:

   a. 0: Not confident at all. This is a false positive that doesn't stand up to light scrutiny, or is a pre-existing issue.
   b. 25: Somewhat confident. This might be a real issue, but may also be a false positive. The agent wasn't able to verify that it's a real issue. If the issue is stylistic, it is one that was not explicitly called out in the relevant instruction file.
   c. 50: Moderately confident. The agent was able to verify this is a real issue, but it might be a nitpick or not happen very often in practice. Relative to the rest of the change, it's not very important.
   d. 75: Highly confident. The agent double checked the issue, and verified that it is very likely a real issue that will be hit in practice. The existing approach in the change is insufficient. The issue is very important and will directly impact the code's functionality, or it is directly mentioned in the relevant instruction file.
   e. 100: Absolutely certain. The agent double checked the issue, and confirmed it is definitely a real issue that will happen frequently in practice. The evidence directly confirms this.

## 10. Filter

Drop any issue scoring less than 80.

## 11. Tier and sort

**Read `references/severity.md`.** Assign every surviving finding one of four tiers, using that file's definitions rather than the reviewing dimension's own words:

**CRITICAL** ships broken, untrue or unsafe. **HIGH** is a real defect with bounded consequence. **LOW** is real, verified and small. **MINOR** is polish and judgment.

Reviewers propose a tier; you normalise across dimensions, so a High from Bugs and a High from Voice mean the same thing. Re-rank where a dimension over- or under-stated its own importance.

Also assign each finding a fix class: **Mechanical**, **Constrained**, or **Judgment**, per the same file.

Sort Critical, then High, then Low, then Minor. Within a tier, most severe first. Never group by dimension: the reader wants to know what to fix next, not which agent was busiest.

## 12. Fix, with the strong tier

**Every agent you spawn to apply a fix runs on the strong tier (`config.models.fix`).** This is the deliberate inverse of step 8, and it is what makes the next sentence safe.

**Fixes are not re-reviewed.** One pass: find, fix, ship. The model tier is the quality control, not a second reading. Finding a defect is recognition and parallelises well, so it goes to a wide fleet of the mid tier. Applying a fix is a change to working code where a wrong edit is worse than the finding it closed, so it goes to the strongest model available, and its output is trusted. Sending a strong-tier fix back to a mid-tier reviewer would be asking a weaker model to second-guess a stronger one, and it is what turned this loop into something that never terminated.

**If the host cannot select models per agent, say so in the report.** The one-pass-no-re-review rule is safe *because* of the tier inversion. Without it, the rule is still followed, but the reader is entitled to know the quality control it rests on was not available.

**Fix every CRITICAL and HIGH finding. Do not auto-fix LOW or MINOR.** Those are reported instead, each with a concrete recommended fix and a take-it-or-leave-it call, per `references/severity.md`. The point of the split is that a Minor fix spends the owner's attention on something a reasonable engineer could have declined, and buries the fixes that mattered inside a larger diff.

There is **one carve-out** to the fixing:

> **Factual claims that only the repo's owner can settle are never fixed automatically.** Prices, dates, headcount, customer names, contractual terms, legal statements, security commitments, published metrics. Stop and ask. This is not a capability limit, it is an authority limit: a stronger model still does not know what this company charges or which customers exist. Getting this wrong writes a confident falsehood onto a live page. `config.repoFacts.sourcesOfRecord` names the files that hold the answers this repo has written down; a claim traceable to one of those is checkable and needs no escalation. Everything else, including judgment calls about abstractions, naming, structure and taste, is the fixer's to make.

Then, without exception:

1. **Re-run the deterministic gate from step 3.** This is not a re-review. It is the same commands: deterministic, zero false positives. It exists so a fix that breaks the build, the link graph or an invariant cannot ship. If it fails, fix that too and run it again.
2. **List every fix applied**, with its file and what changed. Fixes are trusted, not invisible. The reader is entitled to see what the reviewer rewrote, and that list is the only record of it.
3. **Never delete a guard, a check or a test** to make a finding go away. That is not a fix.
4. **Stop at scale, counting only what you fix, and counting decisions rather than files.** The cap is 10 Critical and High findings. Low and Minor are reported, not fixed, so they never consume it. One Mechanical fix repeated across many call sites is one decision, not one per file. If Critical and High alone still exceed 10, **fix every Critical anyway** and report the High ones with recommendations, naming which were deferred and why. A Critical is never carried for being inconvenient to reach. See `references/severity.md` for the two incidents that produced this wording.

## 13. Report

Report with a **findings-report tool** if the host has one, in the tier order from step 11, so findings render in its UI. Pass an empty findings array if nothing survived. Every finding needs a repo-relative file, the 1-indexed line, a one-sentence summary, and a concrete failure scenario with specific inputs or state leading to the wrong outcome. Mark the Critical and High findings step 12 fixed as fixed, and leave the Low and Minor ones unmarked, which they are.

**Then write the same tier-ordered list into the reply as well.** The tool call is the structured record; it is not a guaranteed presentation. A review once reported seven findings through the tool alone and the reader saw an empty response, because the panel did not render on their client. Duplication is cheap; an invisible review is worthless. On a host with no such tool, the reply is the whole report and this paragraph is the only instruction that matters.

The reply must carry, in this order:

1. The gate result from step 3 and the rubric plan from step 4. A clean result means nothing without knowing what was checked.
2. **Critical and High**, each with the fix that was applied, its file and what changed.
3. **Low and Minor**, each with a **recommended fix and a take-it-or-leave-it call**. Name the specific edit at the file and line, and say whether to take it. These were deliberately not fixed, so the recommendation is the entire deliverable for them; a bare list of complaints is not a report.
4. Anything escalated under the owner carve-out, stated as an open question with options and a recommendation.
5. Anything a dimension ran out of budget to check, so the reader knows the shape of the gap.
6. Any capability from step 0 that was missing, and what ran differently because of it.

Findings dropped by the step-10 confidence filter are not reported as findings. If a filtered finding was nonetheless verified as real, say so in one line under Low, with its score, rather than discarding it silently.

Keep findings brief, avoid emojis, and anchor every one to a real file and line inside the change set.

## 14. Stamp the receipt

Stamp once the fixes from step 12 are applied and the gate from step 3 passes again:

```
node <skill>/scripts/review-receipt.mjs stamp
```

The receipt attests **"this scope was reviewed, and what the review found was fixed."** It does not claim the scope was clean on first read, and it must not be written in a way that implies it was.

Stamping also records every commit now in range as reviewed, carries forward what earlier runs recorded, and drops SHAs a rebase or amend has made unreachable. That ledger is what makes the next run incremental. **So stamp even when the run found nothing**: a clean incremental pass that never gets stamped leaves those commits unrecorded, and the next edit drags all of them back through a full review.

Stamp last, after the fixes, not before. The receipt is keyed on a hash of the working-tree content, so a receipt written before the fixes would describe a scope that no longer exists and the gate would reject it.

**Do not stamp** when the gate is failing, when a dimension errored and its findings were never collected, when you skipped a dimension the rubric selected, or when a factual claim was escalated under step 12's carve-out and is still unanswered. Those are the cases where the receipt would be a claim nothing backs.

Only stamp a review that ran against `config.baseBranch`. The publish gate checks that ref, so a receipt from any other base is unusable by construction.

### Container mode, when there is no browser to render in

There is exactly one exception to "do not stamp when you skipped a selected dimension", and it is the environment rather than the change: **Interface and Discoverability's audit pass need a browser, and a container has none to attach to.** Under the plain rule every review run in one would be unstampable, which in practice means every review run in one gets stamped anyway and the receipt quietly starts meaning less than it says.

So when step 7 found no browser, and the only dimensions that did not run are the ones that needed it:

```
node <skill>/scripts/review-receipt.mjs stamp --container
```

That writes an ordinary receipt with `mode: "container"` and the skip list on it. It allows a publish exactly like a normal one. What it changes is what the audit trail claims: both publish gates read the mode and say plainly that nothing rendered this change in a browser, so a container review is never mistaken later for a full one.

Say the same thing in your reply. Name the dimensions that did not run and why, in the report, not only in the receipt.

**This is not a shortcut to reach for when the browser exists.** If the tools are there and the render gate qualified, run the dimensions. Container mode is for the case where they cannot run at all, and using it anywhere else records a lie about what was looked at.

## 15. The waiver, and the only phrase that triggers it

The user may skip this review entirely, but only by saying **"do not run code review just merge"** explicitly. Nothing else counts. Not "just merge it", not "skip the review", not "we're in a hurry", not an inference from impatience. If the wording is not that, run the review.

When it is:

1. Do not run the rubric and do not launch any reviewer.
2. Record the waiver, so the audit trail says what actually happened:
   ```
   node <skill>/scripts/review-receipt.mjs waive "<the user's exact words>"
   ```
3. Say plainly in your reply that the review was **waived at the user's explicit request** and that the change set is unreviewed. Do not describe it as clean, passing, or approved. It is none of those.

The waiver writes a receipt marked `waived: true` rather than a normal one. That is the point. A silent bypass would leave a push indistinguishable from a reviewed one, which destroys the meaning of every other receipt. The deterministic gate in step 3 still runs: a waiver skips human-style judgment, not the compiler.

## 16. Stop the dev server

If you started one in step 7, stop it. If it was already running, leave it.

---

## Examples of false positives, for steps 8 and 9

- Pre-existing issues
- Something that looks like a bug but is not actually a bug
- Pedantic nitpicks that a senior engineer wouldn't call out
- Formatting and pedantic style issues like newlines
- **Anything a linter, typechecker, or compiler would catch**, when the gate in step 3 actually ran one and it passed. A reviewer reporting one of those is either wrong or looking outside the change set. Where the repo declares no such gate step, this exemption does not apply and the finding is fair.
- General code quality issues (eg. lack of test coverage, poor documentation), unless explicitly required in an instruction file
- Issues called out in an instruction file but explicitly silenced in the code (eg. a lint ignore comment)
- Changes in functionality that are likely intentional or directly related to the broader change
- Real issues, but on lines that are not part of the change set from step 1

Each brief carries its own additional false-positive list, specific to that dimension. Those are authoritative for that dimension and take precedence over this general list where they conflict.

## Notes

- The review agents themselves never run builds, typechecks, linters, or tests. The gate in step 3 is the parent's job and runs once. Keep the agents on judgment a compiler cannot make.
- Never call `gh`, and never post, comment, commit, or push. The Voice dimension detects only; rewriting follows `references/voice/rewriting.md` afterwards.
- Cite every finding with a file and line a reader can click. Do not construct forge blob URLs: the change set is local and may be unpushed, so no such URL exists.
