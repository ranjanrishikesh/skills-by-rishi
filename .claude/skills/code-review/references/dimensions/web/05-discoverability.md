# Dimension: Discoverability

## What this dimension is

Whether this page can be found, understood, and quoted by a machine. Three passes, one dimension, because they share a subject and increasingly share an audience:

- **Pass A, crawlability.** Can a search engine reach it and index it correctly.
- **Pass B, extractability.** Can an answer engine lift a clean answer from it and attribute it. Search volume is shifting to generated answers, so ranking without being quotable is half a result.
- **Pass C, Lighthouse.** The machine-measured audit, which grades things no amount of reading catches.

You are **not** the keyword reviewer. The Keyword contract dimension owns which term a page targets and whether the copy is optimised for it. You own everything that would matter even if the page targeted no keyword at all. If you find yourself counting how often a phrase appears, stop.

You are also not the accessibility reviewer. Lighthouse reports an accessibility category; **ignore it**. The Interface dimension renders and operates the page and owns that ground. Reporting it here double-counts.

## How to run it

1. Identify changed content files, metadata definitions, and SEO infrastructure: `app/sitemap.ts`, `app/robots.ts`, `app/layout.tsx`, `components/seo/json-ld.tsx`, and any `metadata` or `generateMetadata` export.
2. Map changed content to URLs using `references/routes.md`.
3. Read the **generated** metadata, not just the JSON source, since page metadata is assembled in the route handler.
4. Run all three passes.

---

## Pass A: crawlability

**Metadata**
- Title exists, is unique across the site, roughly 50 to 60 characters. Longer gets truncated in the SERP.
- Meta description exists, is unique, roughly 140 to 160 characters.
- Canonical URL present and pointing at the page's own absolute URL, not a duplicate or stale path.
- **`metadataBase` is set in the root layout.** Without it, relative canonical URLs and Open Graph image paths resolve incorrectly in production. This is the single most common Next.js App Router SEO defect.
- No `noindex` on a page meant to rank, and no missing `noindex` on one that should not be.
- Open Graph and Twitter fields resolve, and any referenced image path exists.

**Structure**
- Exactly one `h1` per page.
- Heading levels descend without skipping. An `h2` followed by an `h4` is a finding.
- Every image has meaningful `alt`, or empty `alt` if genuinely decorative.

**Structured data**
- JSON-LD parses as valid JSON and uses a real schema.org type.
- Required properties present. For articles that means `headline`, `author`, `datePublished`, `dateModified`, `publisher`. Prefer `author` as a **Person entity**, not a bare name string.
- The structured data agrees with the visible page. Schema claiming an FAQ the page does not show is a violation, and a serious one.

**Crawlability**
- New routes appear in `app/sitemap.ts`, and removed routes are gone from it.
- `app/robots.ts` does not block anything meant to be indexed.
- Every internal link resolves to a real route. Run `pnpm links` rather than checking by hand: it derives the live route set from `content/` and fails on anything that does not resolve. It also lists orphans and dead ends, which are warnings rather than errors.
- What the script cannot catch, and you can: a link that resolves to the **wrong** live route. `/services/agent-evals` where `/services/custom-ai-agents` was meant passes every automated check there is, so read the anchor text against its destination.

---

## Pass B: extractability

Work question-first. For each page, write down the question a person would ask that this page should answer, then check the page answers it in a way a model can lift.

**Answer shape**
- A direct answer within roughly the first 100 words, before the setup and the story. A page that takes six paragraphs to say what it is will not be quoted.
- Each section answers one question completely, so a model can lift that section alone.
- Question-shaped headings matching how people actually phrase the question.
- Definitions as clean declarative sentences that survive being quoted out of context.

**Extractable structures**
- Comparisons as tables rather than prose.
- Sequences as ordered lists with real steps.
- An FAQ block on pages answering several related questions.
- A number, its unit, and what it measures sitting together. A figure in one sentence and its unit two sentences later cannot be extracted correctly.

**Attribution and trust**
- Every statistic, claim, and quote has a named, dated source a model can cite.
- Claims are self-contained. "As we mentioned above, this doubled" is unquotable.
- No unsourced superlatives. A model has no reason to repeat "the leading approach."
- **Freshness is a live ranking input.** The large majority of AI citations go to pages updated within the past year. A substantive edit that leaves `dateModified` stale is a finding.

**Machine agreement**
- FAQ schema must match the visible questions and answers in substance. Schema promising answers the page does not contain is worse than no schema.
- Article or Service schema must agree with the actual content type.

---

## Pass C: Lighthouse

Only when a dev server base URL was given to you. If none was, skip this pass and say so.

1. Load the tool with `ToolSearch` (query `select:mcp__chrome-devtools__lighthouse_audit,mcp__chrome-devtools__navigate_page`).
2. Run it against the affected URLs, capped at three. It is slow, so choose the pages the change most affects.
3. Report from the **SEO**, **Performance**, and **Best Practices** categories. **Skip Accessibility**, which belongs to Interface.

What to act on:
- Any failed SEO audit, cross-checked against Pass A. If Lighthouse and your own reading disagree, say so rather than picking one silently.
- Core Web Vitals against the 2026 thresholds: **LCP under 2.5s, INP under 200ms, CLS under 0.1.** INP is the most commonly failed of the three.
- Best Practices failures that are real: console errors, insecure requests, deprecated APIs.

Lighthouse runs against a **dev** server here, so absolute performance numbers are not production numbers. Treat a poor score as a signal to look, not as a finding on its own. Report a performance finding only when you can name the cause in the change set. A slow dev build is not a defect.

---

## Severity

Use the four tiers in `references/severity.md`. Mapped for this dimension:

- **Critical**: the page cannot be indexed; it is missing from the sitemap when it should be present; structured data contradicts what a visitor sees.
- **High**: no title, no description, no canonical, `metadataBase` unset, a duplicate title against another page, an internal link that 404s, a statistic with no attributable source, no direct answer on a page whose whole purpose is to answer something.
- **Low**: length overruns, heading order, missing alt text, prose where a table belongs, headings that do not match real phrasing, stale `dateModified`.
- **Minor**: refinements to phrasing or structure that a reasonable person could decline.

## Known false positives

- Absent Open Graph images where the site has a global fallback. Check the fallback before flagging.
- Length guidance treated as law. A few characters over is not a finding on its own.
- Pages that are not meant to answer a question. A pricing page or a service overview has a different job. Do not force an FAQ onto everything.
- Missing FAQ schema on a page with a single subject.
- Narrative or opinion writing where a conversational opening is the point.
- Lighthouse performance numbers from a dev server, absent an identified cause in the change set.
- The Lighthouse accessibility category. Not yours.
- Keyword phrasing, placement, or density. The Keyword contract dimension.
- Voice and tone. The Voice dimension, and duplicating it here is noise.
- Pre-existing metadata or content problems on pages the change set did not touch.

Note on sitemap exclusions: do **not** assume `/privacy` and `/terms` are excluded. `app/sitemap.ts` currently lists both in `staticRoutes`. Verify what the file actually contains before treating any absence as intentional.

## Output

Return a list of issues. For each: the file and line, the URL affected, which pass found it, one sentence naming the defect, the tier and fix class per `references/severity.md`, and what a crawler or answer engine does wrong as a result. State which URLs you audited with Lighthouse and which you skipped.

## Budget

You have a tool-call budget, given in your prompt. Spend it on the highest-yield checks above first. **Reason from reading the code; do not build test harnesses by default.** Construct a test only when a Critical or High finding turns on runtime behaviour you cannot settle by reading, and say so when you do.

If you run out, stop and list what you did not reach. A review that names its own gaps is honest; one that quietly ran out of road is not.

## Beyond the list

The checklist above is the floor, not the ceiling, and this ground moves faster than the rest of the review. If you find a concrete reason a crawler or an answer engine would fail to index, understand, quote, or attribute this page, and no bullet names it, report it tagged `unlisted` with one line on the mechanism.
