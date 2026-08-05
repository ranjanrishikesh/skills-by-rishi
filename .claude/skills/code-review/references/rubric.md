# Rubric: which dimensions run

This runs **first**, before any reviewer is launched. Its job is to decide which dimensions apply to this change set, and to say so out loud.

A dimension that runs on an irrelevant change produces noise. A dimension that silently does not run produces false confidence, which is worse. So the rubric has one hard output rule: **it always reports what it ran and what it skipped, with the reason.** A reader must never have to guess whether a clean result means "checked and fine" or "never looked."

## Step 0: read the config

`review.config.json` at the repository root carries `classes` (which paths mean what here) and `dimensions` (which are switched on for this repo). Read it before anything else.

**If it is missing, stop and say so.** Do not fall back to a guessed layout. The version of this rubric that shipped with a hardcoded Next.js App Router table classified every file in every other kind of repository as `TOOLING`, which quietly exempted all of it from the Bugs dimension. A review that runs the wrong dimensions is worse than one that refuses, because it reports clean.

## Step 1: classify every changed file

Take the change set (tracked diff against the review base, plus untracked files). Assign each path one or more classes by matching it against the globs in `config.classes`. A file can carry several, and should.

The class names below are the ones the dimension mapping in Step 2 understands. A repo may define others; they are reported but map to nothing until Step 2 is told about them.

| Class | What it means | Typical globs |
|---|---|---|
| `UI-CODE` | anything that renders an interface | `components/**`, `src/components/**`, `app/**/*.tsx` |
| `LOGIC` | non-rendering code | `lib/**`, `src/**`, `pkg/**`, `internal/**`, API handlers |
| `CONTENT` | authored prose or data a person reads | `content/**`, `posts/**`, `data/**` |
| `HOOK-CODE` | executable scripts that gate the workflow itself | `.githooks/**`, `.claude/**/*.mjs`, `scripts/**` |
| `SEO-INFRA` | what a crawler reads | sitemap, robots, root layout, `metadata` exports |
| `DEPS` | the dependency set | any lockfile, `package.json`, `go.mod`, `Cargo.toml` |
| `CONFIG` | build and runtime configuration | `tsconfig.json`, framework configs, `.env*` |
| `TESTS` | the test suite | `test/**`, `tests/**`, `__tests__/**` |
| `TOOLING` | everything else | `docs/**`, `*.md` |

Notes:
- A file that exports page metadata is both `UI-CODE` and `SEO-INFRA`. Assign both.
- `HOOK-CODE` is separated from `TOOLING` deliberately. These are real executable programs that gate every push, and classing them as tooling exempts them from Bugs. A defect there either blocks every push or lets unreviewed code through, and both have happened.
- Untracked new files classify the same way, and always count. They are entirely new code and appear in no diff.
- If a path matches nothing in `config.classes`, class it `TOOLING` and **say which paths fell through**. A steady trickle of fall-through paths means the config's globs no longer describe the repo, and that is worth knowing before it hides something.

## Step 2: map classes to dimensions

A dimension runs when **both** are true: it is enabled in `config.dimensions`, and the change set carries a class that triggers it. Enabled-but-untriggered is a normal skip. Triggered-but-disabled is also a skip, and it is reported differently, because that one is a standing decision somebody made rather than a property of this change.

| Dimension | Brief | Runs when | Rationale |
|---|---|---|---|
| **Instructions compliance** | `dimensions/core/01` | Always | Any change can break a written rule, including a tooling change. |
| **Bugs** | `dimensions/core/02` | `UI-CODE`, `LOGIC`, `HOOK-CODE`, `SEO-INFRA`, `CONFIG`, `DEPS`, `TESTS` | Any code change. The dependency pass runs only if `DEPS` changed. Skip on content-only changes. |
| **Truth** | `dimensions/core/03` | Always | Part 1 needs any file with comments; Part 2 needs `CONTENT` or `UI-CODE`. Run whichever part applies and say which. |
| **Reuse** | `dimensions/core/04` | `UI-CODE`, `CONTENT`, or `LOGIC` | Duplication appears as a new component, a hardcoded value, or a re-declared type or constant. |
| **Discoverability** | `dimensions/web/05` | `CONTENT`, `SEO-INFRA`, or `UI-CODE` | Metadata, canonicals, sitemaps, headings and links live in **code**, so a pure code change can break search visibility with no content touched. |
| **Interface** | `dimensions/web/06` | `UI-CODE` or `CONTENT` | Content drives rendered layout, so a data edit can break a page visually or on mobile. |
| **Voice** | `dimensions/content/07` | `CONTENT`, or `UI-CODE` containing audience-facing copy | Voice binds to audience-facing text only. Requires `repoFacts.voiceSpec`. |
| **Keyword contract** | `dimensions/content/08` | `CONTENT` only | A keyword exists only in copy. Requires a keyword list; see the brief. |

The edge shapes worth stating explicitly:

- **Code-only change, no content.** Keyword and Voice skip. Discoverability still runs on a web repo, because its subject matter is in the code.
- **Content-only change, no code.** Bugs skips. Everything else that is enabled runs.
- **Hook or script change.** Bugs runs, via `HOOK-CODE`. The web and content dimensions all skip.
- **Pure docs or markdown change.** Only Instructions compliance and Truth Part 1. Do not launch the whole roster at a markdown file.
- **A repo with no web dimensions enabled.** This is most repos. Four dimensions is a complete review there, not a degraded one. Say the roster was four; do not apologise for it.

## Step 3: decide the render gate

Two dimensions need a live page: **Interface** (every pass) and **Discoverability** (Pass C, the audit, only that pass).

- If neither qualified, do not start a dev server. Most reviews should not.
- If either qualified, the parent starts **one** dev server, using `config.dev.run`, and passes `config.dev.url` to both. Never let each agent start its own.
- If either qualified and `config.dev` is null, they cannot render. Say so and run their source-only passes.
- Stop the server after all dimensions report. If one was already running, use it and do not stop it.

**If the render gate qualified but there is no attachable browser**, the qualified passes cannot run at all. That is every pass of Interface, and Pass C of Discoverability only: its other passes read the code rather than a rendered page, so they still run. Do not fake what cannot run and do not quietly drop it. Run everything else, then stamp in container mode. SKILL.md says how, and what the receipt then does and does not claim.

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
           classes: LOGIC, TESTS, DEPS
  Running: Instructions compliance, Bugs, Truth, Reuse
  Skipped: Interface, Discoverability  (disabled: not a web repo)
           Voice                       (disabled: no voiceSpec configured)
           Keyword                     (disabled)
  Gate:    lint -> test  (from review.config.json)
  Render:  not started (no dimension qualified)
```

Then launch one agent per running dimension, in parallel.

## Judgment

This table is the default, not a cage. If a change is obviously going to affect something the mapping did not predict, run that dimension and say why you added it. Adding a dimension with a stated reason is always acceptable. Dropping one is not.
