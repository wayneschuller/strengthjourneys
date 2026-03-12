# Follow-up Audit Items

Created: 2026-03-06
Branch at creation: `main`

Purpose: track the highest-priority follow-up items from the codebase review over the next few days.

## Priority Order

1. Fix NextAuth Google token refresh flow
2. Lock down `/api/chat`
3. Harden playlist voting and admin handling
4. Reconcile privacy copy with actual data handling
5. Reduce React 19 / accessibility warning debt

## Checklist

- [ ] 1. Fix NextAuth token refresh in [src/pages/api/auth/[...nextauth].js](/home/schuller/hacking/strengthjourneys/src/pages/api/auth/[...nextauth].js)
  Notes: verify Google refresh request parameter names, refresh-token fallback behavior, and session recovery after expiry.

- [ ] 2. Lock down AI chat endpoint in [src/pages/api/chat.js](/home/schuller/hacking/strengthjourneys/src/pages/api/chat.js)
  Notes: decide auth policy, add abuse protection/rate limiting, and stop letting the client inject arbitrary system-level prompt text.

- [ ] 3. Harden playlist voting/admin flow in [src/pages/api/vote-playlist.js](/home/schuller/hacking/strengthjourneys/src/pages/api/vote-playlist.js), [src/pages/api/playlists.js](/home/schuller/hacking/strengthjourneys/src/pages/api/playlists.js), and [src/pages/api/revalidate-leaderboard.js](/home/schuller/hacking/strengthjourneys/src/pages/api/revalidate-leaderboard.js)
  Notes: move admin config off `NEXT_PUBLIC_*`, add server-side replay/rate protections, and make vote mutations harder to script.

- [ ] 4. Reconcile privacy promises with actual behavior in [src/components/hero-section.js](/home/schuller/hacking/strengthjourneys/src/components/hero-section.js), [src/components/instructions-cards.js](/home/schuller/hacking/strengthjourneys/src/components/instructions-cards.js), [src/pages/api/auth/[...nextauth].js](/home/schuller/hacking/strengthjourneys/src/pages/api/auth/[...nextauth].js), and [src/pages/api/read-gsheet.js](/home/schuller/hacking/strengthjourneys/src/pages/api/read-gsheet.js)
  Notes: either tighten copy or change backend behavior so user expectations are accurate.

- [ ] 5. Reduce React 19 and accessibility warnings
  Notes: start with [src/hooks/use-state-from-query-or-localStorage.js](/home/schuller/hacking/strengthjourneys/src/hooks/use-state-from-query-or-localStorage.js), [src/components/ai-elements/file-tree.jsx](/home/schuller/hacking/strengthjourneys/src/components/ai-elements/file-tree.jsx), [src/pages/index.js](/home/schuller/hacking/strengthjourneys/src/pages/index.js), and [src/components/ai-assistant/lifting-data-card.js](/home/schuller/hacking/strengthjourneys/src/components/ai-assistant/lifting-data-card.js).

## Suggested Cadence

- Day 1: items 1 and 2
- Day 2: item 3
- Day 3: items 4 and 5

## Parked Product/UI Follow-ups

- [ ] Revisit the new Olympic Lift Insights page in [src/pages/olympic-lift-insights.js](/home/schuller/hacking/strengthjourneys/src/pages/olympic-lift-insights.js)
  Notes: replace the current preview power-clean and power-snatch standards with dedicated Kilgore Snatch / Clean & Jerk source tables once those values are digitized into the app's standards data layer, then review the page copy to remove the temporary-preview framing.

- [ ] Make the demo-mode banner support customizable messages in both variants
  Notes: allow page/context-specific copy instead of a single shared message, while preserving the common setup CTA.

- [ ] Replace plain `Demo mode` labels with a reusable badge wherever that state appears
  Notes: centralize the visual treatment so demo-state labeling is consistent across banners, cards, and page headers.

- [ ] Make theme fonts load dynamically instead of importing every theme font globally in [src/pages/_app.js](/home/schuller/hacking/strengthjourneys/src/pages/_app.js)
  Notes: keep the default light/dark font in the critical path, lazy-load alternate theme font families on theme activation, and verify fallback stacks so theme switches do not cause ugly layout shifts.
