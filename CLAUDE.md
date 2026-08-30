# CLAUDE.md

Guidance for Claude Code (and other AI coding agents) working in the
**Strength Journeys** repository — a free, privacy-first web app that
visualizes barbell lifting data from a user's own Google Sheet.

> **Companion doc:** [`AGENTS.md`](./AGENTS.md) is the long-form agent
> handbook and covers extra playbooks not repeated here: the Sanity CMS
> sibling-repo workflow, the KV user-funnel analysis task, and the full
> theme-authoring walkthrough. When the two disagree on a fact about the
> code, trust the code, then fix both docs.

---

## 1. What this project is

- Live site: <https://www.strengthjourneys.xyz>
- **Next.js 16, Pages Router, JavaScript only.** No TypeScript, no App
  Router, no `"use client"`, no `generateMetadata`. This is a deliberate,
  standing commitment — do not migrate.
- React 19, Tailwind CSS v4, shadcn/ui on Radix primitives, Recharts.
- Deployed on Vercel. Node `>=24` (see `engines` in `package.json`).
- **Privacy boundary:** all lifting analysis happens client-side. The
  server proxies Google Sheets reads/writes and stores only lightweight
  operational metadata in KV (onboarding, recovery, support visibility).
  It never stores the user's analyzed training state.

---

## 2. Commands

```bash
npm install              # dependencies

npm run dev              # Next dev server with Turbopack
npm run dev:webpack      # fallback if Turbopack itself is the problem

npm run lint             # ESLint over src/
npx eslint src/path/to/file.js   # focused lint after a targeted change

npm run validate:hevy    # Hevy importer regression checks (scripts/ + fixtures/)

npm run build            # next build; runs next-sitemap as postbuild
npm run build:analyze    # bundle analysis
```

**There is no test framework.** Validation = `npm run lint`, plus
`npm run validate:hevy` when you touch import parsing.

**Do not run `npm run build` unless the user explicitly asks** — it can
disrupt their local `npm run dev` session. Lint after every change.

Formatting is Prettier with `prettier-plugin-tailwindcss` (`.prettierrc`).

### Sitemaps — never commit them

- `/sitemap.xml` + `/sitemap-0.xml` — static routes, written into `public/`
  by `next-sitemap` at postbuild time from `next-sitemap.config.js`.
- `/server-sitemap.xml` — Sanity article slugs, served on request by
  `src/pages/server-sitemap.xml.js` so new articles appear without a deploy.

Both are gitignored and both belong in Google Search Console.

---

## 3. Repository layout

```
src/
  pages/            Pages Router routes + API routes
  components/       feature UI, grouped by feature
  hooks/            React context providers and shared hooks
  lib/              parsing, processing, domain logic, server helpers
  styles/globals.css  Tailwind v4 entry + every theme's CSS variables
scripts/            standalone node validation scripts (no test runner)
fixtures/imports/   public-shaped import fixtures used by those scripts
public/             static assets, og images, llms.txt
```

Root config: `next.config.js` (image hosts + a long list of dated SEO
redirects), `next-sitemap.config.js`, `eslint.config.mjs`,
`components.json` (shadcn: JS not TSX, `neutral` base, CSS variables,
`@magicui` registry), `vercel.json` (daily `/api/playlist-health` cron),
`jsconfig.json` (`@/*` → `./src/*`).

### `src/pages/` — routes

Tool pages are flat files: `index.js` (home dashboard), `visualizer.js`,
`tonnage.js`, `log.js`, `lift-explorer.js`, `timer.js`,
`ai-lifting-assistant.js`, `strength-year-in-review.js`,
`gym-playlist-leaderboard.js`, plus SEO calculator pages
(`1000lb-club-calculator.js`, `how-strong-am-i.js`,
`warm-up-sets-calculator.js`, `plate-milestones.js`, …).

Content and hub clusters use dynamic routes: `articles/[slug].js`,
`articles/page/[page].js`, `calculator/[slug].js`,
`strength-levels/[lift].js`, `progress-guide/[lift].js`,
`import/[slug].js`.

`_app.js` composes the global providers; `_document.js` the HTML shell.

### `src/pages/api/` — API routes

- **`api/sheet/*`** — the Google Sheets surface. `read.js` is the primary
  read proxy (**not** the older `read-gsheet.js` that some historical
  comments and the README still mention). `resolve.js` decides the
  bootstrap / recovery / switch-sheet flow. `provision.js`, `link.js`,
  `unlink.js`, `enrich.js` handle sheet setup. Writes are
  *operation-oriented*, not REST-over-rows: `insert-row.js`,
  `edit-row.js`, `edit-cell.js`, `delete-row.js`, `delete.js`,
  `fix-date-outlier.js`, `import-history.js`. Each file's header comment
  explains why it exists as its own operation — read it before adding a
  new one.
- **`api/auth/[...nextauth].js`** — NextAuth v4 Google OAuth, token
  refresh, and `promptDeveloper(...)`, the existing server-side founder
  email transport. Reuse it rather than adding a parallel mailer.
- **`api/chat.js`, `api/chat/quota.js`, `api/chat/suggestions.js`** — the
  AI lifting assistant. Suggestions are split out so the main answer
  stream closes promptly.
- **Playlists:** `playlists.js`, `vote-playlist.js`, `vote-weight.js`,
  `playlist-art.js`, `playlist-preview.js`, `report-playlist.js`,
  `playlist-health.js` (cron), `revalidate-leaderboard.js`.
- **Best-effort telemetry/support:** `feedback.js`,
  `onboarding-event.js`, `import-limit-event.js`, `import/profile.js`.
  These must stay best-effort — never block or slow a user path.

### `src/hooks/`

`use-userlift-data.js` is the heart of the app: the
`UserLiftingDataProvider` context that owns fetching, parsing, demo mode,
imported-file mode, and every shared derived metric. Its context value
includes `parsedData`, `liftTypes`, `topLiftsByTypeAndReps` (and the
last-12-months variant), `topTonnageByType`, `sessionTonnageLookup`,
`streakLeaderboard`, `sheetInfo`, `isDemoMode`, `isImportedData`,
`isReadOnly`, `dataQualityWarnings`, and the mutators `selectSheet`,
`clearSheet`, `importFile`, `clearImportedData`, `mutate`.

**Consume derived data from this context — do not recompute PRs or
tonnage in a component.**

Other hooks: `use-timer`, `use-lift-colors`, `use-athlete-biodata`,
`use-state-from-query-or-localStorage` (persist + shareable URL state for
calculators), `use-toast`, `use-reward-progress`, `use-has-coarse-pointer`.

### `src/lib/`

- **Import pipeline:** `data-sources/import-dispatcher.js` is the single
  entry point, with two functions — `parseData(rows)` for Google Sheets
  (Strength Journeys format only, read/write) and `parseImportedFile(file)`
  for drag-and-drop CSV/XLSX (any format, view-only). Per-vendor parsers
  live beside it: `hevy-parser.js`, `strong-parser.js`,
  `stronglifts-parser.js`, `btwb-parser.js`, `wodify-parser.js`,
  `turnkey-parser.js`, `strength-journeys-parser.js`, sharing
  `parser-utilities.js`, `decode-csv.js`, `decode-workbook.js`.
  `parse-data.js` is a thin re-export kept for older import sites.
- **Processing:** `processing-utils.js` — PRs, tonnage, lift types,
  session lookups, `devLog()`, and the timing log. `estimate-e1rm.js` —
  E1RM formulae and bodyweight-load handling.
- **Sheet flow:** `sheet-flow.js` (shared linking/provisioning logic),
  `sheet-flow-errors.js`, `sheet-row-identity.js`, `sheet-row-ops.js`,
  `pending-sheet-action.js`.
- **Server state:** `kv.js` (Upstash/Vercel KV client) and
  `user-kv-keys.js`, which owns the `sj:user:<email>` key convention and
  the read-modify-write helpers. Never interpolate that key inline.
- **Other domains:** `analytics.js` (GA4 event helpers and
  `GA_EVENT_TAGS`), `sanity-io.js` (CMS reads), `localStorage-keys.js`
  (`LOCAL_STORAGE_KEYS`, the single source of truth), `strength-circles/`,
  `rewards/`, `home-dashboard/`, `import/`, `data-quality/`, `warmups.js`,
  `consistency.js`, `playlist-*.js`, `founder-*.js`.

### `src/components/`

Feature-grouped. Shared shell in `ui-shell/` (`layout.js`, `nav-bar.js`,
`footer.js`, `theme-provider.js`, `theme-chooser.js`, `app-background.js`,
`theme-backgrounds.js`, `avatar-menu.js`, `analytics-session.js`).
shadcn primitives in `ui/`. Feature folders: `home-dashboard/` (with
`inspiration-cards/` and `long-game/`), `visualizer/`, `lift-explorer/`,
`log/`, `onboarding/`, `ai-assistant/`, `ai-elements/` (composable chat
UI blocks), `year-recap/`, `strength-circles/`, `strength-level/`,
`big-four/`, `homepage/`, `playlist-leaderboard/`, `warmups/`,
`rewards/`, `feedback/`, `magicui/`.

---

## 4. Core data flow

1. User signs in with Google (`next-auth`) and links a spreadsheet.
2. `use-userlift-data.js` fetches `/api/sheet/read` via SWR.
3. `parseData()` normalizes rows into canonical lift entries.
4. `processing-utils.js` computes PRs, tonnage, lift types, and session
   lookups **once** in the provider.
5. Pages and cards consume those derived values from context.

Alternative inputs into the same pipeline:

- **Demo mode** — `data-sources/sample-parsed-data.js` backs unauthenticated
  visitors and signed-in users who disconnect their sheet.
- **File import** — `parseImportedFile()` runs entirely client-side, works
  for anonymous users, is stored in `sessionStorage`, and *overrides* the
  linked-sheet pipeline until cleared. Merging an import into a linked
  sheet is authenticated-only, via `/api/sheet/import-history`. Entry
  points: `components/onboarding/import-workflow-section.js` and
  `components/onboarding/sheet-setup-dialog.js`.

### Canonical lift entry shape

```js
{ date, liftType, reps, weight, unitType, isHistoricalPR, isGoal }
```

`date` is `"YYYY-MM-DD"`. Ordering relies on **lexical** string
comparison — avoid constructing `new Date(...)` in hot paths. Do not
change this schema without updating both parsing and processing.

### Client storage

- `sheetInfo` in localStorage is the canonical linked-sheet pointer.
- All keys go through `LOCAL_STORAGE_KEYS` in `lib/localStorage-keys.js`.
- Use `usehooks-ts` `useLocalStorage` / `useReadLocalStorage` with
  `{ initializeWithValue: false }` to stay SSR-safe, or
  `useStateFromQueryOrLocalStorage` for values that should also be
  shareable via the URL.

---

## 5. Provider order

Defined in `src/pages/_app.js`; the nesting is intentional because
downstream state depends on theme and auth being resolved first:

`MotionConfig` → `ThemeProvider` → `SessionProvider` →
`UserLiftingDataProvider` → `TimerProvider` → `LiftColorsProvider` →
`AthleteBioProvider` → `Layout`.

---

## 6. Themes

`next-themes` with `attribute="class"` plus CSS-variable packs.

- The allowed theme names are the `themes={[...]}` array in `_app.js`:
  `light`, `dark`, `blueprint(-dark)`, `starry-night(-dark)`,
  `retro-arcade(-dark)`, `neo-brutalism(-dark)`.
- Each theme is a selector block in `src/styles/globals.css` setting the
  shadcn tokens (`--background`, `--foreground`, `--primary`, …), the
  heatmap ramp `--heatmap-0` … `--heatmap-4`, and `--font-sans`. Fonts are
  imported in `_app.js`.
- Tailwind's `dark:` variant is a custom variant at the top of
  `globals.css` listing every dark theme class. **A new `*-dark` theme
  must be added there or `dark:` utilities silently won't apply inside it.**
- `theme-chooser.js` gates non-`light`/`dark` themes to signed-in users and
  owns the animated-background toggle (`LOCAL_STORAGE_KEYS.ANIMATED_BACKGROUND`),
  consumed by `app-background.js`.

Adding a theme: (1) `.your-theme` + `.your-theme-dark` blocks in
`globals.css`, (2) both names in `_app.js`, (3) extend `@custom-variant
dark`, (4) extend `app-background.js` if it needs a custom background,
(5) extend `lib/theme-logos.js` if it needs a nav logo. Always ship the
dark variant too.

---

## 7. Conventions

### Language and imports

- JavaScript only. No TypeScript files, no type annotations, no TS config.
  JSDoc is used for key shapes (see the `LiftEntry` typedef in
  `import-dispatcher.js`).
- Absolute imports via `@/`: `import { devLog } from "@/lib/processing-utils"`.
- Import order: React/Next → third-party → `@/...` → relative. Remove
  unused imports.

### Files and components

- Every source file opens with a short comment block stating its role in
  the system and any constraint future agents should keep. Match that.
- Comments explain *why*, not what the line literally does.
- Keep the primary exported component or function near the top; helpers
  below it.
- Function components and hooks only — no classes. Keep them small and
  composable, grouped by feature.
- Naming: `PascalCase` components, `useSomething` hooks, `camelCase`
  utils, `UPPER_SNAKE_CASE` constants.

### React discipline

`eslint.config.mjs` downgrades five `react-hooks` v5 rules from error to
warn (`set-state-in-effect`, `refs`, `purity`, `static-components`,
`immutability`) because the project does not use the React Compiler and
they flag pre-existing intentional patterns. **Treat those warnings as
real for new code:**

- Avoid `setState` inside effects except when syncing with external systems.
- No impure calls (`Math.random`, `Date.now`) during render; use lazy
  initializers.
- Do not mutate refs during render.
- Prefer `useMemo` for derived data; memoize heavy chart datasets and
  avoid recreating deep objects inside JSX.

### Styling

Tailwind utilities, existing CSS variables, existing design patterns. Do
not introduce a new colour system. Charts use Recharts inside
`ResponsiveContainer` with lightweight tooltip components.

### Errors and logging

Fail gracefully in the UI rather than crashing a page; use optional
chaining; log dev-only via `devLog()`; never log sensitive data.

### SEO

`getStaticProps` for ISR pages, `NextSeo` for metadata. When tuning
titles or descriptions from Search Console evidence, leave a short
provenance comment such as `GSC review 2026-03-07` near the change so a
future agent can tell evidence-led copy from template wording. The dated
comments on each redirect in `next.config.js` follow the same habit.

---

## 8. Git workflow

- `main` — development branch, deploys to a Vercel preview.
- `stable` — production. Never delete it, never force push it.
- Feature branches come off `main`.
- Default rhythm: commit and push to `main` as you go. If you make a
  tracked change and the user hasn't opted out, finish by committing and
  pushing to `main`.
- If you find yourself on `stable`, say so **before** editing and move the
  work to `main` unless the user explicitly wants a production change.
- Never force push `main` or `stable`.

Commit messages in this repo are sentence-case, plain-English, and
describe the change in the author's voice — e.g. *"Close an open PR card
by clicking it, not only by finding the X"*. No `feat:`/`fix:` prefixes,
no ticket numbers.

### "Deploy" means

1. Worktree clean.
2. `git fetch origin main stable`.
3. Checkout `stable`.
4. `git merge --ff-only main`.
5. Push `stable`.
6. Back to `main`; confirm clean and report the resulting `stable` commit.

Deploys fast-forward so `stable` stays an exact pointer into `main`'s
history. If step 4 refuses, `stable` has commits `main` lacks — **stop and
report**. Reconcile by merging `stable` into `main`; never force push.

---

## 9. Environment variables

Set in `.env` locally and in Vercel. Nothing here belongs in git.

- **Auth/Google:** `NEXTAUTH_SECRET`, `GOOGLE_CLIENT_SECRET`,
  `NEXT_PUBLIC_GOOGLE_CLIENT_ID`, `NEXT_PUBLIC_GOOGLE_APP_ID`
- **KV:** `KV_REST_API_URL`, `KV_REST_API_TOKEN`,
  `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`
- **AI:** `OPENAI_API_KEY`, `XAI_API_KEY`, `EXTENDED_AI_PROMPT`,
  `AI_RATE_LIMIT_SALT`
- **CMS:** `NEXT_PUBLIC_SANITY_PROJECT_ID`, `NEXT_PUBLIC_SANITY_DATASET`
  (project `czypnl5j`, dataset `production`)
- **Email/support:** `RESEND_API_KEY`, `FEEDBACK_EMAIL_TO`,
  `ENABLE_FOUNDER_IMPORT_MERGED_EMAIL`, `ENABLE_AUTOMATED_FOUNDER_OUTREACH`
- **Misc:** `NEXT_PUBLIC_GOOGLE_ANALYTICS`,
  `NEXT_PUBLIC_STRENGTH_JOURNEYS_ENV`, `NEXT_PUBLIC_USE_DEMO_PLAYLISTS`,
  `CRON_SECRET`, `PLAYLIST_HEALTH_BUDGET_MS`, `REDDIT_CLIENT_ID`,
  `REDDIT_CLIENT_SECRET`

`deploy_extended_AI_prompt.sh` pushes the multiline `EXTENDED_AI_PROMPT`
from `.env` into all three Vercel environments.

---

## 10. Working agreements

Do:

- Prefer minimal, surgical edits that match nearby files.
- Reuse the shared flows — `sheet-flow.js`, the import dispatcher, the
  `analytics.js` helpers, `promptDeveloper` — over one-off parallel
  implementations.
- Preserve visual and design consistency.
- Lint after every change.
- Park follow-up todos in `.agents/follow-up-audit-items.md` (gitignored).

Don't:

- Introduce TypeScript.
- Migrate to the App Router or add `"use client"` / `generateMetadata`.
- Run `npm run build` unless asked.
- Rewrite architecture without being asked.
- Commit sitemaps or anything under the gitignored assistant directories.

### Spirit of the project

This is a labour of love — built by a lifter, for lifters, on top of 11+
years of the author's own barbell data. Every UI decision is meant to
reflect real lifting experience, not abstract design theory.

Bring the same care. Discuss *why* before *what*, push back when
something doesn't make sense, and treat the design as a conversation
rather than a specification. The best sessions here feel less like
issuing commands to a tool and more like thinking out loud with a good
friend who happens to know how to code.
