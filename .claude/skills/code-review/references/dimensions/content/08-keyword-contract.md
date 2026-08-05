# Dimension: Keyword contract

## Trigger

**Run only when the change set contains a content change.** Content means `content/**`, or a component that renders audience-facing copy. A change confined to `lib/`, `app/api/`, configuration, tooling, or this skill is not in scope. If the change set has no content change, return an empty finding list and say the dimension did not apply. Do not stretch to find work.

## What this dimension is

The only reviewer that asks whether this page is aimed at a term we have decided to compete for, and whether it is actually built to win it.

The keyword list is `docs/seo/keywords.csv`. CLAUDE.md makes it the single source of truth for keyword scope. **Read it fresh on every run.** It is maintained continuously and anything you remember about its contents from a previous run is stale. Never hardcode a keyword or a count.

## How to run it

**Step 1. Read the list.**
Read the `keyword` column of `docs/seo/keywords.csv`, and only that column:

```bash
python3 -c "import csv;[print(r['keyword']) for r in csv.DictReader(open('docs/seo/keywords.csv'))]"
```

That column is the target list and the whole of your scope. The other eleven columns (volume, difficulty, intent, who ranks now, what it would take) belong to corpus and plan work, deciding which terms go in the file. Founder ruling of 2026-08-02: they are not evidence for or against a page, and re-deciding corpus selection at review time is not this reviewer's call.

Every row is in scope. There is no grade column and no keyword is out of bounds.

**Step 2. Check the declared row.**
`meta.primaryKeyword` is the `keywords.csv` row the page works for. On blog posts it is required and validated at build (`lib/content/blog.ts`), along with `keywordRole` and, for a support, `angle`. So a blog post reaching you with an off-list keyword means the build did not run; say so and stop.

Your judgment starts where the build's ends: **is this the right row?** Read the page, decide what it is genuinely about, and say whether the declared row is the best fit. Name the runner-up you rejected and why. Then check `keywordRole` and `angle` against the post's row in `docs/seo/blogs-to-write/blogs.csv`.

pSEO and service pages declare nothing today, so for those, selection is entirely your judgment call and it is the most important thing you do. Match on subject and on intent: a page selling a service must not be matched to an informational row. If **no row fits**, that is itself the finding and a significant one, because the page competes for nothing we chose to win.

**Step 3. A shared row is correct. Look at the treatment instead.**
Roughly a dozen posts share each row by design. So two pages declaring one `primaryKeyword` is not cannibalisation and is not a finding.

What splits rankings is two pages chasing one query with the same shape, and that lives in the title, the H1 and the slug. Check those:

- A **pillar** owns its row's exact phrase: exact match in title, H1, slug and the first 100 words.
- A **support** answers its `angle`. Its title, H1 and slug reflect the angle, never the cluster phrase, and the phrase itself appears once or twice in the body where it is honest. A support whose title or slug has taken the exact phrase is a finding, because that is the pillar's.

The build already enforces one pillar per cluster and unique angles across the collection, so those reach you only on an unbuilt draft.

**Step 4. Check placement.**
- The row or a close variant appears in the body naturally, at a rate a reader would not notice. Stuffing is a finding in the other direction.
- Semantically related terms are present, so the page reads as genuinely about the subject rather than as a phrase repeated.
- A support links up to its pillar with the cluster phrase as anchor text, where that pillar exists. This is what tells a search engine which page in the set is the canonical answer, and it is the mechanism that makes a shared row safe.

**Step 5. Check for a real duplicate.**
A shared `primaryKeyword` is not one. What to search for instead: two posts answering the same question, two titles chasing the same query, or a support whose angle duplicates a sibling's. Report with both file paths.

## Severity

Use the four tiers in `references/severity.md`: **Critical**, **High**, **Low**, **Minor**. That file is authoritative; where the wording below differs, it wins. Assign a fix class (Mechanical, Constrained, Judgment) from the same file. Mapped for this dimension:

- **Critical**: no row in the list fits the page at all, so it competes for nothing we chose to win. On a blog post, an off-list `meta.primaryKeyword` (which also means the build did not run).
- **High**: a support whose title, H1 or slug has taken its cluster's exact phrase, which belongs to the pillar; a `keywordRole` or `angle` disagreeing with the post's row in `blogs.csv`; or two posts answering the same question.
- **Low**: placement gaps. On a pillar, the phrase missing from title, H1, slug or opening. On a support, no link up to an existing pillar.
- **Minor**: thin semantic coverage, or the cluster phrase never appearing in a support's body at all.

## Known false positives for this dimension

- **A dozen posts sharing one `primaryKeyword`. That is the design, not a collision.**
- A support post whose title contains none of its cluster phrase. Correct: the title answers the angle.
- A post arguing against buying the service its cluster names. That is the house's honesty rule, not a keyword mismatch.
- Volume, difficulty or SERP composition. Out of scope for this dimension since 2026-08-02.
- Legal and utility pages. `/privacy` and `/terms` target nothing and are out of scope.
- Keyword absence from a page that is not meant to rank.
- Demanding an exact-match phrase so hard that the copy would read badly. The prescription asks for exact match in the title and H1, not in every sentence.
- Technical SEO defects. the SEO dimension owns metadata length, canonical, sitemap, and link integrity.
- Answer shape and citation. the AEO dimension.
- Pre-existing keyword problems on pages the change set did not touch.

## Output

Return a list of issues. For each: the file and line, the row you matched and whether the page declared it or you inferred it, the runner-up you rejected, the `keywordRole` and `angle`, one sentence naming the defect, and the severity above. State the matched keyword for every reviewed page even when you found no issue, so the reader can check your selection. Your match is a judgment call, and an unstated judgment call cannot be corrected.

## Budget

You have a tool-call budget, given in your prompt. Spend it on the highest-yield checks above first. **Reason from reading the code; do not build test harnesses by default.** Construct a test only when a Critical or High finding turns on runtime behaviour you cannot settle by reading, and say so when you do.

If you run out, stop and list what you did not reach. A review that names its own gaps is honest; one that quietly ran out of road is not.

## Beyond the list

The checklist above is the floor, not the ceiling, but the floor has a hard edge on one side: **do not reason from any column other than `keyword`.** Volume, difficulty and SERP composition were removed from this dimension's scope deliberately, and "the row's own columns imply a requirement" is the back door they would return through.

Everything else is open. If a page is aimed at a row it cannot serve for a reason this brief does not name, report it and tag it `unlisted`.
