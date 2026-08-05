# Dimension: Keyword contract

## Trigger

**Run only when all three are true**: this dimension is enabled in `review.config.json`, `repoFacts.keywordList` names a file that exists, and the change set contains a content change.

If the keyword list is not configured, return an empty list and say the dimension did not apply. There is no fallback and there must not be one: a keyword reviewer with no list will invent a target from the page's own text, confirm the page matches it, and report success. That is a reviewer that cannot fail, which is the same as a reviewer that does nothing.

**This dimension is off by default, and most repos should leave it off.** It only makes sense where someone maintains a deliberate list of search terms the product competes for. It is shipped as a worked example of a bespoke, repo-specific dimension, so a team that has such a list can adapt it rather than inventing the shape from scratch. If you are reading this to decide whether to switch it on: switch it on only if you can name the file.

## What this dimension is

The only reviewer that asks whether this page is aimed at a term the repo has decided to compete for, and whether it is actually built to win it.

The keyword list is whatever `repoFacts.keywordList` names. **Read it fresh on every run.** It is maintained continuously and anything you remember about its contents from a previous run is stale. Never hardcode a keyword or a count.

## How to run it

**Step 1. Read the list.**

Read only the column that holds the target terms. A keyword file usually carries research columns beside it: volume, difficulty, intent, who currently ranks, what it would take. **Those are for deciding what belongs in the file, not for judging a page that already targets a row in it.** Re-deciding corpus selection at review time is not this reviewer's call, and it is the single most common way this dimension wanders out of scope.

If the file's format makes the target column ambiguous, say so and stop rather than guessing which column is the list.

**Step 2. Check the declared target.**

If the content format declares its own target (a `primaryKeyword` field or similar) and the repo validates it at build, then an off-list value reaching you means the build did not run. Say so and stop.

Your judgment starts where the build's ends: **is this the right row?** Read the page, decide what it is genuinely about, and say whether the declared row is the best fit. Name the runner-up you rejected and why.

Where a page declares nothing, selection is entirely your judgment call and it is the most important thing you do. Match on subject and on intent: a page selling something must not be matched to a purely informational row. If **no row fits**, that is itself the finding and a significant one, because the page competes for nothing anyone chose.

**Step 3. A shared row is usually correct. Look at the treatment instead.**

Many pages sharing one row can be deliberate design rather than cannibalisation. Find out which it is here before reporting anything: check whether the repo documents a pillar-and-support structure, or anything equivalent.

What actually splits rankings is two pages chasing one query with the same *shape*, and that lives in the title, the H1 and the slug. Check those:

- A **pillar** owns its row's exact phrase: exact match in title, H1, slug and the first 100 words.
- A **support** answers a distinct angle. Its title, H1 and slug reflect that angle, never the cluster phrase, and the phrase itself appears once or twice in the body where it is honest. A support whose title or slug has taken the exact phrase is a finding, because that is the pillar's.

Where the repo documents no such structure, two pages targeting one phrase with the same shape is a plain duplicate and should be reported as one.

**Step 4. Check placement.**
- The row or a close variant appears in the body naturally, at a rate a reader would not notice. Stuffing is a finding in the other direction.
- Semantically related terms are present, so the page reads as genuinely about the subject rather than as a phrase repeated.
- A support links up to its pillar with the cluster phrase as anchor text, where that pillar exists. This is what tells a search engine which page in the set is the canonical answer, and it is the mechanism that makes a shared row safe.

**Step 5. Check for a real duplicate.**
A shared target is not automatically one. What to search for instead: two pages answering the same question, two titles chasing the same query, or a support whose angle duplicates a sibling's. Report with both file paths.

## Severity

Use the four tiers in `references/severity.md`: **Critical**, **High**, **Low**, **Minor**. That file is authoritative; where the wording below differs, it wins. Assign a fix class (Mechanical, Constrained, Judgment) from the same file. Mapped for this dimension:

- **Critical**: no row in the list fits the page at all, so it competes for nothing anyone chose. On a page that declares its own target, an off-list value (which also means the build did not run).
- **High**: a support whose title, H1 or slug has taken its cluster's exact phrase, which belongs to the pillar; a declared role or angle disagreeing with the plan file; or two pages answering the same question.
- **Low**: placement gaps. On a pillar, the phrase missing from title, H1, slug or opening. On a support, no link up to an existing pillar.
- **Minor**: thin semantic coverage, or the cluster phrase never appearing in a support's body at all.

## Known false positives for this dimension

- **Many pages sharing one target, where the repo documents that as the design.** Check before flagging.
- A support post whose title contains none of its cluster phrase. Correct: the title answers the angle.
- A page arguing against buying the thing its cluster names. Honesty is not a keyword mismatch.
- Volume, difficulty or SERP composition. Out of scope, per Step 1.
- Legal and utility pages. They target nothing and are out of scope.
- Keyword absence from a page that is not meant to rank.
- Demanding an exact-match phrase so hard that the copy would read badly. The prescription asks for exact match in the title and H1, not in every sentence.
- Technical SEO defects. The Discoverability dimension owns metadata length, canonical, sitemap, and link integrity.
- Voice and phrasing quality. The Voice dimension.
- Pre-existing keyword problems on pages the change set did not touch.

## Output

Return a list of issues. For each: the file and line, the row you matched and whether the page declared it or you inferred it, the runner-up you rejected, the role and angle if the repo uses them, one sentence naming the defect, and the severity above. State the matched keyword for every reviewed page even when you found no issue, so the reader can check your selection. Your match is a judgment call, and an unstated judgment call cannot be corrected.

## Budget

You have a tool-call budget, given in your prompt. Spend it on the highest-yield checks above first. **Reason from reading; do not build test harnesses.**

If you run out, stop and list what you did not reach. A review that names its own gaps is honest; one that quietly ran out of road is not.

## Beyond the list

The checklist above is the floor, not the ceiling, but the floor has a hard edge on one side: **do not reason from any column other than the target list itself.** Research columns are excluded deliberately, and "the row's own columns imply a requirement" is the back door they would return through.

Everything else is open. If a page is aimed at a row it cannot serve for a reason this brief does not name, report it and tag it `unlisted`.
