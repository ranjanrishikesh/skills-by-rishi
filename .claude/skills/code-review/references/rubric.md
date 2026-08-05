# Rubric: which dimensions run

This runs **first**, before any reviewer is launched. Its job is to decide which dimensions apply to this change set, and to say so out loud.

A dimension that runs on an irrelevant change produces noise. A dimension that silently does not run produces false confidence, which is worse. So the rubric has one hard output rule: **it always reports what it ran and what it skipped, with the reason.** A reader must never have to guess whether a clean result means "checked and fine" or "never looked."

## Step 1: classify every changed file

Take the change set (tracked diff against the merge base, plus untracked files). Assign each path one or more classes. A file can carry several.

| Class | Matches |
|---|---|
| `CONTENT` | `content/**` |
| `UI-CODE` | `components/**`, `app/**/*.tsx`, `app/**/*.css`, `app/globals.css` |
| `LOGIC` | `lib/**`, `app/api/**`, any `.ts` that is not a component |
| `HOOK-CODE` | `.claude/hooks/**/*.mjs`, `.claude/hooks/**/*.js`, and any other executable script under `.claude/` |
| `SEO-INFRA` | `app/sitemap.ts`, `app/robots.ts`, `app/layout.tsx`, `components/seo/**`, any `metadata` or `generateMetadata` export |
| `DEPS` | `package.json`, `pnpm-lock.yaml` |
| `CONFIG` | `next.config.*`, `tsconfig.json`, `postcss.config.*`, `.env*` |
| `TOOLING` | `.claude/**` that is not `HOOK-CODE`, `docs/**`, `*.md`, scripts |

Notes:
- A `.tsx` under `app/` that exports `metadata` is both `UI-CODE` and `SEO-INFRA`. Assign both.
- `HOOK-CODE` exists because `.claude/hooks/*.mjs` is real executable JavaScript that gates every push. Classing it as `TOOLING` would exempt it from Bugs, and a defect there either blocks every push or lets unreviewed code through.
- Untracked new files classify the same way, and always count. They are entirely new code.
- If a path matches nothing, class it `TOOLING` and say so.

## Step 2: map classes to dimensions

| Dimension | Runs when | Rationale |
|---|---|---|
| **CLAUDE.md compliance** | Always | Any change can break a written rule, including a tooling change. |
| **Bugs** | `UI-CODE`, `LOGIC`, `HOOK-CODE`, `SEO-INFRA`, `CONFIG`, `DEPS` | Any code change. Pass C runs only if `DEPS` changed. Skip on content-only changes. |
| **Truth** | Always | Part 1 needs any file with comments; Part 2 needs `CONTENT` or `UI-CODE`. Run whichever part applies and say which. |
| **Discoverability** | `CONTENT`, `SEO-INFRA`, or `UI-CODE` | Metadata, canonical, sitemap, schema, headings and links live in **code**, so a pure code change can break search and answer-engine visibility with no content touched. |
| **Interface** | `UI-CODE` or `CONTENT` | Content drives rendered layout, so a JSON edit can break a page visually or on mobile. |
| **Keyword contract** | `CONTENT` only | A keyword exists only in copy. A code change cannot alter which term a page targets. |
| **Voice** | `CONTENT`, or `UI-CODE` containing audience-facing copy | Voice binds to audience-facing text only. |
| **Reuse** | `UI-CODE`, `CONTENT`, or `LOGIC` | Duplication appears as a new component, a new block type, a hardcoded value, or a re-declared type or constant. |

The edge shapes worth stating explicitly:

- **Code-only change, no content.** Keyword and Voice skip. Discoverability still runs, because its subject matter is in the code.
- **Content-only change, no code.** Bugs skips. Everything else runs.
- **Hook or script change.** Bugs runs, via `HOOK-CODE`. Interface, Discoverability, Keyword and Voice all skip.
- **Pure docs or markdown change.** Only CLAUDE.md compliance and Truth Part 1. Do not launch the whole roster at a markdown file.

## Step 3: decide the render gate

Two dimensions need a live page: **Interface** (every pass) and **Discoverability** (Pass C, Lighthouse, only that pass).

- If neither qualified, do not start a dev server. Most reviews should not.
- If either qualified, the parent starts **one** dev server before dispatch and passes the base URL to both. Never let each agent start its own.
- Stop the server after all dimensions report. If one was already running, use it and do not stop it.

**If the render gate qualified but there is no attachable browser** (the `mcp__chrome-devtools__*` tools are not present, which is the normal state in a container), the qualified passes cannot run at all. That is every pass of Interface, and Pass C of Discoverability only: Passes A and B read the code rather than a rendered page, so they still run. Do not fake what cannot run and do not quietly drop it. Run everything else, then stamp in container mode: SKILL.md step 14 says how, and what the receipt then does and does not claim.

## Step 4: measure the size

Count changed lines, and separate them by kind. Raw totals mislead: a 2000-line change that is 1500 lines of lockfile is not a 2000-line review.

- Report the total, and the subtotal of hand-written code.
- Under 400 lines of code: proceed normally.
- Over 400: proceed, but state the count and note findings are less complete than usual. Defect detection degrades sharply past that point. Do not imply a coverage you do not have.
- Over 2000: say plainly that this change set is too large for one review to be reliable, run anyway, and recommend splitting.

## Step 5: announce the plan

Before launching anything, print the plan:

```
Rubric
  Scope:   <n> files, <n> lines (<n> hand-written code)
           classes: CONTENT, UI-CODE, ...
  Running: CLAUDE.md compliance, Bugs, Truth, Reuse
  Skipped: Interface, Discoverability  (no UI-CODE or CONTENT)
           Keyword                     (no CONTENT change)
           Voice                       (no audience-facing copy)
  Render:  not started (no dimension qualified)
```

Then launch one agent per running dimension, in parallel.

## Judgment

This table is the default, not a cage. If a change is obviously going to affect something the mapping did not predict, run that dimension and say why you added it. Adding a dimension with a stated reason is always acceptable. Dropping one is not.
