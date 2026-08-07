# Show unavailable titles in search with an "Not available in India" badge

## Why "The Bengali Night" is missing

TMDB has the film (1988, id 169357), but its watch-providers response contains no India (`IN`) entry at all — no streaming, rent, or buy options. BingeGuide's search deliberately drops any title with no India OTT availability, so it never reaches the results grid.

## What changes

Search results will show every TMDB match again, but titles with no India OTT availability are:
- marked with a clear "Not available in India" badge on the card,
- shown slightly dimmed,
- sorted to the bottom, below all available titles.

Home page ribbons and category browsing stay India-OTT-only — this change affects the search results page only.

## Technical details

1. `supabase/functions/tmdb-proxy/index.ts` — `/search`:
   - Stop discarding non-available results. Instead, `filterSearchResultsByIndiaOtt` becomes an annotator that attaches `in_ott_available: boolean` (and the matched provider list) to each movie/TV result.
   - Non movie/TV results (people) are still dropped.
   - Available titles are returned first, unavailable ones after.
2. `src/components/MovieCard.tsx` — accept an optional `unavailableInIndia` prop; when true, render a small badge overlay using existing semantic tokens (muted/destructive variants, no hardcoded colors) and apply reduced opacity to the poster.
3. `src/pages/Search.tsx` — pass the flag from each result into `MovieCard`, and add a short helper line under the results count explaining the badge.
4. No database or schema changes. Existing details pages, reminders, and the "Available On" section are untouched.
