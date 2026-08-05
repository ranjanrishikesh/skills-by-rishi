# Change set to URL mapping

Shared by every dimension that needs a rendered page. **Verify against the current tree before relying on it.** Routes get added, and a stale map here silently sends reviewers to 404s or, worse, tells them a live page does not exist.

## Content collections

`content/` holds exactly one collection now: `content/blog/`.

| Changed file | URL |
|---|---|
| `content/blog/<slug>.json` | `/blog/<slug>`, **and** its `/blog/category/<category>` hub, `/author/<author>` hub, and any `/blog/tag/<tag>` hub it belongs to |
| `content/authors/<slug>.json` | `/author/<slug>` |

Blog taxonomy routes are derived, so a content edit can create or destroy a URL:
changing `meta.category` moves a post between two hubs, and adding or removing a tag can
push it over or under the two-post threshold that decides whether `/blog/tag/<tag>`
exists at all. When reviewing a content change, check the hubs it touches, not just the
post.

Everything else that used to live under `content/` is gone. Pages became
hard-coded React on 2026-08-02: `content/pages/`, `content/services/` and
`content/pages/hubs.json` were deleted along with `components/content-page.tsx`
and `components/collection-index.tsx`.

## Pages

A page is `app/<route>/page.tsx`, composing plain-props components from
`components/sections/`, with its copy in a sibling `content.ts`.

| Changed file | URL |
|---|---|
| `app/(home)/page.tsx` + `app/(home)/content.ts` | **`/`** |
| `app/pricing/`, `app/services/`, `app/what-we-build/`, `app/privacy/`, `app/terms/` | the matching path |
| `app/services/<slug>/` (five real folders, no dynamic route) | `/services/<slug>` |
| `app/blog/content.ts` | **Not a page.** Hub copy for `/blog`, and `MEMO`, which renders in the footer of **every** `/blog/<slug>` post. Changing MEMO touches every post. |

A change to `components/sections/*` can affect both a page and the blog, because
`components/blocks/renderer.tsx` adapts the same components for posts. Check one
of each.

## Static routes

`/`, `/blog`, `/services`, `/pricing`, `/privacy`, `/terms`, `/what-we-build`

A change to a shared component, to `app/globals.css`, or to `app/layout.tsx` affects every route. Do not render all of them. Pick at most three that best exercise the change: one content-heavy page, one list page, and the home page.

## Resolving which URLs to review

1. Take the change set.
2. Map each changed content file with the tables above.
3. For each changed component or style file, grep for which pages render it, then pick representative routes per the rule above.
4. Cap at five URLs. If more qualify, review the five closest to the change and **state which ones you dropped**. Never silently truncate.

If a changed content file maps to no route you can verify, say so and name the file. Do not guess a URL, and do not quietly skip it.

## Running the site

The parent agent starts the dev server before dispatching you and passes a base URL. Do not start your own, and do not stop the one you are given. Other agents are using it.

If you were not given a base URL, do not start one. Report that you could not render, review what you can from source, and mark your finding set as partial.
