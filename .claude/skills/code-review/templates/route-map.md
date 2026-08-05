# Change set to URL mapping — TEMPLATE

Copy this into your repo (`docs/route-map.md` is a fine home), fill it in, and point `repoFacts.routeMap` at it in `review.config.json`.

**This file is optional.** Without it, the Interface and Discoverability dimensions derive URLs from the router themselves and say that they did. Supply one when your routing is derived rather than literal, because that is where a reviewer silently misses a page: a data file that creates or destroys a URL as a side effect of a field value is invisible to anyone reading the router.

**Verify it against the current tree before relying on it.** Routes get added, and a stale map here sends reviewers to 404s or, worse, tells them a live page does not exist. A wrong map is worse than no map, because no map makes the reviewer look.

[Delete the bracketed instructions as you fill this in.]

---

## Content collections

[List every directory of authored files that produces URLs, and what each file maps to. One row per pattern, not per file.]

| Changed file | URL |
|---|---|
| `content/<collection>/<slug>.<ext>` | `/<collection>/<slug>` |

**Derived routes are the reason this file exists.** [Name every case where a *field value* creates or destroys a URL, rather than the file's existence doing it. The recurring shapes:]

- [A taxonomy field that moves a document between hub pages, so editing it changes two URLs and not the one you edited.]
- [A tag or category page that only exists above a threshold, so adding or removing one entry creates or deletes a route.]
- [A draft or published flag that removes a page from the build entirely.]
- [Pagination, where adding one item can add a page.]

[For each, say what a reviewer must check *in addition to* the file that changed.]

## Pages

[Where hard-coded pages live and how a file maps to its URL. Note any file that is NOT a page despite living among them, and any file whose copy renders on many pages: those are the ones that get reviewed as a single page when they affect fifty.]

| Changed file | URL |
|---|---|
| `app/<route>/page.tsx` | `/<route>` |

## Shared components

[Which components render on every page, or on a whole class of pages. A change to one of these affects every route, and the reviewer needs to know to sample rather than enumerate.]

A change to a shared component, to the global stylesheet, or to the root layout affects every route. **Do not render all of them.** Pick at most three that best exercise the change: one content-heavy page, one list page, and the home page.

## Static routes

[List them, so a reviewer can tell a real route from a typo.]

## Resolving which URLs to review

1. Take the change set.
2. Map each changed content file with the tables above.
3. For each changed component or style file, grep for which pages render it, then pick representative routes per the rule above.
4. Cap at five URLs. If more qualify, review the five closest to the change and **state which ones you dropped**. Never silently truncate.

If a changed file maps to no route you can verify, say so and name the file. Do not guess a URL, and do not quietly skip it.

## Running the site

The parent agent starts the dev server before dispatching you and passes a base URL. Do not start your own, and do not stop the one you are given. Other agents are using it.

If you were not given a base URL, do not start one. Report that you could not render, review what you can from source, and mark your finding set as partial.
