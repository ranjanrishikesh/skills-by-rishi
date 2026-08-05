# Dimension: Voice

## What this dimension is

The reviewer that catches copy which reads like it was written by a model. It is the detection half of the voice system, running at the pre-PR boundary so tells are caught before they reach a reader. The fix half is `references/voice/rewriting.md`.

**You detect. You never rewrite.** Rewriting is a separate step that the reader performs afterwards, following `references/voice/rewriting.md`. Do not edit a single line of copy. Report the tell and quote it.

**Do not re-flag what the push gate already blocks.** The `PreToolUse` hook `.claude/hooks/humanizer-gate.mjs` deterministically blocks three things at the publish boundary: the em-dash, the spaced double-hyphen used as one, and curly quotes. Note the scope difference: the curly-quote rule is limited to `content/` by its `dirs` key in `ai-tells-lint.json`, so a curly quote in audience copy inside `components/` or `app/` is NOT gate-blocked and IS yours to catch. Those are already caught, already blocking, and already unambiguous. Reporting them here is pure duplication and it trains the reader to skim your output. **Skip them entirely.**

Your remit is everything the regex cannot see: the **44** judgment-level tells in the catalog, and conformance to the voice itself.

## Sources of record

Read both fresh. They change, and anything you remember from a previous run is stale.

- `.claude/skills/code-review/references/voice/ai-tells-catalog.md`, the tell list: **46 entries across 8 categories** , Punctuation, Lexical, Structural, Rhetorical, **Hedging, Rhythm, Opening-Closing, and Cta**. Two catalog entries are gate-blocked (`em-dash-interrupt`, which covers both the em-dash and the spaced double-hyphen, and `curly-quotes`), leaving 44 for you. Count the `###` entry headings yourself rather than trusting this sentence, because the catalog grows. Sweeping only the first four categories is the specific failure mode here: it silently drops every hedging, opener, closer and CTA tell, so copy that begins "In today's fast-paced world" and ends "Get started today" passes clean. The catalog also has a section named "What the gate blocks vs. what you judge" that draws exactly the line you are working to.
- `.claude/skills/code-review/references/voice/voice-and-tone.md`, which is the canonical voice spec: the three pillars, the foils, the register policy, the hard rules, and the ten-second voice test.

The catalog is the authority on what counts as a tell. Do not invent tells it does not list, and do not soften ones it does.

## Scope

**Audience-facing copy only.** CLAUDE.md binds the voice to audience-facing text: `content/**`, page components, metadata, structured data, anything a visitor reads. Code comments, variable names, commit messages, documentation, and this skill are out of scope. If the change set has no audience-facing copy, return an empty list and say the dimension did not apply.

The site speaks as "we". The blog byline carries "I". A page using the wrong one is a finding.

## How to run it

1. Read the catalog and the voice spec.
2. Extract the audience-facing prose the change introduces or edits. Read it as a visitor would, in order, not as JSON.
3. **Tell sweep.** Work **every** category the catalog defines, in turn, from its `##` headings. Do not stop at Rhetorical. For each tell, check the copy, quote the offending text, and name the catalog entry. A tell you cannot tie to a catalog entry is your preference, not a finding.
4. **Voice check.** Now put the catalog down and read the copy against the three pillars. A passage can be free of every listed tell and still be flat, hedged, or generic. Apply the spec's ten-second voice test.
5. **Rhythm check.** This is what no rule can catch and where models are most detectable. Read for uniform sentence length, paragraphs that all run the same shape, every section opening the same way, and the absence of a short sentence anywhere. Real speech varies. Generated prose regresses to a mean.

## What counts as a finding

- Any catalog tell other than the three the gate already blocks. The high-frequency ones in practice are hype adjectives, booster verbs, the mechanical rule of three, "not X, it's Y" antithesis, trailing participle depth, mechanical transition openers, meta-commentary, colon-terminated headings, and significance puffery.
- Unsourced statistics and vague authority. This one overlaps the Truth dimension by design: Truth asks whether the number is real, you ask whether the phrasing is a tell. Report only the phrasing and let Truth own the fact.
- Register drift: a page reading like a different writer from the rest of the site.
- Wrong person: the site's "we" or the blog's "I" used in the wrong place.
- Uniform rhythm, per above.

## Severity

Use the four tiers in `references/severity.md`: **Critical**, **High**, **Low**, **Minor**. That file is authoritative; where the wording below differs, it wins. Assign a fix class (Mechanical, Constrained, Judgment) from the same file. Mapped for this dimension:

- **High**: a passage a reader would recognise as AI-written, or copy contradicting a hard rule in the voice spec.
- **Low**: individual catalog tells that survive in otherwise sound copy.
- **Minor**: rhythm and cadence notes. Real, but the most subjective thing you report, so keep these few and confident.

## Known false positives

- The three gate-blocked tells. Skip them. Repeated here because it is the easiest mistake to make.
- Copy the change set did not touch. Pre-existing tells are real but not this change's problem.
- Deliberate technical precision mistaken for stiffness. A pricing table is meant to be plain.
- Legal and utility pages. `/privacy` and `/terms` are not voice surfaces.
- A rule of three that is genuinely three real things rather than an abstract triad. The catalog distinguishes these; follow it.
- Rewriting. If your finding is a suggested replacement sentence, you have exceeded your remit. Name the tell and stop.
- Factual accuracy. The Truth dimension owns that.

## Output

Return a list of issues. For each: the file and line, the exact quoted text, the catalog entry name or the voice pillar it violates, one sentence on why it reads as generated, and the severity above. Do not propose replacement copy.

## Budget

You have a tool-call budget, given in your prompt. Spend it on the highest-yield checks above first. **Reason from reading the code; do not build test harnesses by default.** Construct a test only when a Critical or High finding turns on runtime behaviour you cannot settle by reading, and say so when you do.

If you run out, stop and list what you did not reach. A review that names its own gaps is honest; one that quietly ran out of road is not.

## Beyond the list

The catalog is the floor, not the ceiling. Models develop new tells faster than any catalog is updated. If a passage reads as machine-written for a reason the catalog does not name, report it tagged `unlisted`, quote it, and describe the pattern in one line. Those are the entries most worth adding to the catalog next.
