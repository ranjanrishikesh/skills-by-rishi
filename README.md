# Skills by Rishi

A growing collection of custom [Claude Code](https://docs.anthropic.com/en/docs/claude-code) skills that extend Claude's capabilities for real-world tasks. Drop them into any project and use them via slash commands.

## Setup

1. Clone this repo:

   ```bash
   git clone https://github.com/your-username/skills-by-rishi.git
   cd skills-by-rishi
   ```

2. Create the output directory, for the skills that produce files:

   ```bash
   mkdir -p working-dir
   ```

3. Open the project in Claude Code. Skills in `.claude/skills/` are automatically detected.

4. Run any skill using its slash command (see table below).

> **Important:** `working-dir/` must exist before running any skill that writes output. Create it once and you're set.

Skills come in two shapes here. Most run inside this repo and write to `working-dir/`. **Code review is the exception**: it installs itself into another repository and runs there. Its section below says how.

## Skills

| Skill | Command | What it does |
|---|---|---|
| **Resume** | `/resume` | Reviews, critiques, and rewrites existing resumes — or builds one from scratch. Includes adversarial evaluation (devil's advocate with 3 personas), ATS optimization, and multi-format export (MD, HTML, PDF). |
| **Code review** | `/code-review` | Multi-agent review of your working diff, run before the PR exists. Runs your build gate first, picks which review dimensions apply, then one reviewer per dimension in parallel. Fixes what is Critical or High in the same pass and recommends the rest. Installs a git pre-push hook so an unreviewed change cannot be pushed. Works in any repo and under any agent. |

> More skills coming soon. Watch or star the repo to stay updated.

## Code review

Unlike the other skills, this one installs into whatever repository you want it to review, rather than running out of this one.

```bash
cd /your/project
node /path/to/skills-by-rishi/.claude/skills/code-review/scripts/install.mjs
```

It copies itself in, detects your stack, writes `review.config.json`, and arms a `pre-push` hook. Then run `/code-review` before you open a PR.

- Everything repo-specific lives in one file, `review.config.json`: base branch, gate commands, what your paths mean, which dimensions are on, which model tiers to use.
- Enforcement is a git hook, so it works under any agent, in a bare terminal, and in CI. Only the fast-feedback half is Claude Code-specific.
- Detection is verified before anything is armed. If your base branch does not resolve, it refuses to install rather than shipping you a gate that blocks every push.
- If husky or lefthook already owns your hooks path, it chains into your existing hook rather than replacing it.

Full instructions in [`INSTALL.md`](.claude/skills/code-review/INSTALL.md). Notes on other agents in [`PORTING.md`](.claude/skills/code-review/PORTING.md).

## How Skills Work

Each skill lives in `.claude/skills/<skill-name>/` and contains:

- `SKILL.md` — The skill definition (what Claude follows when you invoke it)
- `references/` — Supporting reference files the skill reads during execution
- `scripts/`, `templates/` — where a skill ships executable parts or files you copy and fill in

Output goes to `working-dir/<skill-name>/`, for the skills that produce files. Skills create subdirectories as needed.

> Note on filenames: Claude Code's documented convention is `SKILL.md`, uppercase. The `resume` skill currently uses `skill.md`, which works on case-insensitive filesystems (macOS, Windows) and may not be discovered on Linux. New skills here use the uppercase name.

## Requirements

- [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code) installed and authenticated
- Some skills may need additional tools (e.g., Chrome or `weasyprint` for PDF generation) — each skill will tell you if something is missing

## Contributing

Have an idea for a skill? Open an issue. Want to improve an existing one? PRs welcome.

## License

MIT
