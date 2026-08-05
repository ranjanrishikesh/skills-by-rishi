# Running this on agents other than Claude Code

## What is actually agent-specific

Less than it looks. The parts that enforce anything are plain Node and plain git:

| Piece | Depends on | Portable? |
|---|---|---|
| `scripts/review-receipt.mjs` | git, node | yes, entirely |
| `scripts/publish-checks.mjs` | git, node | yes, entirely |
| `scripts/config.mjs`, `scripts/install.mjs` | git, node | yes, entirely |
| `.githooks/pre-push` | git | yes. **Git runs it, not an agent.** |
| `scripts/pretooluse-gate.mjs` | Claude Code's `PreToolUse` hook | no. This is the only file that is. |
| `SKILL.md` frontmatter | Claude Code's skill format | needs translating |
| The review itself | subagents, model selection | degrades, see below |

**The important consequence: enforcement is already agent-agnostic.** The receipt requirement and the tell scan are enforced by a git hook that runs on the real push, on any machine, under any agent, in a bare terminal and in CI. Nothing about that changes when you switch agents. What changes is how the *review* runs.

Do not port enforcement logic into the harness-specific file to make another agent work. Port the git hook, which is already done for you.

## The four capabilities, and what to do without each

`SKILL.md` step 0 asks the agent to take stock of its own host before starting. This is that list.

### Parallel subagents

Used to run one reviewer per dimension at once, and one confidence scorer per finding.

**Without them:** run the dimensions sequentially in the main context, in rubric order, and say so in the report and on the receipt. The findings are the same; the wall clock is the sum rather than the max, and the context is shared rather than isolated. Shared context is the real cost: a reviewer that has already read four other briefs is a worse reader of the fifth. Consider running fewer dimensions per invocation rather than all of them badly.

### Per-agent model selection

Steps 5, 6 and 9 want a fast tier. Step 8 wants a mid tier. Step 12 wants the strongest available.

**Without it:** everything runs on one model. Say so in the report, because **step 12's "fixes are not re-reviewed" rule is safe only because of the tier inversion**. Finding is recognition and parallelises; fixing is a change to working code where a wrong edit is worse than the finding it closed. Take that inversion away and the rule is still followed, but the quality control behind it is gone, and the reader is entitled to know.

Set `models` and `modelIds` in `review.config.json` to whatever your host offers:

```json
"models":   { "scan": "fast", "review": "mid", "fix": "strong" },
"modelIds": { "fast": "<id>", "mid": "<id>", "strong": "<id>" }
```

Leave `modelIds` empty to let the host decide.

### A structured findings tool

Claude Code has one and renders findings in its UI.

**Without it:** the reply is the whole report. `SKILL.md` step 13 already requires the full tier-ordered list in the reply regardless, precisely because a tool call is a record and not a guaranteed presentation. Nothing is lost but the panel.

### A browser

Interface and Discoverability's audit pass need one.

**Without it:** container mode, which is built in and documented in `SKILL.md` step 14. The receipt records `mode: "container"` and the skip list, both publish gates read it and say plainly that nothing rendered the change, and the publish is allowed. A container review is never later mistaken for a full one.

## Translating the skill file

`SKILL.md` is Claude Code's format: YAML frontmatter with `name`, `description`, `argument-hint`, `allowed-tools`. The body below the frontmatter is ordinary markdown and is the actual instruction set.

- **Codex / AGENTS.md-style agents:** the body works as-is. Reference it from `AGENTS.md` or paste it into a custom command. Drop `allowed-tools`; approve the commands through whatever that agent uses.
- **Cursor:** put the body in `.cursor/rules/` or a custom mode. Same content.
- **Anything else:** the body is the skill. The frontmatter is packaging.

Keep one copy. Two copies of a 300-line instruction file drift within a month, and the half that drifts is always the one you are not looking at.

## What a port must not quietly change

Four things carry the design and are easy to lose in translation:

1. **The tier inversion in steps 8 and 12.** Weaker model finds, stronger model fixes, no re-review. Inverting it produces a loop that does not terminate.
2. **The confidence filter at step 10.** Drop below 80. Without it the report fills with plausible-sounding noise and stops being read.
3. **The Critical/High versus Low/Minor split at step 12.** Auto-fixing polish buries the fixes that mattered inside a larger diff.
4. **Saying what did not run.** Every degradation above is acceptable. Every *silent* degradation is not, because a clean report that never looked is worse than no report.
