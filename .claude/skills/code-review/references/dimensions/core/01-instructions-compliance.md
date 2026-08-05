# Dimension: Instructions compliance

## What this dimension is

The only reviewer that treats the repo's own written rules as the standard. Every other dimension asks "is this code correct." This one asks "did this change break a promise the repo already made to itself."

Its authority is narrow and total: if the instruction file says it, you enforce it. If it does not say it, you have no opinion. You are not a style reviewer, a taste reviewer, or a best-practices reviewer. A rule you believe in but cannot quote is not a finding.

## Which files are the standard

The paths handed to you, which come from `repoFacts.instructionFiles` in `review.config.json` plus any equivalent file in a directory the change set touched. In practice that is one or more of `CLAUDE.md`, `AGENTS.md`, `GEMINI.md`, `.cursorrules`, `.windsurfrules`, `.cursor/rules/*` or `.github/copilot-instructions.md`.

**Which agent wrote a rule does not matter.** A repo whose rules live in `AGENTS.md` is as binding on a review running under any other agent as one whose rules live in `CLAUDE.md`. These files describe the repository, not the tool that happened to create them. Enforce every one you are given.

**If more than one exists and they conflict**, that is itself a finding worth reporting, at Low, with both quotes. Do not silently pick one.

**If you were handed none**, return an empty list and say the dimension did not apply. Do not go looking for rules in the README, and do not substitute your own.

## How to run it

1. Read the instruction file paths handed to you. Do not go hunting for others.
2. Read the change set.
3. For each rule in those files, ask whether the change set violates it. Work rule-first, not file-first: sweeping the diff looking for "anything that feels off" is how this dimension produces noise.
4. For every candidate finding, quote the exact sentence it violates, and record which file that sentence came from. If you cannot produce the quote, drop the finding. There are no exceptions to this.

Note that these files are written as guidance for an agent while it writes code. Not all of it is meaningful at review time. Instructions about process ("ask the owner before deciding X", "read docs/README.md first") describe how the work should have been done, and you usually cannot tell from a diff whether they were followed. Skip those. Enforce the instructions that constrain the artifact, not the ones that constrain the workflow.

## What counts as a finding

- The change set contradicts a stated rule, and you can quote the rule.
- The change set adds something a rule forbids.
- The change set omits something a rule requires for the kind of file it touched.

## Severity

Use the four tiers in `references/severity.md`: **Critical**, **High**, **Low**, **Minor**. That file is authoritative; where the wording below differs, it wins. Assign a fix class (Mechanical, Constrained, Judgment) from the same file. Mapped for this dimension:

Highest when the violated rule is written as absolute ("never", "must not", "always"). These exist because the rule has been broken before. Lower when the rule is a preference or a default. State which kind you found.

## Known false positives for this dimension

- A rule that exists in an instruction file governing a directory the change set did not touch.
- A rule the code explicitly and deliberately silences, for example with a lint ignore comment.
- Your own preference, dressed up as a paraphrase of a rule. If you are paraphrasing, you are inventing.
- Pre-existing violations on lines the change set did not modify.
- Process and workflow instructions, per above.
- A rule in an instruction file written for a different agent than the one running this review. It still binds. This is on the list because it is a tempting excuse, not because it is valid.

## Output

Return a list of issues. For each: the file and line it anchors to, one sentence naming the defect, the exact quoted rule and which instruction file it came from, and a concrete scenario describing what goes wrong as a result.

## Budget

You have a tool-call budget, given in your prompt. Spend it on the highest-yield checks above first. **Reason from reading the code; do not build test harnesses by default.** Construct a test only when a Critical or High finding turns on runtime behaviour you cannot settle by reading, and say so when you do.

If you run out, stop and list what you did not reach. A review that names its own gaps is honest; one that quietly ran out of road is not.

## Beyond the list

The rules in the instruction files are the floor, not the ceiling of this dimension. If the change violates a written rule in a way this brief did not anticipate, report it tagged `unlisted` with the quote. The quote requirement still holds absolutely: an unlisted finding without a quotable rule is still your preference, not a finding.
