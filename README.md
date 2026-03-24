# Skills by Rishi

A growing collection of custom [Claude Code](https://docs.anthropic.com/en/docs/claude-code) skills that extend Claude's capabilities for real-world tasks. Drop them into any project and use them via slash commands.

## Setup

1. Clone this repo:

   ```bash
   git clone https://github.com/your-username/skills-by-rishi.git
   cd skills-by-rishi
   ```

2. Create the output directory. All skills write their output here:

   ```bash
   mkdir -p working-dir
   ```

3. Open the project in Claude Code. Skills in `.claude/skills/` are automatically detected.

4. Run any skill using its slash command (see table below).

> **Important:** The `working-dir/` directory must exist before running any skill. Create it once and you're set.

## Skills

| Skill | Command | What it does |
|---|---|---|
| **Resume** | `/resume` | Reviews, critiques, and rewrites existing resumes — or builds one from scratch. Includes adversarial evaluation (devil's advocate with 3 personas), ATS optimization, and multi-format export (MD, HTML, PDF). |

> More skills coming soon. Watch or star the repo to stay updated.

## How Skills Work

Each skill lives in `.claude/skills/<skill-name>/` and contains:

- `skill.md` — The skill definition (what Claude follows when you invoke it)
- `references/` — Supporting reference files the skill reads during execution

Output from all skills goes to `working-dir/<skill-name>/`. Skills create subdirectories as needed.

## Requirements

- [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code) installed and authenticated
- Some skills may need additional tools (e.g., Chrome or `weasyprint` for PDF generation) — each skill will tell you if something is missing

## Contributing

Have an idea for a skill? Open an issue. Want to improve an existing one? PRs welcome.

## License

MIT
