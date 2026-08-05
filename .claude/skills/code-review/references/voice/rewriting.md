# Voice rewriting pass

This is the **fix** half of the voice system.

The **detect** half is the Voice dimension of `/code-review` (`../dimensions/content/07-voice.md`), which reports tells and deliberately never rewrites. Read this when you need to actually rewrite flagged copy. The tell catalog (`ai-tells-catalog.md`) sits beside it, and the voice you are rewriting *toward* lives wherever `repoFacts.voiceSpec` points in `review.config.json`.

There is no slash command for this. Follow the procedure below directly.

**If the repo has no voice spec, stop.** There is nothing to rewrite toward, and rewriting anyway means imposing a register nobody chose. Strip the gate-blocked characters if that is what is blocking the push, and leave the prose alone.

---

Turn AI-shaped copy into copy that reads like this repo's own writer, and remove AI writing tells before it ships.

## When this runs (and when it must NOT)

- **It does not run during normal work.** Drafting, building pages, writing content: work normally. This is a reference document, not a skill. It never triggers itself.
- **It runs at the publish boundary.** The publish gate blocks a push when banned tells remain in the diff, and its message points here. That is the trigger.
- **It runs on explicit request.** On named files, on the current publish diff, or as a full sweep.

## Required reading (load these first, every run)

1. **The repo's voice spec**, at `repoFacts.voiceSpec`. This is the target you rewrite toward: its pillars, its register policy, its hard rules, and any deliberate exceptions it declares to the catalog.
2. **`ai-tells-catalog.md`**, the detect-and-rewrite catalog: every tell, its detection signal, and its rewrite rule. This is *how* you fix. Read its note on the examples: their register belongs to one specific repo, and the transferable part is what each rewrite does to the sentence.

Where the two disagree, **the spec wins**.

## Modes

| Invocation | Target files |
|---|---|
| Named files | exactly those files |
| No target given | the publish set: changed files against `baseBranch`, plus working-tree changes, filtered to `publishGate.scanDirs` and `publishGate.scanExt` |
| Full sweep | every audience-facing file in those directories. This produces a large diff, so it is reviewed section by section. Never run it silently as part of a push. |

## The process (per file)

1. **Read the file.** For structured data, work out which string values are audience-facing prose and which are functional fields. This distinction is the whole safety model for step 4.
2. **Detect** every tell using the catalog: both the hard bans and the contextual ones.
3. **Rewrite into the repo's voice.** Apply the spec's pillars and the catalog's rewrite rule for each hit. Rewrites are real rewrites, not deletions or punctuation swaps:
   - **Banned punctuation:** never present in the output, and never swapped for a near-equivalent. Restructure so the mark was never needed. Usually: split into two sentences, or reorder so the aside becomes its own clause.
   - **Negative parallelism ("It's not X, it's Y"):** use judgment. **Keep** a genuine contrast that carries real information; **dissolve** the mechanical and stacked ones into a plain assertion or a concrete example. Never leave the reflexive, hollow version.
   - **Rule of three, filler, hype vocabulary, uniform rhythm:** per catalog. Vary sentence length hard, prefer the concrete verb, and make the reader the subject wherever the spec asks for it.
4. **Respect the invariants.** Voice governs register, never facts or function:
   - **Structured data:** rewrite audience-facing prose *values* only. Never keys, slugs, URLs, type discriminators, enum-like fields, dates, tags, or component prop names. Keep the file valid and re-parse it to confirm.
   - **Legal and compliance copy:** every statement stays accurate and complete. If a rewrite changes what a sentence commits the company to, revert it and flag it.
   - **Meaning:** never invent facts, claims, numbers, or customer names. Rewrite what is there. Fabrication is a Truth-dimension Critical, and it is the worst possible outcome of a voice pass.
5. **Check the repo's own content invariants before writing back.** Every repo has a few, and violating one breaks the build or the page silently. Find them in the instruction files and the schema. The classes that recur:
   - **Derived or paired fields.** A subtitle that must be an exact substring of the title, a slug derived from a heading, an excerpt duplicated elsewhere. Reword one and the other must move with it.
   - **Links.** Never change an `href` or a markdown link target. You may reword visible link text, never its destination.
   - **Locked copy.** Taglines, legal names, product names, anything the repo declares fixed. Rewrite around it and leave it verbatim.
   - **Rendering limits.** If prose renders through a markdown pipeline with raw HTML disabled, any HTML you introduce becomes literal visible text. Watch stray metacharacters too.
   - **Unbuilt drafts.** Content excluded from the build is not schema-checked, so a rewrite there is unvalidated. Verify those by hand.
6. **Verify.** Re-scan for the hard bans, using the same rules file the gate uses. Confirm structured files still parse. Then run the repo's gate commands: they are the real validator.
7. **Write back** in place.

## After content is rewritten (publish flow)

1. **Run `/code-review`** on the diff. Rewriting and code review stay separate engines, with different failure modes, but they co-trigger here.
2. **Fix every finding** it reports at Critical or High, which it does itself.
3. **Retry the publish.** The gate re-scans; a clean diff passes.

## Report

End with a short, plain summary: files touched, count of each tell removed, any contextual construction you deliberately kept and why, and confirmation the gate scan is clean.
