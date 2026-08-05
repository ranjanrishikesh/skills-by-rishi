# Installing code-review into a repository

## One command

From the repository you want to review, run the installer out of wherever you cloned this:

```bash
node /path/to/skills-by-rishi/.claude/skills/code-review/scripts/install.mjs
```

It copies the skill into `.claude/skills/code-review/`, detects your stack, writes `review.config.json`, and arms the publish gate. Then:

```bash
git add .claude review.config.json .githooks && git commit -m "Add code-review skill"
```

**Commit all of it.** The hook, the config and the skill reference each other by path. A clone missing any of them has no gate.

### Flags

| Flag | Effect |
|---|---|
| `--dry-run` | Print what it would do. Changes nothing. |
| `--no-hooks` | Config only. The review works; nothing enforces it. |
| `--no-vendor` | Do not copy the skill in. The hook then points at an absolute path outside the repo, which works on your machine and nobody else's. |
| `--force` | Overwrite an existing config and refresh a vendored copy. |
| `--uninstall` | Remove the hook block. Leaves your config and any hook it chained into. |

## The first thing to do afterwards

**Open `review.config.json` and read the `gate` array.** Detection reads your `package.json` scripts (or `Cargo.toml`, `go.mod`, `pyproject.toml`) and proposes what it found, in cheapest-first order. It cannot know that your `test` script needs a database container, or that `build` takes eleven minutes, or that the step you actually care about is called something it did not look for.

The order is load-bearing: steps run in sequence and stop at the first failure, and anything marked `needsBuild` must sit after the build step.

If a step does not belong there, delete it. An empty `gate` is honest and the review says so; a gate step that fails for environmental reasons trains you to ignore the gate.

## What got installed where

| Path | What it is | Commit it? |
|---|---|---|
| `.claude/skills/code-review/` | the skill | yes |
| `review.config.json` | everything repo-specific | yes |
| `.githooks/pre-push` | the authoritative gate | yes, if the installer created it |
| `.claude/settings.json` | advisory PreToolUse hook, Claude Code only | yes |
| `.git/<receiptName>` | the review receipt | no, and it cannot be. It lives under `.git/` on purpose: it is local proof about local state. |

### One command per clone

`core.hooksPath` is local git config and is never committed. Every fresh clone needs:

```bash
git config core.hooksPath .githooks
```

Put it in whatever your project already runs on install. For npm-family projects that is a `prepare` script:

```json
"scripts": { "prepare": "git config core.hooksPath .githooks || true" }
```

Until someone runs it, that clone has the advisory hook only, which does not run for a human terminal or for CI.

### If you already use husky or lefthook

Git allows one hooks directory per repository, and they have claimed it. The installer detects this and **chains into your existing `pre-push` instead of replacing it**, inserting before a trailing `exit 0` so the block still runs. Nothing you had is removed, and `core.hooksPath` is left alone. Re-running the installer replaces its own fenced block rather than stacking a second copy.

## Switching the optional dimensions on

Four dimensions are on by default: instructions compliance, bugs, truth, reuse. That is a complete review for most repositories.

| To enable | Do this |
|---|---|
| **Discoverability, Interface** | Auto-enabled when a web framework is detected. They need `dev` set to a working dev server command and URL, and a browser the agent can drive. |
| **Voice** | Copy `templates/voice-spec.md` into your repo, fill it in, point `repoFacts.voiceSpec` at it, set `dimensions.voice` to true. |
| **Keyword contract** | Point `repoFacts.keywordList` at your keyword file and set `dimensions["keyword-contract"]` to true. Most repos should leave this off; it ships as a worked example of a bespoke dimension. |

Both content dimensions refuse to run without their source file, on purpose. A voice reviewer with no spec corrects toward whatever register the model defaults to. A keyword reviewer with no list infers a target from the page and then confirms the page matches it.

## Switching the tell scan on

The gate enforces the review receipt out of the box. The **tell scan** is separate and starts off, because a punctuation ruleset nobody chose should not begin blocking pushes on day one.

To enable it, set `publishGate.scanDirs` to the directories holding your authored prose, and `scanExt` to the extensions. The shipped ruleset at `templates/ai-tells-lint.json` blocks three things: the em-dash, the spaced double-hyphen, and curly quotes. Read it and delete any rule you disagree with. A blocking rule nobody believes in gets bypassed with `--no-verify`, and that habit costs you the receipt check too.

## Uninstalling

```bash
node .claude/skills/code-review/scripts/install.mjs --uninstall
```

Removes the hook block. Your config and the skill directory stay; delete them by hand if you want them gone.

## Troubleshooting

**Every push is blocked with "the change set could not be determined."**
The gate fails closed by design. Its base branch does not resolve. Check `baseBranch` in `review.config.json` against `git branch -r`, then `git fetch`. On a shallow clone, `git fetch --unshallow`.

**"no review.config.json in this repository."**
The gate is armed but the config is gone. Restore it or run `--uninstall`.

**The gate never fires.**
`git config --get core.hooksPath` and confirm a `pre-push` there mentions `publish-checks.mjs`. A fresh clone that never ran the per-clone command is the usual cause.

**The review says it reviewed nothing.**
Expected when nothing changed since the last stamp. `scope` reports `mode: "none"`. Pass `full` to review the whole branch again.
