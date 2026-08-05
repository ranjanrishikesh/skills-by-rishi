# Dimension: Voice

## Trigger

**Run only when `repoFacts.voiceSpec` is set in `review.config.json` and the change set contains audience-facing copy.**

If no voice spec is configured, return an empty list and say the dimension did not apply because the repo has not defined a voice. That is not a gap to fill with your own taste. A voice reviewer with no spec produces confident corrections toward whatever register the model defaults to, which is the exact thing this dimension exists to catch.

`templates/voice-spec.md` is a starting point for a repo that wants one.

## What this dimension is

The reviewer that catches copy which reads like it was written by a model. It is the detection half of the voice system, running at the pre-PR boundary so tells are caught before they reach a reader. The fix half is `references/voice/rewriting.md`.

**You detect. You never rewrite.** Rewriting is a separate step performed afterwards. Do not edit a single line of copy. Report the tell and quote it.

**Do not re-flag what the push gate already blocks.** The publish gate deterministically blocks whatever `publishGate.rules` lists at `severity: "block"` (in the shipped ruleset: the em-dash, the spaced double-hyphen used as one, and curly quotes). Those are already caught, already blocking, and already unambiguous. Reporting them here is pure duplication and it trains the reader to skim your output. **Skip them entirely.**

**Read the rules file to find out what is actually blocked, rather than assuming.** Two things vary per repo and both change your remit:
- Which rules exist at all. A repo may have deleted any of them.
- A rule's `dirs` key narrows it. The shipped curly-quote rule can be scoped to a content directory, in which case a curly quote in audience copy inside a component directory is **not** gate-blocked and **is** yours to catch.
- Which directories the gate scans at all, from `publishGate.scanDirs`. Copy outside those directories is entirely yours.

Your remit is everything the regex cannot see: the judgment-level tells in the catalog, and conformance to the voice itself.

## Sources of record

Read all three fresh. They change, and anything you remember from a previous run is stale.

- **`references/voice/ai-tells-catalog.md`**, the tell list, organised into categories. **Count the `###` entry headings yourself** rather than trusting any number written down, because the catalog grows. Sweeping only the first few categories is the specific failure mode here: it silently drops every hedging, opener, closer and CTA tell, so copy that begins "In today's fast-paced world" and ends "Get started today" passes clean. The catalog also has a section on what the gate blocks versus what you judge, which draws exactly the line you are working to.
- **The repo's voice spec**, at `repoFacts.voiceSpec`. This is the canonical target: its pillars, its foils, its register policy, its hard rules. The catalog says what is generically machine-shaped; the spec says what is right *here*.
- **`publishGate.rules`**, per above, so you know what to skip.

The catalog is the authority on what counts as a tell. Do not invent tells it does not list, and do not soften ones it does. **Where the catalog and the repo's voice spec disagree, the spec wins**, and the disagreement is worth one line in your report: a repo is allowed to want something the catalog calls a tell.

## Scope

**Audience-facing copy only.** Content files, page components, metadata, structured data, error and empty states, anything a visitor reads. Code comments, variable names, commit messages, internal documentation and this skill are out of scope. If the change set has no audience-facing copy, return an empty list and say the dimension did not apply.

Person and register come from the spec. A page using the wrong person is a finding only because the spec names one.

## How to run it

1. Read the catalog, the voice spec, and the gate's rules file.
2. Extract the audience-facing prose the change introduces or edits. Read it as a visitor would, in order, not as raw data.
3. **Tell sweep.** Work **every** category the catalog defines, in turn, from its `##` headings. Do not stop partway. For each tell, check the copy, quote the offending text, and name the catalog entry. A tell you cannot tie to a catalog entry is your preference, not a finding.
4. **Voice check.** Now put the catalog down and read the copy against the spec's pillars. A passage can be free of every listed tell and still be flat, hedged, or generic. Apply whatever quick test the spec defines.
5. **Rhythm check.** This is what no rule can catch and where models are most detectable. Read for uniform sentence length, paragraphs that all run the same shape, every section opening the same way, and the absence of a short sentence anywhere. Real speech varies. Generated prose regresses to a mean.

## What counts as a finding

- Any catalog tell other than the ones the gate already blocks. The high-frequency ones in practice are hype adjectives, booster verbs, the mechanical rule of three, "not X, it's Y" antithesis, trailing participle depth, mechanical transition openers, meta-commentary, colon-terminated headings, and significance puffery.
- Unsourced statistics and vague authority. This one overlaps the Truth dimension by design: Truth asks whether the number is real, you ask whether the phrasing is a tell. Report only the phrasing and let Truth own the fact.
- Register drift: a page reading like a different writer from the rest of the product.
- Wrong person, against what the spec names.
- Uniform rhythm, per above.

## Severity

Use the four tiers in `references/severity.md`: **Critical**, **High**, **Low**, **Minor**. That file is authoritative; where the wording below differs, it wins. Assign a fix class (Mechanical, Constrained, Judgment) from the same file. Mapped for this dimension:

- **High**: a passage a reader would recognise as AI-written, or copy contradicting a hard rule in the voice spec.
- **Low**: individual catalog tells that survive in otherwise sound copy.
- **Minor**: rhythm and cadence notes. Real, but the most subjective thing you report, so keep these few and confident.

## Known false positives

- The gate-blocked tells. Skip them. Repeated here because it is the easiest mistake to make.
- Copy the change set did not touch. Pre-existing tells are real but not this change's problem.
- Deliberate technical precision mistaken for stiffness. A pricing table is meant to be plain.
- Legal and utility pages, unless the spec explicitly covers them. Some do.
- A rule of three that is genuinely three real things rather than an abstract triad. The catalog distinguishes these; follow it.
- Rewriting. If your finding is a suggested replacement sentence, you have exceeded your remit. Name the tell and stop.
- Factual accuracy. The Truth dimension owns that.
- Anything you are flagging because it differs from how you would have written it, where the spec is silent. Silence is permission.

## Output

Return a list of issues. For each: the file and line, the exact quoted text, the catalog entry name or the voice-spec rule it violates, one sentence on why it reads as generated, and the severity above. Do not propose replacement copy.

State how many catalog categories you swept and how many entries the catalog held, so the reader can tell a full sweep from a partial one.

## Budget

You have a tool-call budget, given in your prompt. Spend it on the highest-yield checks above first. **Reason from reading; do not build test harnesses.**

If you run out, stop and list what you did not reach. A review that names its own gaps is honest; one that quietly ran out of road is not.

## Beyond the list

The catalog is the floor, not the ceiling. Models develop new tells faster than any catalog is updated. If a passage reads as machine-written for a reason the catalog does not name, report it tagged `unlisted`, quote it, and describe the pattern in one line. Those are the entries most worth adding to the catalog next.
