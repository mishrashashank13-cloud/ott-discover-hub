## Goal

Make these three Home page sections respect the logged-in user's ranked language + genre preferences:
- Most Anticipated Releases
- Upcoming Movies
- Upcoming Web Series

Behavior: **strong sort** — every item that matches a preferred language or genre appears before any non-matching item. Non-matches stay visible below. If the user has no preferences set (or is logged out), the original order is kept.

## Changes

### 1. `src/lib/contentSorting.ts` — add a strong-sort helper

Add `sortByUserPreferencesStrong()` next to the existing scorer. Logic:
- Compute the same preference score for each item.
- Partition into `matched` (score > 0) and `unmatched` (score = 0).
- Sort `matched` desc by score (stable).
- Concatenate `[...matched, ...unmatched]` so non-matches stay visible at the bottom.
- If `preferences` is null or both ranking arrays are empty, return the input array unchanged.

The existing `sortByUserPreferences` stays — other pages (Search, trending) keep current behavior.

### 2. `src/pages/Home.tsx` — Most Anticipated source + strong sort

- **Most Anticipated Releases**: stop sourcing from `trendingMovies` / `trendingTVShows`. Instead build it from `upcomingMovies` + `upcomingTVShows` (already fetched on the page). Take the top 2 movies + top 2 TV shows after running the strong-sort helper. This makes "anticipated" actually mean "not yet released".
- **Upcoming Movies** and **Upcoming Web Series**: replace the current `sortByUserPreferences` calls in `filteredUpcomingMovies` / `filteredUpcomingTVShows` with `sortByUserPreferencesStrong`.
- Keep the empty-state fallback simple: when there are no upcoming results at all, the existing "No upcoming … found" alert still shows.
- Trending Movies / Trending Web Series sections are untouched.

### 3. Comments

Add layman-friendly comments around the new helper and the Home page changes explaining "preference matches first, others below".

## Out of scope

- No DB / RLS / edge function changes.
- No changes to `Search.tsx`, MovieCard, FilterBar, or trending sections.
- No new TMDB endpoints — we reuse `getUpcomingMovies` / `getUpcomingTVShows` already on the page.

## Files touched

- `src/lib/contentSorting.ts` (add helper)
- `src/pages/Home.tsx` (Most Anticipated source + strong sort for upcoming)
