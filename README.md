# Strength Journeys ([strengthjourneys.xyz](https://www.strengthjourneys.xyz))

## Interactive strength progress visualizations for barbell and other gym lifts

Strength Journeys is a free, open-source web app to visualize your barbell lifting data from Google Sheets. Privacy-first — no user data is stored on any server. All analysis happens client-side in your browser. Chalk not included.

Powerlifters and barbell weirdos will love this app, but our real target audience is the novice. If we can help someone start barbell training and keep them going for ten years, their life and their family will be transformed. Barbell strength training is one of the most effective things you can do for your health, longevity, and quality of life. Stronger people are harder to kill, more useful in general, and tend to live longer.

## Features

- **Big four lift cards** — at-a-glance dashboard showing PRs, estimated 1RM, tonnage, and recent activity for [squat](https://www.strengthjourneys.xyz/barbell-squat-insights), [bench press](https://www.strengthjourneys.xyz/barbell-bench-press-insights), [deadlift](https://www.strengthjourneys.xyz/barbell-deadlift-insights), and [strict press](https://www.strengthjourneys.xyz/barbell-strict-press-insights)
- **[Visualizer](https://www.strengthjourneys.xyz/visualizer)** — interactive line charts of your lift history over time with E1RM (estimated one-rep max) curves
- **[Analyzer](https://www.strengthjourneys.xyz/analyzer)** — activity heatmaps and PR tracking across all your lifts
- **[Tonnage tracking](https://www.strengthjourneys.xyz/tonnage)** — volume analysis showing total weight moved over time
- **[One rep max calculator](https://www.strengthjourneys.xyz/calculator)** — estimate your 1RM from any rep/weight combination
- **[Strength level calculator](https://www.strengthjourneys.xyz/strength-level-calculator)** — see how your lifts compare to strength standards
- **[1000lb club calculator](https://www.strengthjourneys.xyz/1000lb-club-calculator)** — track your squat/bench/deadlift total
- **[Warm-up sets calculator](https://www.strengthjourneys.xyz/warm-up-sets-calculator)** — generate warm-up ramp sets for any working weight
- **[Strength year in review](https://www.strengthjourneys.xyz/strength-year-in-review)** — annual recap of your lifting highlights
- **[AI lifting assistant](https://www.strengthjourneys.xyz/ai-lifting-assistant)** — chat-based analysis of your training data
- **[Gym timer](https://www.strengthjourneys.xyz/timer)** — rest timer with audio cues
- **[Gym playlist leaderboard](https://www.strengthjourneys.xyz/gym-playlist-leaderboard)** — community-voted workout playlists

## Google Sheets as data source

Requires user data in a Google Sheet with columns: date, lift type, reps, weight (kg or lb). The app requests read-only access to your specific spreadsheet, which can be revoked at any time.

Open our [sample data format in Google Sheets](https://docs.google.com/spreadsheets/d/14J9z9iJBCeJksesf3MdmpTUmo2TIckDxIQcTx1CPEO0/edit#gid=0) (click File menu, then 'Make A Copy').

## Privacy

No user data is stored server-side. Google Sheet reads are authenticated via Google OAuth and requested through a Next.js API route proxy, then processed client-side in the browser. The app does not persist your lifting data in a database.

## Tech stack

**Framework & language:**
- JavaScript (no TypeScript) with [JSDoc](https://jsdoc.app/) for key function documentation
- [Next.js 16](https://nextjs.org/) (Pages Router)
- [React 19](https://react.dev/)
- Deployed on [Vercel](https://vercel.com/) with [Vercel Analytics](https://vercel.com/analytics) and [Speed Insights](https://vercel.com/docs/speed-insights)

**UI & styling:**
- [Tailwind CSS v4](https://tailwindcss.com/) with 8 custom themes via CSS variables
- [shadcn/ui](https://ui.shadcn.com/) components ([Radix](https://www.radix-ui.com/) primitives)
- [Lucide React](https://lucide.dev/) icons
- [Motion](https://motion.dev/) (Framer Motion) for animations
- [Embla Carousel](https://www.embla-carousel.com/) for carousels
- [next-themes](https://github.com/pacocoursey/next-themes) for theme switching

**Data visualization:**
- [Recharts](https://recharts.org/) for line, area, and bar charts
- [react-calendar-heatmap](https://github.com/kevinsqi/react-calendar-heatmap) for activity heatmaps
- [html2canvas-pro](https://github.com/nicolo-ribaudo/html2canvas-pro) for share-to-clipboard image capture

**Auth & data:**
- [NextAuth.js v4](https://next-auth.js.org/) with Google OAuth
- Google Sheets API for user lifting data (read-only)
- [SWR](https://swr.vercel.app/) for data fetching and caching
- [Vercel KV](https://vercel.com/storage/kv) for server-side storage (playlists, leaderboard)

**AI features:**
- [Vercel AI SDK](https://sdk.vercel.ai/) with OpenAI provider
- [Streamdown](https://github.com/nicolo-ribaudo/streamdown) for streaming markdown rendering
- [Shiki](https://shiki.style/) for code syntax highlighting in AI responses

**Content & SEO:**
- [Sanity](https://www.sanity.io/) CMS for articles
- [next-seo](https://github.com/garmeeh/next-seo) and [next-sitemap](https://github.com/iamvishnusankar/next-sitemap) for SEO

See [package.json](https://github.com/wayneschuller/strengthjourneys/blob/main/package.json) for the full list of dependencies.

## Codebase structure (quick contributor map)

This repo has grown into a multi-tool lifting app (analyzer, visualizer, calculators, AI assistant, playlists, articles) that shares a common app shell and lifting-data pipeline.

- `src/pages/` — Next.js Pages Router routes (tool pages, article pages, API routes)
- `src/pages/_app.js` — global providers + app layout wrapper (theme, auth, lifting data, athlete bio, timer)
- `src/components/` — feature UI and shared UI
- `src/components/analyzer/` — PR Analyzer dashboard cards
- `src/components/visualizer/` — charting + visualizer UI
- `src/components/ai-elements/` — composable chat UI building blocks used by the AI assistant
- `src/components/ui/` — shadcn/Radix-based primitives
- `src/hooks/use-userlift-data.js` — central Google Sheets fetch/parse/cache context (SWR + demo mode + derived metrics)
- `src/lib/parse-data.js` — normalizes raw Google Sheets rows into the app’s canonical lift-entry format
- `src/lib/processing-utils.js` — shared processing/aggregation helpers (PRs, tonnage, timing logs, unit conversion)
- `src/pages/api/read-gsheet.js` — authenticated Google Sheets + Drive metadata proxy
- `src/pages/api/auth/[...nextauth].js` — NextAuth Google OAuth setup + token refresh
- `src/lib/sanity-io.js` — Sanity CMS fetch helpers for article pages and related content

### Core data flow (at a glance)

1. User signs in with Google (`next-auth`) and picks a spreadsheet.
2. `use-userlift-data` fetches `/api/read-gsheet` via SWR.
3. API route reads Google Sheets + Drive metadata and returns JSON.
4. `parseData()` normalizes rows into canonical lift entries.
5. Shared derived metrics (PRs, tonnage, lift types, session lookups) are computed once in context and consumed by pages/cards.

### Common contributor entry points

- Build a new tool page (or improve an existing one): start in `src/pages/<tool>.js`, then add/adjust feature components under `src/components/<feature>/`
- Improve parser tolerance for real-world spreadsheets (header variations, blank-row patterns, date/weight formats): `src/lib/parse-data.js`
- UI polish and usability improvements (layout spacing, card composition, mobile tweaks, theme details): `src/components/`, `src/components/ui/`, `src/styles/globals.css`
- Add import support for other lifting apps/export formats: branch from `src/lib/parse-data.js`, reuse `src/lib/parse-turnkey-importer.js` as an example, or add a new parser module under `src/lib/`

## Branch strategy

- `stable` — Production branch. Deploys to [strengthjourneys.xyz](https://www.strengthjourneys.xyz).
- `main` — Development branch. Deploys to a Vercel preview URL for testing. Has informative console logging of processing timings and any errors.
- Feature branches are created from `main` and deleted after merging.

## Project history

Strength Journeys unites and extends features from earlier projects by the same author:

- [onerepmaxcalculator.xyz](https://www.onerepmaxcalculator.xyz/) — standalone one rep max calculator (predecessor to the current calculator page)
- [powerlifting_strength_tracker_js](https://wayneschuller.github.io/powerlifting_strength_tracker_js/e1rm.html) — the original E1RM visualization prototype built with vanilla JS and Chart.js, which evolved into the Strength Journeys visualizer
