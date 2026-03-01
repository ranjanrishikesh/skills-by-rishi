# Export — Docs Generation (Shared Phase)

This phase is shared by both REVIEW and CREATE modes. By this point, a finalized resume exists:
- **Review mode**: The revamped resume from Phase 6
- **Create mode**: The refined resume from Phase 7

After the resume is finalized and the user is satisfied with the content:

---

## Step 1: Create Output Directory

Create a `docs/` directory in the project root if it doesn't exist.

## Step 2: Write `docs/resume.md`

The complete, finalized resume content in clean markdown. This is the **single source of truth** — all other formats are derived from this file.

## Step 3: Write `docs/resume.html`

Convert the markdown resume into a polished, well-designed HTML file:

- **Self-contained single HTML file** (inline CSS, no external dependencies)
- **Clean, professional resume design** — proper typography, spacing, hierarchy
- **LIGHT MODE ONLY** — white or light background, dark text, subtle accent colors. Do NOT use dark backgrounds, dark themes, or inverted color schemes.
- Use a neutral color palette appropriate for a professional resume (e.g., white background, near-black text, one muted accent color for headers/lines)
- Responsive layout that looks good on screen and in print
- Proper `@media print` styles so printing from browser produces a clean result
- Sections clearly delineated with visual hierarchy (name prominent, section headers styled, bullets clean)
- This should look like a **designed resume**, not a raw markdown render

## Step 4: Write `docs/resume.pdf`

Generate an ATS-friendly PDF:

- Use the Bash tool to convert the HTML to PDF (try `weasyprint`, or `wkhtmltopdf`, or `chrome --headless --print-to-pdf` — use whichever is available on the system)
- ATS-friendly means: real text (not images), standard fonts, simple layout, no columns/tables for content flow, proper heading hierarchy
- If no PDF conversion tool is available, inform the user and suggest they print `docs/resume.html` to PDF from their browser

## Step 5: Confirm

Confirm all files are created and list them for the user:

```
Files generated:
- docs/resume.md  — Markdown source (single source of truth)
- docs/resume.html — Styled HTML (open in browser)
- docs/resume.pdf  — ATS-friendly PDF (ready to submit)
```
