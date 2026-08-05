# Severity tiers and fix authority

One ladder for every dimension. A finding from Bugs and a finding from Voice must mean the same thing when they both say "High", otherwise the sorted list is meaningless and the reader learns to ignore the labels.

Every dimension uses these four tiers and no others. Where a brief still describes its own scale, this file wins.

## The four tiers

**CRITICAL** , it ships broken, untrue, or unsafe. A visitor hits it, or the claim is false, or the thing that was supposed to be protected is not. Judged by outcome, not by how interesting the defect is.

**HIGH** , a real defect with a real consequence, but bounded. It degrades rather than breaks: a path some users hit, a control weaker than it looks, a rule violated where the damage is contained.

**LOW** , real, verified, and small. Correctness of detail, internal consistency, maintainability. Nobody's day is ruined, but it is genuinely wrong and someone will trip on it later.

**MINOR** , polish and judgment. Defensible either way. A reasonable engineer could decline it and be right.

Two rules that keep the ladder honest:

- **Rank by outcome, never by category.** A security-shaped finding on an unreachable path is not Critical because the word "security" appears. A boring typo in a URL that 404s for every visitor is.
- **If you cannot write the concrete failure scenario, drop one tier.** If you still cannot, you do not have a finding.

## What blocks

- **CRITICAL and HIGH** are fixed in the same pass, before the PR opens, always.
- **LOW and MINOR** are **not** fixed automatically. Each is reported with a concrete recommended fix attached, and the founder decides. Reporting one is a proposal, never a bare list.

The split is deliberate, and it is not about how hard the fixes are. Auto-fixing a Minor finding spends the founder's review attention on something a reasonable engineer could have declined, and it pads the fix diff so the fixes that actually mattered are harder to find in it. A Critical costs more to carry than any amount of churn to fix. A Minor costs less to carry than the churn.

Nothing blocks indefinitely, because Critical and High are fixed in the same pass rather than bounced back for another review.

## Reporting order

Always Critical, then High, then Low, then Minor. Within a tier, most severe first. Never group by dimension: the reader wants to know what to fix next, not which agent was busiest.

## Fix authority: the second axis

Severity says how much a finding matters. It does **not** say who should fix it. Those are different questions, and treating them as one is the common mistake.

A Critical finding with one obvious correct fix is safer to apply automatically than a Minor one that turns on taste. So every finding also carries a fix class:

**MECHANICAL** , exactly one correct fix, and it is verifiable. A path that does not resolve, a stale comment, a missing alt attribute, a hardcoded value that has an exact existing token, a route missing from the sitemap, a wrong number copied from a source of record.

**CONSTRAINED** , the fix is clear in kind, but two or three reasonable shapes exist. Add a guard versus change the signature. Extend a component versus add a variant. The reviewer picks one, applies it, and states what it chose and why, so the choice is reviewable rather than buried.

**JUDGMENT** , the right answer depends on intent, product, business fact, or taste. Whether a price is correct. Whether two components are the same concept or merely the same shape. Whether copy is on-brand. Whether an abstraction is premature. **These are never fixed automatically, at any severity.**

## Who fixes what

Every **CRITICAL and HIGH** finding is fixed **by the strong tier, in the same pass, and is not re-reviewed**. Low and Minor are reported with a recommendation instead. Severity decides what gets fixed; the fix class decides how much the fixer has to explain itself.

"Strong tier" means the most capable model the host offers, resolved through `models.fix` and `modelIds` in `review.config.json`. The tier is the contract here, not any particular model name: the reason fixes are trusted without a second reading is that they were applied by a stronger model than the one that found them, and that relationship has to survive every model release.

| | Mechanical | Constrained | Judgment |
|---|---|---|---|
| **Critical** | Strong fixes | Strong fixes, states the choice | Strong fixes, states the choice |
| **High** | Strong fixes | Strong fixes, states the choice | Strong fixes, states the choice |
| **Low** | Report + recommend | Report + recommend | Report + recommend |
| **Minor** | Report + recommend | Report + recommend | Report + recommend |

A recommendation is not "consider fixing this". It names the specific edit, at the file and line, and says whether to take it. "Delete the local `slugify()` and import `slugifyHeading` from `@/lib/utils`; byte-identical today, and this is the drift class that produced finding 4. Take it." A reader must be able to approve or veto without opening the file.

**Except: factual claims that only the repo's owner can settle. Those always stop and ask, at every tier, including Critical.**

Concretely, that means prices, dates, headcount, client and customer names, contractual terms, legal statements, security commitments, published metrics, and anything else whose truth lives outside the repository. `repoFacts.sourcesOfRecord` in `review.config.json` names the files that hold the ones this repo has written down; a claim traceable to one of those is checkable and is not an escalation. A claim traceable to nothing is.

That exception is about authority, not capability. A stronger model does not know what this company charges or which customers exist, and a confident wrong number on a live page costs more than any defect this review catches. Everything else, including judgment calls about abstraction, naming, structure and taste, is the fixing model's to make.

## Rules for anything fixed

1. **Re-run the deterministic gate afterwards.** Every step in `gate` in `review.config.json`, in order. Not a re-review: deterministic, zero false positives, and usually seconds. A fix that breaks the build is worse than the finding it closed. If the repo declares no gate, say so rather than implying one ran.
2. **List every fix.** Trusted is not the same as invisible. The reader is entitled to see what was rewritten.
3. **Never delete a guard, a check or a test** to make a finding go away.
4. **Stop at scale, counting only what you fix, and counting decisions rather than files.** The cap is **10 CRITICAL and HIGH findings**. Low and Minor are reported rather than fixed, so they never consume it.

   Count decisions, not files. One Mechanical fix repeated across many call sites (a constant swapped at twelve of them) is **one** finding and one decision, not twelve. The guard exists to bound how much unreviewed *judgment* lands in a single pass, and a find-and-replace carries none.

   If the Critical and High set still exceeds 10: **fix every CRITICAL regardless**, then report the High ones with their recommendations and say which were deferred and why. A Critical is never carried for being inconvenient to reach.

   Two real incidents produced this wording, in the repository this skill was extracted from. First, the original rule counted every tier, so a review with 7 findings across ~17 files tripped its cap on the strength of the Low and Minor entries and fixed **nothing**, including a Critical that made the footer's Privacy and Terms links unclickable on every page. Second, the replacement still counted raw files, which would have deferred five High findings because one of them swapped a single constant at twelve call sites. A scale guard that lets polish findings veto a Critical fix, or lets a find-and-replace exhaust the budget, is worse than no guard.
