# Voice rewriting pass

Moved here from the former `humanize` skill, which no longer exists as a separate skill.
This is the **fix** half of the voice system.

The **detect** half is the Voice dimension of `/code-review` (`../dimensions/07-voice.md`),
which reports tells and deliberately never rewrites. Read this when you need to actually
rewrite flagged copy. The tell catalog (`ai-tells-catalog.md`) and the canonical voice spec
(`voice-and-tone.md`) sit beside it.

There is no slash command for this. Follow the procedure below directly.

---

Turn AI-shaped copy into copy that reads like the agentclaw founder actually wrote it, and remove every AI writing tell before it ships. This is the enforcement of `voice-and-tone.md`.

## When this runs (and when it must NOT)

- **It does not run during normal work.** Drafting, building pages, writing content — you work normally, like any AI agent. This is a reference document, not a skill. It never triggers itself.
- **It runs at the publish boundary.** The `PreToolUse` gate (`.claude/hooks/humanizer-gate.mjs`) blocks a `git push` / `gh pr create` when banned tells remain in the diff and instructs you to run this skill. That is the trigger.
- **It runs on explicit request.** On named files, on the current publish diff, or as a full-site sweep.

## Required reading (load these first, every run)

1. `voice-and-tone.md` — the binding voice: three pillars (unmistakable / provocative confidence / spoken founder cadence), the **uniform full-register ruling**, and the hard rules. This is the target you rewrite toward.
2. `ai-tells-catalog.md` — the detect-and-rewrite catalog: every tell, its detection signal, and the founder-voice rewrite rule. This is *how* you fix.

## Modes

| Invocation | Target files |
|---|---|
| Named files | exactly those files |
| No target given | the publish set: `git diff --name-only --diff-filter=ACMR origin/main...HEAD` plus working-tree changes, filtered to `content/**`, `components/**`, `app/**` (`.json/.ts/.tsx/.md/.mdx`) |
| Full-site sweep | every audience-facing file under `content/`, `components/`, `app/`. This is the deliberate full-site sweep — it produces a large diff, so it is founder-reviewed section-by-section (Decision #18). Do not run it silently as part of a push. |

## The process (per file)

1. **Read the file.** For JSON content, understand which string values are audience-facing prose versus functional fields.
2. **Detect** every tell using the catalog — both the hard-bans (em-dash, hype words) and the contextual ones (negative parallelism, triads, filler).
3. **Rewrite into founder voice.** Apply the three pillars and the catalog's `rewrite_rule` for each hit. Rewrites are real rewrites, not deletions or punctuation swaps:
   - **Em-dash:** never present in the output. Do not swap it for a comma or en-dash — restructure so no dash was ever needed. Usually: split into two sentences, or reorder so the aside becomes its own clause. (Detection is exhaustive because the gate hard-blocks any remaining em-dash.)
   - **"It's not X, it's Y" / negative parallelism:** this is catalog entry `dismissive-antithesis`, folded into this one skill — it is not a separate tool. Use judgment: **keep** genuine founder contrast (the repo already has good ones, e.g. "Not one backlog, but a stream"); **dissolve** the mechanical/stacked ones into a plain assertion or a concrete example. Never leave the reflexive, hollow version.
   - **Rule-of-three, filler ("it's worth noting"), hype vocab, uniform rhythm:** per catalog. Vary sentence length hard; make the client's team the hero; prefer the concrete verb.
4. **Respect the invariants** (voice governs register, never facts/function):
   - **JSON:** only rewrite audience-facing prose *values*. Never touch keys, slugs, URLs, `type`, `surface`, `tags`, `publishedAt`, enum-like fields, or component prop names. Keep the JSON valid.
      - **Legal pages:** keep every statement legally accurate and complete.
   - **Meaning:** never invent facts, claims, numbers, or client names. Rewrite what's there; don't fabricate.
5. **Verify.** After rewriting, re-scan for hard-bans. The fastest check is to run the same gate scanner logic; at minimum grep the changed files for the em-dash character and confirm zero. Confirm the JSON still parses.
6. **Write back** in place.

## Content-integrity invariants (repo-specific — a violation breaks the build or the site)

Verified against this repo. Honor them on every file:

- **`titleAccent` must stay a substring of `title`.** `hero-page` blocks carry a `title` and a `titleAccent` that must be an exact substring of it (enforced by `PageDocSchema.superRefine` in `lib/content/types.ts`). Reword a hero title and you must update `titleAccent` to a phrase that still appears verbatim in the new title, or `pnpm build` fails.
- **Never touch links.** Do not change any `href`, `fileHref`, or markdown `[text](url)` target. Nothing in the build validates links, so a broken one ships silently. You may reword visible link *text*, never the target.
- **Never rewrite locked brand copy (Decision #10).** "Same team. Double the output." and "We install AI into how your company already works." are fixed. They live in `app/(home)/content.ts`, `components/site/footer.tsx`, `app/layout.tsx` (title + JSON-LD slogan), `app/opengraph-image.tsx`, and `lib/config.ts` (`tagline`). Humanize the copy around them; leave the pitch verbatim.
- **JSON edits are value-only.** Rewrite audience-facing prose *values*. Never keys, `type`, `surface`, `tags`, `publishedAt`, slugs, or enum fields. Keep the JSON valid and re-check it parses.
- **No HTML, watch markdown.** `md` fields render through react-markdown with no `rehype-raw`, so any HTML becomes literal visible text. Do not introduce raw HTML, and do not introduce stray markdown metacharacters (`#`, `|`, backticks, `[`) that would change rendering.
- **Drafts are not build-checked.** Entries with `meta.draft: true` are excluded from `pnpm build`, so a humanized draft is not validated automatically. Verify those by hand.
- **Verify with `pnpm build`.** After a batch, `pnpm build` runs the schema over every published page; it is the real content validator. Then the push gate must come back clean.

### Copy that lives in code, not `content/`
Some audience copy is hard-coded in `components/` and `app/` and is in scope for the relevant batch (surveys, chrome, metadata). Rewrite the real prose there: form questions, quiz options, result/verdict text, error and empty states, page metadata `title`/`description`, JSON-LD, OG alt. Do NOT touch code identifiers, comments, server `console.log` strings, single-word UI labels (nav items, "Continue", "Back", "Download"), or numeric-range en-dashes (`1–9`, `$2,500–$5,000`).

## After content is humanized (publish flow)

When invoked from the publish gate (or whenever preparing to push/PR), after the content is clean:

1. **Run `/code-review`** on the diff. Humanization and code review stay separate engines (different failure modes) but co-trigger here.
2. **Fix every finding** code review reports.
3. **Retry the publish.** The gate re-scans; a clean diff passes.

## Report

End with a short, plain summary: files touched, count of each tell removed, any contextual "not X/but Y" you deliberately kept and why, and confirmation the gate scan is clean.
