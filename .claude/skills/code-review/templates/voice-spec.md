# Voice and tone — TEMPLATE

Copy this somewhere in your repo (`docs/voice.md` is a fine home), fill it in, and point `repoFacts.voiceSpec` at it in `review.config.json`. Until you do, the Voice dimension stays off, which is the correct default: a voice reviewer with no spec corrects toward whatever register the model defaults to, and that is the exact thing the dimension exists to catch.

**Delete every instruction in square brackets as you go.** What is left should read as a decision, not a form.

The one test that tells you the spec is finished: **could a reviewer use it to overrule the tell catalog?** If your voice genuinely wants something the catalog calls a tell, this file has to say so out loud, or the reviewer will keep flagging it forever.

---

**Status: BINDING.** Every audience-facing word follows this. [Name the surfaces: marketing pages, docs, blog, in-product copy, error strings, release notes, meta descriptions, alt text. Be specific, because the reviewer's scope is exactly what you list here.]

## The essence, in one line

[One sentence. Who is talking, to whom, in what mood. Write it as an instruction to a writer, not as a description of a brand. "Write like X talking to Y who has been Z" beats "professional yet approachable" by a mile, because the second one cannot be failed.]

## The pillars

[Two to four. Each is a filter every sentence passes, not a mood to pick from. For each one, give a name, a paragraph, and a **before and after pair from your own product**. The pairs do more work than the paragraphs: they are what a reviewer actually compares against.]

### 1. [Name]

[What it means.]

- **Do:** [concrete instruction]
- **Don't:** [the specific failure mode, not its opposite]
- **Before:** [a real sentence that fails]
- **After:** [the same sentence passing]

### 2. [Name]

[Repeat.]

## The foils

[What the voice pushes against. Two to four. A voice with no foil has no edge and reads as generic no matter how many adjectives you attach to it. Name the things you refuse to sound like.]

[Then the guardrail, which matters more than the foils: say who the reader is and confirm you are on their side. The failure mode of any voice with an edge is landing the punch on the reader instead of on the pattern.]

## Register policy

[Does the register change by surface? Most repos say yes and then cannot say where the line is, which produces drift nobody can review. Pick one:]

- **Uniform.** The same voice everywhere, including legal and microcopy. [Simplest to enforce. If you pick this, say so plainly, because a reviewer will otherwise assume the legal pages are exempt.]
- **Tiered.** [Then define each tier and name which paths fall in it. A tier nobody can map to a directory is not enforceable.]

**The invariant, whichever you picked:** voice governs *register*, never *facts or function*. Legal statements stay legally accurate. UI copy stays clear about the action. Clarity wins any conflict with style.

**Person.** [First or third? Singular or plural? Does anything carry a byline in a different person? This is the most frequently violated line in any voice spec and the easiest for a reviewer to check, so be exact.]

## Hard rules

[Numbered, absolute, checkable. These are what the reviewer quotes. A rule that cannot be quoted against a specific sentence is a preference, and preferences belong in the pillars above, not here.]

1. [e.g. No em-dash. Ever. Rewrite so no dash was ever needed.]
2. [e.g. No exclamation marks in body copy.]
3. [e.g. Banned vocabulary, listed explicitly.]
4. [e.g. Spelling convention: en-US or en-GB.]
5. [Anything your industry requires: claims that need a disclaimer, words compliance forbids, terms with a legal meaning.]

**Deliberate exceptions to the tell catalog.** [If your voice wants something `references/voice/ai-tells-catalog.md` calls a tell, list it here with the catalog entry name. This is the only place that can overrule the catalog, and without it the reviewer will flag the same thing every run until someone stops reading its output.]

## The 10-second test

[Five or six checkboxes a writer runs before shipping a sentence. Derive them from the pillars above so they cannot drift apart. Phrase each as a question with a wrong answer, not as a virtue.]

- [ ] Could a competitor paste this sentence onto their site unchanged? → then it says nothing. Add a specific.
- [ ] [Your own.]
- [ ] [Your own.]
