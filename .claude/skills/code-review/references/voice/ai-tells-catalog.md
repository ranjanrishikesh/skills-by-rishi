# AI Writing Tells Catalog

The detect-and-rewrite reference for the Voice dimension and its rewriting pass. Built from a 7-angle web and prior-art research fan-out (88 raw patterns) synthesized to the entries below.

**This file is half of a pair.** It is *what to catch*. The other half is *what to fix toward*, and that is your repository's own voice spec, named by `repoFacts.voiceSpec` in `review.config.json`. This catalog cannot supply it, because "reads like a machine" is close to universal while "reads like us" is not.

### A note on the examples

Every entry carries a worked before-and-after. Those rewrites were written for one particular voice: bold, first-person, dry, deliberately unpolished. **Read them for the move, not the register.** The lesson in each is what the rewrite *does* to the sentence, which transfers everywhere. The tone it lands in is one repo's answer and may be wrong for yours. Where the example's register and your voice spec disagree, your spec wins; the entry's detection rule and rewrite rule still hold.

If your repo's voice is genuinely formal, most of these still apply. Formal is not the same as machine-shaped, and almost nothing in here is a tell only because it is polite.

## How to read severity

- **hard_ban** — must never ship. Typically also enforced by the deterministic pre-publish gate.
- **strong** — almost always an AI tell; remove unless there is a specific reason.
- **contextual** — a tell only when mechanical, stacked, or reflexive. Real writing uses some of these well. **Keep the good ones, dissolve the mechanical ones.** Over-correcting these is the number one way to flatten a voice into something blander than what you started with.

## What the gate blocks vs. what you judge

The deterministic gate is configured by `publishGate.rules`. The shipped ruleset blocks three things with near-zero false positives: **em-dash (U+2014)**, **spaced `--`**, and **curly quotes**. It deliberately does NOT block the en-dash (legitimate numeric ranges like `9-5`), decorative-emoji glyphs (a `✓` in a terminal readout is legitimate), or any rhetorical or lexical pattern below. Those are yours to judge and fix during the rewrite.

**Check the actual rules file rather than trusting this paragraph.** A repo may have deleted a rule, added one, or narrowed one to specific directories with a `dirs` key. Anything the gate does not block is yours to catch, and anything it does block is duplication if you report it.

---

## Punctuation

### Em/en dash and double-hyphen interrupts

`em-dash-interrupt` — **hard_ban** · **gate-blocked** · lintable

- **Why it signals AI:** The em dash is the single strongest surface tell of machine prose. RLHF rewarded its punchy interrupt-and-restate rhythm, so ChatGPT/Copilot-class models emit it far above human rates. En dashes and spaced double-hyphens are the same cadence wearing a thinner mark once authors are told to drop the em dash.

- **Detect:** Any — (U+2014), – (U+2013), or spaced double hyphen ( -- ) in body copy, headings, list items, heroes, or CTAs. The appositive/interruption construction itself is the tell, not just the glyph. Legit numeric range use writes a plain hyphen (9-5), so any dash of this class in prose fails.

- **AI:** Our first build — a lead router for a roofing crew — paid for itself in six weeks.

- **Founder fix:** Take our first build. We wired a lead router for a roofing crew, and it paid for itself in six weeks.

- **Rewrite rule:** Delete every em dash, en dash, and spaced double hyphen. Do not just swap in a comma and move on: the interrupt-and-restate move is itself the tell. Break the sentence into two, or fold the aside into the main clause, so it reads like the founder saying it out loud. A dash inside a real number range becomes a plain hyphen.


### Curly/smart quotes and apostrophes

`curly-quotes` — **hard_ban** · **gate-blocked** · lintable

- **Why it signals AI:** Chat UIs auto-curl quotes and apostrophes, so pasted model output carries U+2018/2019/201C/201D. In a straight-quote code repo where authors type into JSON/markdown, a curly glyph is a near-certain copy-paste-from-model fingerprint, and mixed straight/curly in one paragraph is the strongest signal.

- **Detect:** Any ‘ ’ “ ” in content files that are otherwise straight-quoted.

- **AI:** He told us the intake form was “basically fine.”

- **Founder fix:** He told us the intake form was "basically fine."

- **Rewrite rule:** Normalize every curly quote and apostrophe to straight ASCII, and enforce straight quotes at the source so the glyphs can never re-enter. Do not hand-swap glyph by glyph after the fact — fix the pipeline. Leave genuine quoted human speech intact word for word, only the glyphs change.


### Label-colon summary lead-in (The result: / Bottom line:)

`label-colon-lead-in` — **contextual** · lintable

- **Why it signals AI:** LLMs tee up a payoff with a short abstract label plus a colon to manufacture a tidy slide-deck takeaway. A person talking states the thing without announcing that a takeaway is coming.

- **Detect:** A line opening with a 1-3 word abstract noun label followed by a colon and the actual content. Distinct from a colon that genuinely introduces a list or quote.

- **AI:** The result: your ops manager stops copying data between four browser tabs.

- **Founder fix:** So your ops manager stops living in four browser tabs, copying numbers between them.

- **Rewrite rule:** Drop the label and the colon and just say the thing. If a connective helps, use a plain spoken one like 'So' or 'And'. Keep colons that truly introduce a list or a quote.


## Lexical

### Booster/upgrade verbs (leverage, harness, unlock, elevate, empower, utilize, optimize)

`booster-upgrade-verbs` — **strong** · lintable

- **Why it signals AI:** These 'hallucinations of sophistication' are rare in real business talk but exploded in LLM output (delve rose 654% 2020-2023). They swap a specific physical action for a vague upgrade verb, and they cluster with abstract objects (leverage solutions, optimize workflows).

- **Detect:** Any booster verb as the main verb where a plain verb (use, cut, open, help, speed up, connect) with a concrete object would carry the meaning — especially when the object is itself abstract (solutions, workflows, efficiencies).

- **AI:** We leverage cutting-edge solutions to optimize your workflows and unlock efficiencies.

- **Founder fix:** We connect your booking form to your calendar and your invoicing, so nobody re-types a customer's name three times.

- **Rewrite rule:** Replace the booster verb with the plain physical action and name the actual object on screen: connect this form to that calendar, cut the manual re-typing, chase the overdue invoice. If you cannot name a concrete object, the sentence has no content yet — write what actually happens instead.


### Figurative abstraction nouns (tapestry, symphony, beacon)

`figurative-abstraction-nouns` — **strong** · lintable

- **Why it signals AI:** LLMs reach for grand textile/light/music metaphors and a small cluster of post-2023 spike words (vibrant, intricate, pivotal, showcase, underscore) to sound literary about plain business things. Editors treat 'tapestry' as a near-certain fingerprint.

- **Detect:** Any of these words used figuratively about a product, market, or capability rather than a literal woven cloth or orchestra.

- **AI:** Our platform weaves together a rich tapestry of automation across your business.

- **Founder fix:** The platform runs three of your workflows end to end: invoicing, scheduling, and the follow-up emails nobody has time to send.

- **Rewrite rule:** Cut the metaphor and name the plain business thing it was standing in for — the three workflows, the one dashboard, the actual task. Never dress a back-office tool in textile, light, or music imagery.


### Hollow hype adjectives (robust, seamless, cutting-edge, game-changing, world-class)

`hollow-hype-adjectives` — **strong** · lintable

- **Why it signals AI:** Editors call 'seamless' the most diluted word in the dictionary and 'robust' empty without a spec. These adjectives are placeholders for a feature description the writer never gives, and they sell instead of state — the opposite of quiet confidence.

- **Detect:** Any of these boosters applied to a product or service with no number, spec, or mechanism attached in the same sentence.

- **AI:** A robust, seamless, best-in-class solution that scales with you.

- **Founder fix:** It handles 500 orders a day without slowing down, and it won't fall over when you hit 2,000.

- **Rewrite rule:** Replace the adjective with the spec it was hiding: a number, a load, a named mechanism, an observable before/after. If a real spec is already attached and the adjective is just decoration, cut the adjective. Never assert greatness the reader can't check.


### Category placeholder instead of a named tool

`category-placeholder-tool` — **strong** · lintable

- **Why it signals AI:** Detectors note AI tries hard to avoid proper nouns and falls back on category language. A founder who does the work names the actual product; naming HubSpot, Pipedrive, or Zapier is only-we-would-say-it specificity AI can't fake without risk.

- **Detect:** Hedged category nouns (a leading CRM, various platforms, a range of tools) where a 200-word span makes tool claims but names zero actual products or companies.

- **AI:** We integrate with a range of popular CRM platforms to streamline your sales pipeline.

- **Founder fix:** We plug it into HubSpot, or Pipedrive if that's what you're already paying for.

- **Rewrite rule:** Name the actual product: HubSpot, Pipedrive, Zapier, QuickBooks, whatever it really is. If the true answer is genuinely several tools, name the two or three most common by name. Never invent an integration to fill the blank — if you don't know which tool, flag it for the author rather than writing 'a leading platform'.


### Placeholder personas (Acme, John Smith)

`placeholder-personas` — **strong** · lintable

- **Why it signals AI:** Forced to name someone, AI reaches for filler placeholders. The placeholder is a confession that no real example exists.

- **Detect:** Stock placeholder entities (Acme, XYZ Corp, John Smith, Company A/B/X, 'a company called') anywhere in a page that should name a real client.

- **AI:** For example, Acme Corp used our platform and saw improved results across the board.

- **Founder fix:** Take Rivet Plumbing in Toledo. After we set up automated dispatch, they stopped double-booking Saturdays and stopped paying two guys to sit in traffic.

- **Rewrite rule:** Replace the placeholder with a real named client and a specific detail (city, headcount, the exact thing that changed). If no real client can be named yet, flag it for the author to supply — do not invent a company, a name, or a result to fill the slot.


### Wordy Latinate connective filler (in order to, due to the fact that)

`wordy-latinate-connectives` — **contextual** · lintable

- **Why it signals AI:** Models default to inflated connectives where a one-word plain-English swap exists. They flatten the tight spoken rhythm the voice needs.

- **Detect:** A multi-word connective where a single word fits: in order to → to, due to the fact that → because, at this point in time → now, has the ability to → can.

- **AI:** In order to reduce manual work, and due to the fact that your team is small, we automate intake first.

- **Founder fix:** Your team's small, so we automate intake first. That's where the manual work piles up.

- **Rewrite rule:** Swap each wordy connective for its one-word equivalent (to, because, now, about, for, if, can). Then read the sentence aloud and cut anything that still sounds like a form letter.


### Stacked compound modifiers (AI-powered, data-driven, customer-centric)

`compound-modifier-stacking` — **contextual** · lintable

- **Why it signals AI:** AI hyphenates buzz-modifiers with perfect consistency and stacks them in front of a vague noun (solution, platform). Humans rarely stack three, and the modifiers replace an actual description of what the thing does.

- **Detect:** Two or more X-powered / X-driven / X-centric / X-first / X-grade modifiers in front of a generic noun.

- **AI:** Our AI-powered, data-driven, customer-centric solution.

- **Founder fix:** The tool reads your customer emails and drafts replies your team approves before anything sends.

- **Rewrite rule:** Delete the stacked modifiers and describe what the thing actually does in one plain clause. A single compound modifier can stay if it's doing real work; never stack two or three in front of solution/platform/approach.


### Vague magnitude adverb instead of a real number

`vague-magnitude-no-number` — **contextual** · lintable

- **Why it signals AI:** AI reaches for magnitude words because it has no measured result to cite. Real founder proof is a number with units — from two days to twenty minutes. The specificity AI avoids is exactly the friction that reads as true.

- **Detect:** A magnitude adverb (significantly/dramatically/substantially) modifying a result verb with no adjacent number, percentage, or time span.

- **AI:** This significantly improves efficiency and dramatically reduces manual work.

- **Founder fix:** It cut one client's quoting time from two days to about twenty minutes.

- **Rewrite rule:** Replace the magnitude adverb with the actual figure and its units, ideally tied to a real client. If you don't have a true number, describe the concrete before/after instead — never assert 'significantly' as a stand-in for a measurement you don't have. Do not fabricate a statistic to satisfy this rule.


### Abstract Latinate noun stacking (solutions, capabilities, efficiencies)

`abstract-noun-stacking` — **contextual**

- **Why it signals AI:** A core diction tell: three-plus abstract Latinate nouns strung together with no concrete, countable object a reader could point to. Reads as high-perplexity filler; the founder voice names the one thing on screen.

- **Detect:** Three or more abstract nouns (solutions, capabilities, insights, offerings, efficiencies, methodologies, functionalities) in one sentence with zero concrete nouns (a report, an email, an order) present.

- **AI:** Our solution delivers actionable insights, operational efficiencies, and scalable capabilities.

- **Founder fix:** You get one dashboard that flags which jobs are running late, before the customer calls to complain.

- **Rewrite rule:** Rewrite around the single concrete thing on screen — the dashboard, the flag, the late job — and delete the abstract nouns. Test: if the reader can't point at the thing you named, it isn't concrete enough yet.


## Structural

### Colon-terminated section heading

`colon-terminated-heading` — **strong** · lintable

- **Why it signals AI:** AI ends headings with a colon that dangles into the body, treating the heading as the first half of a sentence. Real section headers are noun phrases or plain questions.

- **Detect:** A markdown heading whose visible text ends in a colon, or a bolded phrase on its own line ending in a colon above a paragraph.

- **AI:** ## What we install: the three-week rollout

- **Founder fix:** ## How the three-week rollout actually goes

- **Rewrite rule:** Rewrite the heading as a noun phrase or a plain question with no trailing colon. Keep any SEO keyword the heading needs to carry — just move it into a natural sentence-case phrase.


### Title Case in section headings

`title-case-heading` — **strong** · lintable

- **Why it signals AI:** AI capitalizes Every Main Word, overshooting web style, which is sentence case. Title case reads like a template; sentence case reads like a person wrote it.

- **Detect:** A heading with three or more capitalized words including function words (To, We, Into, Your). Proper nouns (AI, SMB, brand names) legitimately stay capitalized, so the tell is capitalized verbs, prepositions, and articles.

- **AI:** ## How We Install AI Into Your Back Office

- **Founder fix:** ## How we install AI into your back office

- **Rewrite rule:** Convert headings to sentence case, capitalizing only the first word and genuine proper nouns. Do not lowercase AI, SMB, or brand names. Keep the heading's target keyword intact for SEO — case is the only thing changing.


### Emoji bullets and heading emojis

`emoji-decoration` — **strong** · lintable

- **Why it signals AI:** Decorating bullets or headings with rockets, checkmarks, and lightbulbs is a near-pure ChatGPT formatting habit from README and social-post style. A premium B2B page never uses emoji as list markers.

- **Detect:** An emoji or dingbat anywhere in copy, especially at the start of a line, bullet, or heading, or as a bullet marker itself.

- **AI:** 🚀 Faster quotes
✅ Fewer errors
💡 Happier staff

- **Founder fix:** Quotes go out the same day. The error rate on them drops. And the people running the tool stop dreading it.

- **Rewrite rule:** Delete every emoji and dingbat. Carry emphasis and structure in the words themselves, not in decoration.


### Bold-label-then-colon list items

`bold-label-colon-bullets` — **strong** · lintable

- **Why it signals AI:** The '- **Label:** explanation' bullet is one of the most recognizable LLM output shapes: every item front-loads a bolded abstract noun and a colon, turning prose into a mechanical glossary.

- **Detect:** Two or more consecutive bullets beginning with a bolded phrase immediately followed by a colon. One such item can be deliberate; a stack of them is the tell.

- **AI:** - **Discovery:** We map your workflow.
- **Build:** We wire up the automation.
- **Handoff:** We train your team.

- **Founder fix:** First we sit with your team and watch how the work actually moves today. Then we wire the automation around that, and we don't leave until they can run it without us in the room.

- **Rewrite rule:** Break the glossary bullets into varied prose or plain sentences. If a list genuinely helps, vary the opening word and length of each item and drop the bolded-noun-plus-colon scaffold. Keep a real bolded lead-in only when it is a one-off, not a stacked pattern.


### Copula avoidance (boasts, features a, serves as, prides itself on)

`copula-avoidance` — **strong** · lintable

- **Why it signals AI:** LLMs dodge plain 'is' and 'has' with promotional stand-ins (boasts, offers, features, serves as) to sound impressive. It reads like a brochure, not a person.

- **Detect:** A subject followed by boasts/features a/serves as/prides itself on/is home to where 'is' or 'has' would state the same fact.

- **AI:** Our agency boasts a team of specialists and offers a comprehensive suite of services.

- **Founder fix:** We're six people, and we do three things: automate your intake, your reporting, and your follow-ups.

- **Rewrite rule:** Replace the inflated verb with plain 'is', 'has', or 'we're', and state the fact directly. If the sentence still sounds like a brochure after the swap, cut it down to what a person would actually say out loud.


### Mechanical transition openers (Moreover, Furthermore, Firstly, In conclusion)

`mechanical-transition-openers` — **strong** · lintable

- **Why it signals AI:** AI signposts its own logic with formal connectives at sentence start. Human writing runs 8-15 explicit transitions per 1,500 words versus 25-40 in an AI draft. These almost never appear in spoken founder cadence, so a single one breaks register.

- **Detect:** A sentence begins with Moreover, Furthermore, Additionally, Firstly/Secondly/Lastly, or In conclusion.

- **AI:** Moreover, the setup takes under a week. Furthermore, your team needs no training.

- **Founder fix:** Setup runs under a week. Nobody on your team has to learn anything new.

- **Rewrite rule:** Delete the formal connective and let the sentences sit next to each other, or use a plain spoken bridge (And, So, But). Never enumerate with Firstly/Secondly — just say the things.


### Meta-commentary and signposting (in this article we'll explore, let's dive in)

`meta-commentary-signposting` — **strong** · lintable

- **Why it signals AI:** The model narrates the document instead of delivering it, a tutorial-script habit. 'In this article we'll explore' and 'let's dive in' are brochure scaffolding a founder talking to you would never say out loud. They delay the first real idea.

- **Detect:** Phrases that refer to the artifact or announce the next move instead of making it: in this post we'll cover, by the end of this guide, let's dive in, here's what you need to know, without further ado.

- **AI:** In this article, we'll explore how AI can transform your business operations.

- **Founder fix:** Here's how we cut one client's quote turnaround from two days to twenty minutes.

- **Rewrite rule:** Delete the announcement and open on the concrete thing itself — a named client, a number, the specific mess. Never tell the reader what the page is about to do; just do it.


### Mechanical mid-sentence boldface of key terms

`mechanical-prose-boldface` — **contextual**

- **Why it signals AI:** LLMs bold 'important' words inside running prose the way sales pages and READMEs do. Three bolded terms in one sentence reads as machine highlighting, not authorship. Founder voice carries emphasis in word choice and sentence order.

- **Detect:** Three or more bolded spans within a single paragraph of body prose. Frequency, not any single instance, is the flag.

- **AI:** We focus on **adoption**, not just **installation**, because **usage** is what actually pays for the software.

- **Founder fix:** We care about adoption, not just installation. Software nobody opens never pays for itself.

- **Rewrite rule:** Strip mid-sentence bolding from running prose and let the emphasis land through phrasing and sentence order. Leave at most one deliberate bold lead-in per section; never paint two or three terms in one sentence.


### Heading-restate warm-up line

`heading-restate-warmup` — **contextual**

- **Why it signals AI:** LLMs drop a one-line paraphrase of the heading directly under it as a throat-clear before real content. It pads the page and signals template-driven generation.

- **Detect:** The first sentence under a heading restates the heading in slightly longer form before any concrete content appears.

- **AI:** ## Why response time matters

Response time matters more than most owners realize.

- **Founder fix:** ## Why response time matters

A lead that waits four hours for a reply has usually already bought from someone faster.

- **Rewrite rule:** Delete the restatement line. Make the first sentence under a heading a concrete fact, number, or scene — never a paraphrase of the heading.


### Topic-runway filler (When it comes to X / The question of whether)

`topic-runway-filler` — **contextual** · lintable

- **Why it signals AI:** A high-frequency AI throat-clear that restates the topic as a warm-up before the real sentence. 'When it comes to X, there are many factors' is pure runway with no altitude. A founder starts on the noun itself.

- **Detect:** A sentence opens with or contains 'when it comes to X' or 'the question of whether X is a complex one' where the frame could be deleted with no loss.

- **AI:** When it comes to choosing an automation tool, there are many factors to consider.

- **Founder fix:** Pick the tool your team already lives in. If they're in Slack all day, automate inside Slack.

- **Rewrite rule:** Delete the runway frame and start on the noun with a concrete instruction or fact. 'When it comes to X' can be cut from the front of almost any sentence with zero loss — do it.


## Rhetorical

### Dramatic negation and rhetorical-question reveals (Not X. Not Y. Just Z. / The result? Fewer calls.)

`dramatic-negation-cadence` — **strong** · lintable

- **Why it signals AI:** AI builds artificial suspense: two or more staccato 'Not …' fragments before a 'Just Z' reveal, or a question nobody asked answered by a clipped one-to-three-word fragment (The result? Fewer missed calls). It's setup-then-reframe compressed for drama where a normal sentence would carry more information.

- **Detect:** Two or more consecutive fragments beginning with 'Not', or a short noun-phrase question ending in '?' immediately followed by a one-to-three-word fragment answer.

- **AI:** Not a plugin. Not a template. A system built around how you actually work. The result? Fewer missed calls.

- **Founder fix:** We don't hand you a template. We spend a day mapping how work moves through your shop, then build around that. One client went from losing six leads a week to none.

- **Rewrite rule:** Collapse the staccato negation or the question-and-reveal into one plain declarative sentence that carries the actual fact. A founder states the thing; he doesn't stage suspense. Keep a genuine rhetorical question only when it's a real question the reader is asking, answered by a full sentence.


### Significance puffery (a testament to / speaks to our commitment)

`significance-puffery-testament` — **strong** · lintable

- **Why it signals AI:** A flagged AI habit of inflating an arbitrary fact into proof of some larger virtue (commitment, dedication). The founder voice just names the number and what it buys the reader.

- **Detect:** 'a testament to', 'is a testament', 'speaks to our commitment/dedication' attached to a metric or feature.

- **AI:** Our 40% time savings is a testament to our commitment to results.

- **Founder fix:** Clients get about 40% of their week back. That's the number we sell on.

- **Rewrite rule:** Delete the virtue-inflation and let the number stand on its own, framed by what it buys the reader. Never present a fact as proof of your own 'commitment' — state the fact and stop.


### Trailing -ing participle depth (, enabling teams to scale)

`trailing-participle-editorializing` — **strong** · lintable

- **Why it signals AI:** AI tacks a present-participle clause onto a finished sentence to manufacture significance. It adds words, not information, and the founder cadence never trails off this way.

- **Detect:** A sentence ends with a comma plus an -ing verb phrase that editorializes about impact rather than stating a new fact.

- **AI:** The bot answers 40 percent of tickets on its own, empowering your team to focus on what matters most.

- **Founder fix:** The bot answers about 40 percent of tickets on its own. Your two support reps stopped working weekends.

- **Rewrite rule:** Cut the trailing participle clause. If it carried a real consequence, make it its own short sentence with a concrete detail; if it only editorialized, delete it entirely.


### Authority reframe (the real question is / at its core / here's the thing)

`authority-reframe` — **strong** · lintable

- **Why it signals AI:** These phrases pretend to cut through noise to a deeper truth, but the sentence after almost always restates an ordinary point with added ceremony. It's setup-then-reframe in stock-phrase form and clashes with a states-never-sells voice.

- **Detect:** A depth-signaling phrase preceding a claim that isn't actually deeper than a plain statement would be.

- **AI:** The real question isn't whether to adopt AI. It's whether your ops can keep up. At its core, what really matters is adoption.

- **Founder fix:** Most owners ask me which AI tool to buy. The tool's the easy part. It only works if the workflow underneath it does.

- **Rewrite rule:** Delete the depth-signaling phrase and either state the claim plainly or, better, replace it with the specific observation the ceremony was standing in for — a real thing you've seen owners get wrong. Never announce depth; demonstrate it with a concrete detail.


### Unsourced stats and vague authority (up to 40% / studies show / experts agree)

`unsourced-stats-vague-authority` — **strong** · lintable

- **Why it signals AI:** Models invent authoritative-sounding figures (up to 40%, 3x faster) with no source and borrow authority they can't cite by attributing claims to unnamed experts or studies. The specificity and the authority are both fake.

- **Detect:** A precise or 'up to X%' figure with no citation, link, or first-party origin, or 'studies show / experts agree / many businesses find' with no named source.

- **AI:** Studies show automation can boost productivity by up to 40%. Experts agree SMBs are falling behind.

- **Founder fix:** One client's ops lead used to burn every Friday reconciling invoices. Now it runs itself and she doesn't. Half the SMBs we talk to are still copy-pasting between two apps by hand.

- **Rewrite rule:** Replace borrowed authority with a first-party observation: what you've personally seen across the clients you've worked with. If you cite a real number, name the real source or the real client it came from. Never write 'studies show' or invent a percentage — if you don't have a sourced figure, tell a concrete first-hand story instead. Do not fabricate the story either; flag for the author if you have nothing real.


### Rhetorical-question hook (Have you ever wondered / What if I told you)

`rhetorical-question-hook` — **strong** · lintable

- **Why it signals AI:** 'Have you ever wondered' / 'What if I told you' are stock AI hooks that fake engagement without asserting anything. A founder with a real observation states it rather than asking the reader to supply it.

- **Detect:** A section opens with a reader-aimed question that could preface almost any topic.

- **AI:** Have you ever wondered why your team spends so much time on repetitive admin?

- **Founder fix:** Your ops manager spends two hours a day retyping quotes from email into the CRM. I've watched it happen.

- **Rewrite rule:** Turn the rhetorical question into the flat observation it's hiding, ideally anchored in something you've personally seen. State the pain as fact; don't ask the reader to imagine it.


### Not-X-but-Y antithesis and correlative reframe

`dismissive-antithesis` — **contextual** · lintable

- **Why it signals AI:** Negative parallelism that rejects a frame to assert a grander one manufactures false depth. Barron's found this construction in Fortune 500 filings grew from ~50 in 2023 to 200+ in 2025, tracking LLM adoption. Humans use antithesis to correct a real error; AI uses it where no error exists, purely for cadence, and reaches for 'not just X but Y' reflexively to inflate a plain capability.

- **Detect:** A clause negates a concept then reasserts a bigger version with no factual correction, or 'not just/only/merely X but (also) Y' inflating a plain action. Test: delete the negated half — if nothing factual is lost, or if you could simply list the actions, it's the tell.

- **AI:** It's not a chatbot, it's a teammate that never clocks out. Our system doesn't just answer the email; it also books the meeting.

- **Founder fix:** It answers your customers at 2am the way a sharp front-desk hire would, minus the salary. Our system answers the email, books the meeting, and updates your CRM.

- **Rewrite rule:** Keep genuine contrast where a real error is being corrected ('the call's Tuesday, not Thursday') and allow at most one deliberate founder contrast per page. Dissolve every mechanical or stacked instance: if the negated half carries no correction, delete it and just state what the thing does, or turn 'not just X but Y' into a plain list. This is a KEEP-the-good, cut-the-mechanical judgment, never a blanket delete.


### Mechanical rule of three (abstract triads and stacked tricola)

`mechanical-triads` — **contextual**

- **Why it signals AI:** AI forces ideas into groups of three to sound comprehensive, especially interchangeable abstract nouns (clarity, efficiency, growth). One concrete triad is human; the tell is the abstract triad that carries no specific claim, or two-plus adjacent sentences built on the identical parallel skeleton.

- **Detect:** Three parallel abstract nouns/gerunds joined by commas and 'and' where swapping in three different abstractions wouldn't change the meaning, or consecutive sentences sharing one syntactic template with only the nouns swapped.

- **AI:** We bring clarity, efficiency, and growth to every install. Tools save time; systems save teams. Tools cut costs; systems cut chaos.

- **Founder fix:** Most installs pay for themselves inside a quarter. That's the number I actually watch. A one-off tool saves you an afternoon; a system that ties your tools together saves you a hire.

- **Rewrite rule:** Keep a triad that names three concrete, load-bearing things (invoicing, scheduling, follow-ups). Dissolve any triad of interchangeable abstractions and never run two parallel-skeleton sentences back to back — break the symmetry with a different length and shape, or replace the whole run with one specific number.


### Concessive strawman pivot (Sure, X. But Y.)

`concessive-strawman-pivot` — **contextual** · lintable

- **Why it signals AI:** The softened cousin of negative parallelism: concede a strawman with Sure/Yes/Granted, then pivot on 'But' to the real point. One is human; the tell is using it as a reflexive opener section after section, which reads as debate-club scaffolding.

- **Detect:** A sentence opens with a concession token (Sure, Yes, Of course, True, Granted) followed by a 'But'-led pivot, used as a structural habit across multiple paragraphs.

- **AI:** Sure, off-the-shelf tools work. But they don't know your business.

- **Founder fix:** Off-the-shelf tools cover the generic 80 percent. The 20 percent that's specific to your shop is where they fall down, and that's what we build.

- **Rewrite rule:** Keep one genuine concession where you're honestly granting a real point. Cut the reflexive Sure/But scaffold when it's just staging a strawman: state the real tradeoff directly with numbers instead of conceding-then-pivoting.


### False range (from X to Y across non-comparable poles)

`false-range` — **contextual**

- **Why it signals AI:** AI uses 'from X to Y' to imply a spectrum when X and Y sit on no real scale (from invoicing to company culture). Legitimate ranges exist, so the tell is when nothing meaningful lies between the two poles.

- **Detect:** 'from A to B' where A and B are not endpoints of a genuine continuum. Test: can you name a midpoint? If not, it's decorative.

- **AI:** We handle everything from invoicing to company culture.

- **Founder fix:** We take the repetitive back-office work off your plate: invoicing, scheduling, data entry, follow-up emails.

- **Rewrite rule:** Replace the false range with a plain concrete list of the actual things. Keep 'from X to Y' only when a real midpoint exists (Monday to Friday, intake to invoice).


### Over-explaining the obvious (which basically means)

`over-explaining-obvious` — **contextual** · lintable

- **Why it signals AI:** Models define terms the target reader already knows to seem thorough. For a B2B owner audience, glossing 'CRM' or 'which basically means' insults the reader and pads the line.

- **Detect:** A common industry term followed by a parenthetical gloss or 'which basically/essentially means' that the actual reader would never need.

- **AI:** A CRM (Customer Relationship Management system, which basically means software that stores your contacts) helps you track leads.

- **Founder fix:** Your CRM already knows which leads went cold. Nobody's acting on it.

- **Rewrite rule:** Cut the gloss and trust the reader — an SMB owner knows what a CRM is. Only define a term the specific buyer genuinely wouldn't know, and then do it in-line without 'which basically means'.


### Audience-spanning opener (Whether you're X or Y / From startups to enterprises)

`audience-spanning-opener` — **contextual** · lintable

- **Why it signals AI:** The construction tries to address everyone at once, the statistically-safe widest-applicability move LLMs favor. Stacked at the top of a page it signals the writer refused to pick a reader. On a premium page that names one buyer, it reads generic.

- **Detect:** An opener or CTA that brackets the whole audience (Whether you're a [role] or [other role], From startups to enterprises) instead of naming the one buyer the page is for.

- **AI:** Whether you're a solo founder or running a 50-person team, our AI has you covered.

- **Founder fix:** This is for the 8-to-40-person shops where the owner still personally approves every invoice. That's who we build for.

- **Rewrite rule:** Pick the one buyer the page is actually for and name them with specifics — headcount, role, the exact situation. Cut the 'whether you're X or Y' bracket. Keep an inclusive phrasing only if the page genuinely serves both and you say why.


## Hedging

### Empty qualifier preface (it's important to note)

`empty-qualifier-preface` — **strong** · lintable

- **Why it signals AI:** RLHF rewards writing that sounds careful, so models front claims with a throat-clearing qualifier that carries zero information. A confident founder just says the thing.

- **Detect:** A sentence opening with 'it's important/worth/crucial to note/mention/remember' where deleting the whole preface loses no meaning.

- **AI:** It's important to note that most SMBs already have the data they need to automate.

- **Founder fix:** Most SMBs already have the data they need to automate. They just never wired it together.

- **Rewrite rule:** Delete the preface and lead with the claim. If the point genuinely needs weight, earn it with a specific fact right after, not with a phrase announcing that it matters.


### Mission-statement hedge (we believe / we're passionate / we're committed)

`mission-statement-hedge` — **strong** · lintable

- **Why it signals AI:** 'We believe', 'we're passionate about', 'we pride ourselves on' are mission-statement filler. The voice states what it does, so belief-framing reads as a brochure hedge covering a lack of specifics.

- **Detect:** A first-person-plural claim about values, belief, passion, or commitment instead of a concrete action, number, or outcome.

- **AI:** We believe in the power of AI, and we're passionate about helping businesses succeed.

- **Founder fix:** We only take clients we can move a number for in 90 days. If we can't find that number on the first call, we tell you.

- **Rewrite rule:** Replace every belief/passion/commitment statement with the concrete thing you actually do that proves it — a policy, a number, a guarantee, a line you draw. Show the commitment through an action; never announce it.


### Hedge stacking and the non-committal consultant answer (it depends / could potentially / pros and cons)

`hedge-stacking-noncommittal` — **contextual** · lintable

- **Why it signals AI:** Alignment over-softens output: a clause piles a modal on a hedging adverb (could potentially possibly), or manufactures balance so the paragraph ends in a shrug. 'It depends' that never says what it depends on is the model dodging commitment; for an agency it actively erodes authority.

- **Detect:** A modal directly beside a hedging adverb, or 'it depends / no one-size-fits-all / pros and cons' that is NOT immediately followed by the specific variables it turns on.

- **AI:** Automating intake could potentially help you possibly save some time. There's no one-size-fits-all answer, every business is different.

- **Founder fix:** Automate intake and you get about six hours a week back. For a 5-person shop, start with the inbox; past 50 people, start with the CRM. That's the whole rule.

- **Rewrite rule:** Commit to one degree of certainty per claim — drop the doubled hedge. When something genuinely depends, name the exact variables it turns on and give the decision rule (under X people do this, over it do that). Never end on a both-sides shrug; a founder takes the side and names the real tradeoff. Real caveats stay, but as a stated position, not a dodge.


## Rhythm

### Uniform bullet lists and symmetric paragraph blocks

`symmetric-blocks` — **strong**

- **Why it signals AI:** AI favors visual symmetry: bullets within a word or two of the same length all sharing one grammatical shape, and a wall of uniform 3-4 sentence paragraphs. Human founder writing is lumpy — a six-line paragraph, then a one-liner that lands.

- **Detect:** A bullet group where items are near-identical in length and all open with the same part of speech (often a clean set of exactly three), or a page where 80%+ of paragraphs are 3-4 sentences of similar height.

- **AI:** - Cut manual data entry
- Speed up your quotes
- Improve team morale

- **Founder fix:** The obvious win is killing the manual data entry. Quotes get faster too. And, though it's harder to put a number on, the team stops resenting the tool they're forced to use.

- **Rewrite rule:** Make lists and paragraphs lumpy on purpose. Let one bullet be a fragment, one run long with a caveat, one be a full sentence. Leave at least one one-sentence paragraph and one long one per page. Never ship a page that ticks like a metronome.


### Uniform sentence rhythm (low burstiness, no fragments or asides)

`uniform-sentence-rhythm` — **strong**

- **Why it signals AI:** LLMs generate toward the statistical middle, so sentences cluster in the same 12-22 word band with tidy subject-verb-object shape, no fragment, no aside, no self-interruption. Stylometry finds burstiness the single clearest human/AI separator, more reliable than vocabulary. Spoken founder cadence swings from two-word fragments to 40-word runs and drops asides.

- **Detect:** Take 8-10 consecutive sentences: if nearly all land in a 12-22 word range with no sub-6-word or 30+-word outlier, and every one is a complete clause with zero fragments or parenthetical asides, it ticks like a metronome. That uniform completeness is the tell.

- **AI:** We assess your current systems. We identify the key bottlenecks. We design a tailored solution. We implement the new workflow. We then measure the results.

- **Founder fix:** First we look at what you've actually got running. Usually it's a pile of spreadsheets and one overworked ops person holding the whole thing together. We find where it jams, build the fix, ship it, and then watch the numbers for a month to make sure it stuck.

- **Rewrite rule:** Deliberately vary sentence length: follow a long 30-word run with a two-word fragment, drop one genuine aside, let one sentence trail into a caveat. Read the section aloud — if it ticks like a metronome, break the rhythm. Do not add filler to lengthen; add real detail, or cut to a fragment.


### Mechanical anaphora (This means / This ensures / repeated openers)

`mechanical-anaphora` — **contextual** · lintable

- **Why it signals AI:** Deliberate anaphora is a real device, so this is contextual. It becomes a tell when three-plus consecutive sentences open with the identical subject+verb not for rising emphasis but because the model is padding parallel structure. The giveaway is that the repetition adds no altitude.

- **Detect:** Three or more consecutive sentences or bullets starting with the same one-to-three words (This means/ensures/allows, We build systems that, Whether you're) where dropping the repetition loses nothing.

- **AI:** This means faster response times. This ensures happier customers. This allows your team to focus on high-value work.

- **Founder fix:** Customers get an answer in minutes instead of Monday morning. Your team stops babysitting the inbox and gets their afternoons back.

- **Rewrite rule:** Keep anaphora only when each repeat genuinely raises the stakes. Otherwise merge the repeated openers into varied sentences with different subjects and lengths. 'This means/ensures/allows' stacked three deep is almost always padding — rewrite each into a concrete outcome.


## Opening-Closing

### Scene-setting era opener (In today's fast-paced world / the ever-evolving landscape / in the realm of)

`scene-setting-era-opener` — **strong** · lintable

- **Why it signals AI:** LLMs default to a universal, zero-risk establishing shot that applies to any topic and commits to nothing. Bloomberry's corpus lists 'In today's landscape / In a world where' as the single most frequent AI opening family, and editors flag it as the clearest sign nobody edited the draft. Spatial-metaphor frames (in the realm of, navigate the landscape) do the same distancing work.

- **Detect:** A page or section opens by describing the era, the market, or the world at large instead of a specific person, number, or situation, or uses 'in the realm/world of X' where X is the actual subject.

- **AI:** In today's fast-paced business world, small businesses are under more pressure than ever to do more with less.

- **Founder fix:** Most of the SMB owners we work with are quietly doing the job of three people. AI is how they stop.

- **Rewrite rule:** Cut the establishing shot and open on one specific person, number, or scene — the owner doing three jobs, the two hours a day lost to retyping. Never start with the era or the industry at large; start on the ground with someone real.


### Summary-restate conclusion (In conclusion / In summary / To sum up)

`summary-restate-conclusion` — **strong** · lintable

- **Why it signals AI:** LLMs close by labeling the closing and recapping the sections, the essay-template reflex editors call out most. A founder ends on a next move or a concrete stake.

- **Detect:** A closing paragraph begins with an explicit summary marker and restates points already made.

- **AI:** In conclusion, AI is a powerful tool that can help your business save time, cut costs, and grow.

- **Founder fix:** So start with the one task that eats your Mondays. Automate that, run it a month, then decide if you want more.

- **Rewrite rule:** Delete the summary marker and the recap. End on one concrete next move the reader can take this week, or a specific stake. Never restate what you already said.


### Vague-future close (the future is bright / path forward is clear / possibilities are endless)

`vague-future-close` — **strong** · lintable

- **Why it signals AI:** 'The future is bright / exciting times ahead / the path forward is clear' is the generic positive conclusion. It ties every thread in a neat bow and gestures at optimism with no fact behind it, sometimes threatening vaguely that laggards get 'left behind' instead of offering a concrete next step.

- **Detect:** A closing line promising a bright future, endless possibilities, or an obvious path forward without any date, number, or named next step.

- **AI:** The path forward is clear. Businesses that embrace AI will lead, and those that don't will be left behind.

- **Founder fix:** You don't have to bet the company on this. Pick one workflow, give it a month, keep what actually works.

- **Rewrite rule:** Replace the bright-future platitude with a specific, low-risk next step or a concrete thing you're actually doing next quarter. Never split the world into winners and the left-behind; give the reader one small move they can make and what it costs them.


### Faux-candor opener (Let's be honest / Here's the thing)

`faux-candor-opener` — **contextual** · lintable

- **Why it signals AI:** 'Let's be honest / Let's face it' perform intimacy to earn trust before saying anything real. A founder earns candor by naming the uncomfortable specific, not by announcing that candor is coming.

- **Detect:** A sentence opens by promising honesty or plain talk as a warm-up before a generic claim.

- **AI:** Let's be honest: running a small business is hard, and there's never enough time in the day.

- **Founder fix:** I've never met an SMB owner who thought their back office ran clean. It never does. That's not a failing, it's math.

- **Rewrite rule:** Delete the candor announcement and lead straight into the uncomfortable specific it was promising. If the next sentence is generic, the opener wasn't the real problem — write a sharper observation. Genuine spoken asides are fine; a formulaic 'Let's be honest' warm-up is not.


## Cta

### Inflated marketing CTA (take your business to the next level / unlock your potential)

`inflated-cta` — **strong** · lintable

- **Why it signals AI:** 'Take your business to the next level / unlock your potential / supercharge' are corporate-cliché CTAs sophisticated B2B buyers smell from a mile away. They promise transformation with zero concrete mechanism or offer.

- **Detect:** A CTA built on an inflated abstract verb plus generic object with no named action or deliverable.

- **AI:** Ready to take your business to the next level? Unlock your potential with AI today.

- **Founder fix:** Book a 30-minute call. We'll map one workflow worth automating and tell you straight if it pays for itself.

- **Rewrite rule:** Replace the inflated verb with the concrete offer: the exact next action, its length, and what the reader walks away with (a diagram, a cost estimate, a straight yes/no). State the mechanism; never promise transformation.


### Manufactured-urgency CTA (Get started today / Don't wait / Start your journey)

`manufactured-urgency-cta` — **contextual** · lintable

- **Why it signals AI:** 'Get started today / don't wait' is manufactured urgency with no reason attached, the statistically generic close. A quiet-confidence founder states the low-friction next step and lets it stand; urgency without a real deadline reads as selling.

- **Detect:** A CTA relying on a bare time-pressure imperative without a concrete offer, real deadline, or reason to act now.

- **AI:** Don't wait. Get started today and transform the way your team works!

- **Founder fix:** If you want, send us the one task you'd kill first. We'll tell you whether AI can actually take it off your plate.

- **Rewrite rule:** Drop the fake urgency and state the low-friction next step plainly, framed as the reader's choice ('if you want'). Only invoke a deadline if a real one exists. Let the offer stand on its own worth, not on pressure.


---

## Synthesis notes (over-correction warnings)

MERGE SUMMARY: 88 raw patterns collapsed to 46. Biggest merges — all 5 dash entries → em-dash-interrupt (hard_ban); 2 curly-quote entries → curly-quotes (hard_ban); the booster-verb / latinate-inflation / abstract-verb-plus-noun entries → booster-upgrade-verbs; the four hype-adjective/hype-noun/vague-hero entries → hollow-hype-adjectives; the AI-vocab-cluster split across figurative-nouns and hype-adjectives; three 'authority reframe' entries → authority-reframe; three generic-close entries (future-is-bright, path-forward, upbeat-CTA) → vague-future-close; meta-commentary + roadmap-intro + signposting → meta-commentary-signposting; 'it's not X it's Y' + 'not just X but Y' + hero reframe + negative parallelism → dismissive-antithesis; countdown-negation + rhetorical-question-fragment → dramatic-negation-cadence; single-triad + stacked-tricola + rule-of-three → mechanical-triads; uniform-length + no-fragments → uniform-sentence-rhythm; symmetric-bullets + symmetric-paragraphs → symmetric-blocks; stacked-modals + non-committal + both-sides → hedge-stacking-noncommittal. Dropped nothing outright — every raw signal survives inside a merged pattern.

SEVERITY DISCIPLINE: only the two typographic tells are hard_ban (em-dash family, curly quotes). Everything rhetorical is strong or contextual on purpose. Do not promote any rhetorical pattern to hard_ban; there is no rhetorical construction that is wrong 100% of the time in this voice.

CONTRAST IS KEEP-BY-DEFAULT — the single biggest over-correction risk. dismissive-antithesis, mechanical-triads, mechanical-anaphora, concessive-strawman-pivot and dramatic-negation-cadence all describe devices that GOOD founder writing uses. Their lint_regex fields are DETECTION AIDS for the humanizer to inspect candidates, never auto-delete triggers, and they are deliberately kept OUT of the pre-push gate. Rule for the skill: keep one genuine, load-bearing instance per page (a real correction, a concrete triad, rising-stakes anaphora) and only dissolve mechanical or stacked instances. A blanket strip of all contrast flattens the voice into the same mush we're removing.

GATE IS TYPOGRAPHIC-HEAVY BY DESIGN. lint_rules blocks a push on any match, so false positives cost a blocked deploy. That's why the gate is 4 typographic rules + 10 near-zero-FP phrase tells, and excludes higher-frequency patterns (when-it-comes-to, robust/seamless, not-just-but, it-depends, game-changer) that live only as pattern-level lint_regex. game-changer is intentionally NOT gated: it's authentic in a real client testimonial, and testimonials/quoted human speech must pass the gate untouched. Same reason em-dash's en-dash arm has a rare FP on a genuine numeric range written with an en dash (e.g. 2020–2024) — acceptable because the em-dash ban is mandatory and content here writes ranges with plain hyphens; the fix message tells the author to hyphenate.

REGEX CONSTRAINTS: gate regexes assume NO flags (no i, m, u, g). So (a) case variants are spelled out or use character classes, (b) line-anchored patterns use (^|\n) rather than relying on multiline ^, (c) emoji uses surrogate-high-byte ranges [\uD83C-\uD83E] which match without the u flag — verify the runner treats sources as JS RegExp without flags before trusting the anchored/heading rules.

FACTUAL-INPUT PATTERNS — critical honesty guard. category-placeholder-tool, placeholder-personas, unsourced-stats-vague-authority, vague-magnitude-no-number and the first-person-anecdote expectations all demand a REAL fact (a named tool, a real client, a sourced number, an actual story). The humanizer must NOT invent a client, a city, a percentage, or an integration to satisfy them — that trades an AI tell for a fabrication, which is worse and, on legal/pricing pages, dangerous. When the real fact is missing, flag it for the human author; leave the copy honestly vague rather than confidently false.

VOICE NEVER OVERRIDES LEGAL OR SEO (register policy). title-case-heading and colon-terminated-heading fixes must preserve the heading's target keyword — change case/punctuation only, don't strip the keyword chasing cadence. On legal pages, keep precise defined terms even when they read stiff; humanize the connective tissue around them, not the operative language. Scannability (headings, short paragraphs) is an SEO invariant — apply symmetric-blocks and uniform-sentence-rhythm to break metronomic rhythm, not to delete the scannable structure itself.

PATTERN INTERACTIONS: (1) uniform-sentence-rhythm + mechanical-anaphora + mechanical-triads + symmetric-blocks all touch rhythm/parallelism — fix them in ONE varied pass, not four sequential ones, or you'll over-flatten and strip every parallel structure including the good ones. (2) The dash fix (restructure into two sentences) naturally helps burstiness — do the dash pass first, then assess rhythm. (3) hollow-hype-adjectives and vague-magnitude-no-number both resolve the same way (attach a real spec/number); if a true number is already present, the adjective/adverb may be fine — don't strip a word that's doing real work next to a real figure.

## Deterministic lint candidates (reference only)

The research proposed regexes for many patterns. Only the three safest are wired into the blocking gate; the rest are recorded here as optional detection aids and are NOT enforced.

- `em-dash` — `[—–]`
- `double-hyphen-dash` — `\s--\s`
- `curly-quotes` — `[“”‘’]`
- `emoji-decoration` — `[\uD83C-\uD83E☀-➿⬀-⯿]`
- `figurative-abstraction-nouns` — `\b(tapestry|symphony|beacon|mosaic|kaleidoscope)\b`
- `significance-puffery-testament` — `\b(a testament to|stands as a testament|speaks to (our|its|their) (commitment|dedication))\b`
- `meta-commentary` — `\b[Ii]n this (article|post|guide|blog|piece)[, ]+(we|I)('ll| will)? ?(explore|explain|cover|dive|discuss|break down|walk|unpack)\b`
- `summary-restate-conclusion` — `\b(In conclusion|In summary|To sum up|To wrap up|All in all|In closing|To conclude)\b`
- `vague-future-close` — `\b(the future (is|looks) (bright|promising)|exciting times (lie )?ahead|the possibilities are endless|the (path|way) forward is clear)\b`
- `inflated-cta` — `\b(take your (business|company|team|brand) to the next level|unlock your (full |true )?potential|supercharge your \w+|revolutionize (your|the way) \w+)\b`
- `scene-setting-era` — `\b[Ii]n today'?s (fast-paced|ever-changing|ever-evolving|digital) (world|landscape|era|economy|market)\b`
- `empty-qualifier-preface` — `\b(it'?s|it is) (important|worth|crucial|essential) to (note|mention|remember|point out)\b`
- `signposting` — `\b(let'?s dive (in|into)|without further ado|here'?s what you need to know)\b`
- `vague-authority` — `\b(studies show|research shows|experts (agree|say)|it'?s widely (known|accepted))\b`
