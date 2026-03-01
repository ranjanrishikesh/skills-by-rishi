# Export — Docs Generation (Shared Phase)

This phase is shared by both REVIEW and CREATE modes. By this point, a finalized resume exists:
- **Review mode**: The revamped resume from Phase 6
- **Create mode**: The refined resume from Phase 7

After the resume is finalized and the user is satisfied with the content:

---

## Step 1: Determine Output Directory

The output directory follows this structure:

```
<project-root>/working-dir/resume/<persons-name>/
```

- `<project-root>` is the root of the project / repository where the skill was invoked.
- `working-dir` is a fixed folder name inside the project root.
- `resume` is a fixed folder name inside `working-dir`.
- `<persons-name>` is the user's full name extracted from the resume content (e.g., from the `# [Full Name]` heading), converted to lowercase with spaces replaced by hyphens (e.g., `john-doe`, `priya-sharma`).

Create the full directory path if it doesn't exist.

**Example**: If the project root is `/Users/rishi/projects/career` and the person's name is "Neha Gupta", the output goes to:
```
/Users/rishi/projects/career/working-dir/resume/neha-gupta/
```

## Step 2: Write `resume.md`

Write `working-dir/resume/<persons-name>/resume.md` — the complete, finalized resume content in clean markdown. This is the **single source of truth** — all other formats are derived from this file.

## Step 3: Write `resume.html`

Write `working-dir/resume/<persons-name>/resume.html` — convert the markdown resume into a polished, well-designed HTML file:

- **Self-contained single HTML file** (inline CSS, no external dependencies)
- **Clean, professional resume design** — proper typography, spacing, hierarchy
- **LIGHT MODE ONLY** — white or light background, dark text, subtle accent colors. Do NOT use dark backgrounds, dark themes, or inverted color schemes.
- Use a neutral color palette appropriate for a professional resume (e.g., white background, near-black text, one muted accent color for headers/lines)
- Responsive layout that looks good on screen and in print
- Proper `@media print` styles so printing from browser produces a clean result
- Sections clearly delineated with visual hierarchy (name prominent, section headers styled, bullets clean)
- This should look like a **designed resume**, not a raw markdown render

## Step 4: Write `resume.pdf`

Write `working-dir/resume/<persons-name>/resume.pdf` — generate an ATS-friendly PDF:

- Use the Bash tool to convert the HTML to PDF (try `weasyprint`, or `wkhtmltopdf`, or `chrome --headless --print-to-pdf` — use whichever is available on the system)
- ATS-friendly means: real text (not images), standard fonts, simple layout, no columns/tables for content flow, proper heading hierarchy
- If no PDF conversion tool is available, inform the user and suggest they print the HTML file to PDF from their browser

## Step 5: Confirm

Confirm all files are created and list them for the user:

```
Files generated:
- working-dir/resume/<persons-name>/resume.md   — Markdown source (single source of truth)
- working-dir/resume/<persons-name>/resume.html — Styled HTML (open in browser)
- working-dir/resume/<persons-name>/resume.pdf  — ATS-friendly PDF (ready to submit)
```
