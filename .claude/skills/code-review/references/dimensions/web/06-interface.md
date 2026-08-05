# Dimension: Interface

## What this dimension is

The reviewer that renders the page and judges it as a person would meet it. It covers both halves of that: **what it looks like** and **how it behaves**.

They are one dimension because they need the same expensive thing, a live browser, and splitting them meant two agents loading the same pages twice to answer questions about the same screen. One agent, one session, two passes.

This dimension exists because a diff cannot show you a broken layout or a focus trap. A change that reads perfectly in JSON can render as overlapping text at 375px, or look right and be unusable by keyboard. Source review cannot catch either. Rendering can.

## How to run it

1. You are given a base URL. Do not start or stop a server. See `references/routes.md`.
2. Resolve which URLs the change affects using `references/routes.md`. Cap at five.
3. Load the Chrome DevTools tools with `ToolSearch` (query `select:mcp__chrome-devtools__navigate_page,mcp__chrome-devtools__take_screenshot,mcp__chrome-devtools__resize_page,mcp__chrome-devtools__evaluate_script,mcp__chrome-devtools__take_snapshot,mcp__chrome-devtools__click,mcp__chrome-devtools__hover,mcp__chrome-devtools__press_key,mcp__chrome-devtools__fill,mcp__chrome-devtools__list_console_messages,mcp__chrome-devtools__emulate`).
4. For each URL run **Pass A** then **Pass B** before moving to the next, so you only load each page once.

---

## Pass A: appearance

Screenshot at **1440** and **375** wide at minimum. Those two catch most of what breaks; 768 is worth adding when the change touches layout. **Look at the screenshots.** Do not describe the DOM back to yourself and call it a review.

**Layout**
- Text or elements overlapping, clipped, or escaping their container
- Horizontal overflow at 375. Very common and always a finding.
- Broken alignment against the surrounding grid
- An element collapsing to zero height, or stretching absurdly, when its content is unusually short or long
- Images at the wrong aspect ratio, squashed, or missing
- Z-index conflicts putting the wrong thing on top

**Typography**
- Line length running past roughly 75 characters in body copy
- Heading hierarchy that is visually flat, so a subhead reads as body
- Orphans and widows in display type
- Font fallback flashing, or the wrong face rendering
- Line-height drift and font-weight inconsistency between sibling elements

**Colour and surface**
- Contrast against the measured floors documented in the header comment of `app/globals.css`. Read that comment. Those numbers were measured, and CLAUDE.md requires re-measuring before changing them, so treat them as the standard rather than reaching for a generic WCAG value.
- Palette drift. The site is Ember Slash, dark surfaces only. A light surface or an off-palette accent is a finding.
- Nested border radii that do not sit concentrically, harsh borders, banded gradients

**Readability**

Two separate things, and a page can pass one and fail the other.

*Legibility, which you can measure in the browser:*
- Body text at least 16px. Smaller is a finding, not a style choice.
- Body line-height at least 1.5. Headings can be tighter.
- Line length between roughly 45 and 75 characters. Both extremes hurt: too long and the eye loses its place returning to the left margin, too short and the rhythm breaks.
- Contrast against the measured floors in `app/globals.css`, above.
- No justified text on the web, no long all-caps runs, and enough space between paragraphs to separate them at a glance.

*Comprehension, which you judge by reading:*
- Paragraphs short enough to survive a screen. Three or four lines is the web ceiling; a wall of text is a finding even when every sentence in it is good.
- Sentence length that varies. Uniform length is exhausting to read and is also a Voice tell, so if you see it, say so and let Voice own the phrasing.
- Subheads frequently enough that the page can be scanned, roughly every 200 to 300 words.
- Meaning front-loaded. The point of a section belongs at the start of it, not after the wind-up.
- Vocabulary matched to the reader. This audience is technical buyers, so jargon is fine where it is precise and a problem where it is decoration.

Readability findings that are about *phrasing* belong to Voice. Yours are about whether the text can be physically read and scanned.

**Design bar**
CLAUDE.md sets it: unique, fluid, neurally engaging, scenes in a sequence rather than stacked blocks. If the change adds a generic stacked card section that could belong to any SaaS template, say so. This is the one pure judgment call you are asked to make, so make it plainly and only when confident.

---

## Pass B: behaviour

Now operate the page. Do not just read it.

**Interaction states**
Every interactive element needs hover, focus, active, and where relevant disabled and loading. Hover it. Tab to it. Check something visibly changes. An element that looks clickable and gives no feedback is a finding.

**Keyboard and focus**
- Tab through the page. Order must follow visual order.
- The focus ring must be visible at every stop, including on dark surfaces. `outline: none` with no replacement is always a finding.
- Nothing interactive may be unreachable by keyboard.
- Any dialog or menu must trap focus while open and restore it on close.
- WCAG 2.2 adds this one: the focused element must not be **obscured** by a sticky header, overlay, or other element.

**Screen reader semantics**
- Icon-only buttons need an accessible name.
- Landmarks, list semantics, and heading structure must reflect the visual structure.
- State changes that matter must be announced, not only shown.
- Take an accessibility snapshot and read it as a blind user would.

**Motion**
This site runs gsap, lenis, and motion, so this matters more than usual.
- Emulate `prefers-reduced-motion: reduce`. Scroll-driven animation, smooth scroll, and parallax must meaningfully reduce. Ignoring the preference is a finding.
- Smooth scroll must not break anchor links, in-page navigation, or the browser back button.
- Nothing may hijack scroll such that the user cannot reach content.

**Conversion paths**
There are **two**, and both matter. Check whichever the change touches:
- The **Cal.com booking CTA**, which renders site-wide from `components/site/header.tsx` and `components/site/mobile-nav.tsx` using `SITE.calLink` in `lib/config.ts`. It is on every page, and in the mobile nav it sits behind a menu, which is exactly where a focus trap or keyboard failure hides.
- The **subscribe form**, which renders on blog posts and in one block type, not site-wide. For it: the input has an associated label, correct `type` and `autocomplete`; font size is at least 16px so iOS does not zoom on focus; validation fires at a sane time rather than on the first keystroke; errors say what to do, are announced, and are not colour-only; submitting twice quickly does not send two requests; success, failure and in-flight states are visibly distinct.

**Runtime health**
- Read the console. Errors and warnings introduced by the change are findings.
- Watch for layout shifting after load. CLS above 0.1 is a problem, and INP above 200ms is the most commonly failed Core Web Vital.

---

## Pass C: mobile

Emulate a real mobile device, do not just narrow the window. Resize to 375 and 320, and use device emulation so touch is actually touch.

Most traffic is mobile, and mobile is where this site's stack is most likely to break: gsap, lenis and motion all behave differently under touch than under a mouse.

**Layout and viewport**
- No horizontal scroll at 375, and none at 320 either. The narrowest common device is the one nobody tests.
- Fixed and sticky elements must not eat the viewport. A sticky header plus a sticky CTA can leave almost no reading area on a short screen.
- Content respects safe-area insets on notched devices, so nothing hides under a rounded corner or a home indicator.
- Landscape works. Rotate and check that a vertically centred hero does not push everything off screen.

**Touch**
- **Every hover-only interaction needs a touch equivalent.** Hover does not exist on touch. A dropdown, tooltip, or reveal that only opens on hover is unreachable, and this is the single most common mobile defect in desktop-first work.
- Tap targets at least 44px, with enough space between adjacent ones that a thumb cannot hit both. WCAG 2.2 sets a 24x24 floor; 44 is the practical target.
- Nothing important sits in the top corners, which are hard to reach one-handed.
- Text inputs at 16px minimum, or iOS zooms the whole page on focus and does not zoom back.

**Scroll and motion**
- Smooth scroll must not fight the browser's own gestures. Check that swipe-to-go-back, pull-to-refresh, and momentum scrolling still behave.
- Scroll-driven animation must not make the page feel stuck or janky under touch, which is less forgiving than a mouse wheel.
- Verify `prefers-reduced-motion` under mobile emulation too, not only desktop.

**Navigation**
- The mobile nav opens, traps focus, closes by both its button and Escape, and restores focus and scroll position on close.
- Both conversion paths are reachable on mobile. The booking CTA lives behind the mobile menu, so it is one extra failure away from being unreachable.

---

## Severity

Use the four tiers in `references/severity.md`. Mapped for this dimension:

- **Critical**: content unreadable, unreachable, or overlapping at a common viewport; a user cannot complete either conversion path; keyboard users cannot reach or operate something.
- **High**: horizontal overflow on mobile; contrast below the documented floor; a broken or missing image; no visible focus ring; reduced motion ignored; an unlabelled control; a form that double-submits.
- **Low**: spacing inconsistency, line length, palette drift on a small element, missing hover or loading feedback, validation timing, tap targets, console errors.
- **Minor**: refinements a reasonable person could decline.

## Known false positives

- Deliberate art direction you happen to dislike. Taste is not a defect. Anchor to the documented floors and the design bar, not to preference.
- Dev-only artefacts: the Next.js dev indicator, HMR overlays, fast-refresh notices, unoptimised dev images.
- Console noise from analytics failing without local environment keys. Not a defect.
- Rendering differences caused by missing local environment variables.
- Reduced motion "not working" when you did not actually emulate it. Emulate first.
- A missing focus ring on something genuinely not interactive.
- Screenshot noise: a font still loading, an animation caught mid-flight. Re-check before flagging.
- Absence of a feature the change never claimed to add.
- Pre-existing issues on parts of the page the change set did not touch.

## Output

Return a list of issues. For each: the URL, which pass found it, the viewport width or the exact interaction that reveals it (which key, which element, which emulated condition), the file and line in the change set responsible, one sentence naming the defect, and the tier and fix class per `references/severity.md`.

State explicitly which URLs you rendered, at which widths, what you operated, and anything you could not reach.

## Budget

You have a tool-call budget, given in your prompt. Spend it on the highest-yield checks above first. **Reason from reading the code; do not build test harnesses by default.** Construct a test only when a Critical or High finding turns on runtime behaviour you cannot settle by reading, and say so when you do.

If you run out, stop and list what you did not reach. A review that names its own gaps is honest; one that quietly ran out of road is not.

## Beyond the list

The checklist above is the floor, not the ceiling. It cannot enumerate every way a layout breaks or a page frustrates someone. If a rendered page looks wrong or feels wrong for a reason no bullet names, report it tagged `unlisted`, say which URL and viewport or interaction, and describe what you saw. Trust the screenshot and the interaction over the list.
