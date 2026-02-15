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

No user data is stored server-side. Your Google Sheet data is fetched directly in the browser via OAuth and processed entirely client-side. The app never sees, stores, or transmits your lifting data to any backend.

## Getting started

```bash
npm install
npm run dev
```

Requires Node.js >= 24. See [package.json](https://github.com/wayneschuller/strengthjourneys/blob/main/package.json) for the full list of dependencies.

Other commands:
- `npm run build` — production build
- `npm run lint` — run ESLint

## Tech stack

**Framework & language:**
- JavaScript (no TypeScript) with [JSDoc](https://jsdoc.app/) for key function documentation
- [Next.js 14](https://nextjs.org/) (Pages Router)
- [React 18](https://react.dev/)
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

## Branch strategy

- `stable` — Production branch. Deploys to [strengthjourneys.xyz](https://www.strengthjourneys.xyz).
- `main` — Development branch. Deploys to a Vercel preview URL for testing. Has informative console logging of processing timings and any errors.
- Feature branches are created from `main` and deleted after merging.

## Project history

Strength Journeys unites and extends features from earlier projects by the same author:

- [onerepmaxcalculator.xyz](https://www.onerepmaxcalculator.xyz/) — standalone one rep max calculator (predecessor to the current calculator page)
- [powerlifting_strength_tracker_js](https://wayneschuller.github.io/powerlifting_strength_tracker_js/e1rm.html) — the original E1RM visualization prototype built with vanilla JS and Chart.js, which evolved into the Strength Journeys visualizer
