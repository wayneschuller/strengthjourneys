# AGENTS.md

This document provides guidance for autonomous coding agents operating in the
Strength Journeys repository.

The project is a **Next.js 16 application using the Pages Router (JavaScript only)**
and is deployed on Vercel.

---

## 1. Build, Lint, and Test Commands

---

### Install Dependencies

```
npm install
```

### Local Development

```
npm run dev
```

Starts the Next.js dev server with Turbopack.

If Turbopack itself seems to be the problem, fall back to:

```
npm run dev:webpack
```

### Production Build

```
npm run build
```

Notes:

- Runs `next build`
- Automatically runs `next-sitemap` as a postbuild step
- Must succeed before pushing to production

### Sitemaps

Two sitemaps, both generated - never commit sitemap files to git:

- `/sitemap.xml` + `/sitemap-0.xml` - static routes, written into `public/` by
  `next-sitemap` at postbuild time from `next-sitemap.config.js`
- `/server-sitemap.xml` - Sanity article slugs, served on request by
  `src/pages/server-sitemap.xml.js` so new articles appear without a deploy

Both are listed in the generated `robots.txt` and should both be submitted in
Google Search Console.

### Lint Entire Project

```
npm run lint
```

This runs ESLint over `src/`.

### Lint a Single File

```
npx eslint src/path/to/file.js
```

Use this when making focused changes.

### Tests

There is currently **no test framework configured**.

What exists instead is a small set of standalone node scripts under `scripts/`,
run against public-shaped fixtures in `fixtures/imports/`:

```
npm run validate:hevy      # Hevy importer regression checks
```

Run it whenever you touch import parsing. Otherwise validation = lint. Only run
`npm run build` when the user asks or when you specifically need production-build
confirmation.

Other commands worth knowing: `npm run build:analyze` for bundle analysis.
Node `>=24` is required (see `engines` in `package.json`). Formatting is
Prettier with `prettier-plugin-tailwindcss` (`.prettierrc`).

---

## 2. Architecture Overview

---

- Next.js 16
- Pages Router (NOT App Router)
- JavaScript only (NO TypeScript)
- React 19
- Tailwind CSS v4
- shadcn/ui (Radix primitives)
- Recharts for charts
- NextAuth v4 (Google OAuth)
- Google Sheets is the primary user data source
- Lightweight lifecycle/support metadata is stored in Vercel KV
- Founder/support notification emails use Resend on best-effort server-side paths

Key data flow:

1. `src/pages/api/sheet/read.js` fetches linked sheet values + Drive metadata
2. `src/lib/data-sources/import-dispatcher.js` handles file-import format detection and parsing
3. `src/lib/parse-data.js` and parser utilities normalize rows into canonical lift objects
4. `src/lib/processing-utils.js` computes historical PRs, tonnage, and derived lift summaries
5. `src/hooks/use-userlift-data.js` is the central app data provider

Important supporting flows:

1. `src/pages/api/sheet/resolve.js` decides bootstrap/recovery/switch-sheet flow
2. `src/lib/sheet-flow.js` contains the shared sheet-linking/provisioning logic
3. `src/pages/api/sheet/import-history.js` handles authenticated import merges into the linked sheet
4. `src/components/onboarding/import-workflow-section.js` and `src/components/onboarding/sheet-setup-dialog.js` are the main import entry points

All lifting analysis is client-side. The server does store limited operational
metadata in KV for onboarding, recovery, and support visibility, but not the
user's analyzed training state.

### Repository Layout

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

Root config worth knowing about:

- `next.config.js` — remote image hosts plus a long list of SEO redirects, each
  carrying a dated comment explaining why it exists
- `next-sitemap.config.js` — static-route sitemap; deliberately emits `<loc>`
  only, because a blanket `lastmod` that resets every deploy is a freshness
  claim we cannot back up
- `eslint.config.mjs` — see State & Effects below
- `components.json` — shadcn config: JS not TSX, `neutral` base, CSS variables,
  `@magicui` registry
- `vercel.json` — daily `/api/playlist-health` cron
- `jsconfig.json` — the `@/*` → `./src/*` alias

#### Routes (`src/pages/`)

Tool pages are flat files: `index.js` (home dashboard), `visualizer.js`,
`tonnage.js`, `log.js`, `lift-explorer.js`, `timer.js`,
`ai-lifting-assistant.js`, `strength-year-in-review.js`,
`gym-playlist-leaderboard.js`, plus the SEO calculator pages
(`1000lb-club-calculator.js`, `how-strong-am-i.js`,
`warm-up-sets-calculator.js`, `plate-milestones.js`, and friends).

Content and hub clusters use dynamic routes: `articles/[slug].js`,
`articles/page/[page].js`, `calculator/[slug].js`, `strength-levels/[lift].js`,
`progress-guide/[lift].js`, `import/[slug].js`.

#### API Routes (`src/pages/api/`)

- **`api/sheet/*`** — the Google Sheets surface. `read.js` is the primary read
  proxy. `resolve.js` decides the bootstrap/recovery/switch-sheet flow.
  `provision.js`, `link.js`, `unlink.js`, `enrich.js` handle sheet setup.
  Writes are *operation-oriented*, not REST-over-rows: `insert-row.js`,
  `edit-row.js`, `edit-cell.js`, `delete-row.js`, `delete.js`,
  `fix-date-outlier.js`, `import-history.js`. Each file's header comment
  explains why it earns its own operation — read it before adding a new one.
- **`api/auth/[...nextauth].js`** — NextAuth v4 Google OAuth, token refresh,
  and `promptDeveloper(...)`, the existing founder email transport.
- **`api/chat.js`, `api/chat/quota.js`, `api/chat/suggestions.js`** — the AI
  lifting assistant. Suggestions are split out so the main answer stream closes
  promptly.
- **Playlists:** `playlists.js`, `vote-playlist.js`, `vote-weight.js`,
  `playlist-art.js`, `playlist-preview.js`, `report-playlist.js`,
  `playlist-health.js` (cron), `revalidate-leaderboard.js`.
- **Best-effort telemetry/support:** `feedback.js`, `onboarding-event.js`,
  `import-limit-event.js`, `import/profile.js`. These must stay best-effort —
  never block or slow a user path.

#### Hooks (`src/hooks/`)

`use-userlift-data.js` is the heart of the app: the `UserLiftingDataProvider`
context owning fetching, parsing, demo mode, imported-file mode, and every
shared derived metric. Its context value includes `parsedData`, `liftTypes`,
`topLiftsByTypeAndReps` (and the last-12-months variant), `topTonnageByType`,
`sessionTonnageLookup`, `streakLeaderboard`, `sheetInfo`, `isDemoMode`,
`isImportedData`, `isReadOnly`, `dataQualityWarnings`, and the mutators
`selectSheet`, `clearSheet`, `importFile`, `clearImportedData`, `mutate`.

**Consume derived data from this context — do not recompute PRs or tonnage in a
component.**

Other hooks: `use-timer`, `use-lift-colors`, `use-athlete-biodata`,
`use-state-from-query-or-localStorage` (persisted + shareable URL state for the
calculators), `use-toast`, `use-reward-progress`, `use-has-coarse-pointer`.

#### Lib (`src/lib/`)

- **Import pipeline:** `data-sources/import-dispatcher.js` is the single entry
  point, with two functions — `parseData(rows)` for Google Sheets (Strength
  Journeys format only, read/write) and `parseImportedFile(file)` for
  drag-and-drop CSV/XLSX (any format, view-only). Per-vendor parsers sit beside
  it: `hevy-parser.js`, `strong-parser.js`, `stronglifts-parser.js`,
  `btwb-parser.js`, `wodify-parser.js`, `turnkey-parser.js`,
  `strength-journeys-parser.js`, sharing `parser-utilities.js`,
  `decode-csv.js`, `decode-workbook.js`. `parse-data.js` is now a thin
  re-export kept for older import sites.
- **Processing:** `processing-utils.js` — PRs, tonnage, lift types, session
  lookups, `devLog()`, and the timing log. `estimate-e1rm.js` — the E1RM
  formulae and bodyweight-load handling.
- **Sheet flow:** `sheet-flow.js`, `sheet-flow-errors.js`,
  `sheet-row-identity.js`, `sheet-row-ops.js`, `pending-sheet-action.js`.
- **Server state:** `kv.js` (Upstash/Vercel KV client) and `user-kv-keys.js`,
  which owns the `sj:user:<email>` key convention and the read-modify-write
  helpers. Never interpolate that key inline.
- **Other domains:** `analytics.js` (GA4 helpers and `GA_EVENT_TAGS`),
  `sanity-io.js`, `localStorage-keys.js`, `strength-circles/`, `rewards/`,
  `home-dashboard/`, `import/`, `data-quality/`, `warmups.js`,
  `consistency.js`, `playlist-*.js`, `founder-*.js`.

#### Components (`src/components/`)

Feature-grouped. The shared shell lives in `ui-shell/` (`layout.js`,
`nav-bar.js`, `footer.js`, `theme-provider.js`, `theme-chooser.js`,
`app-background.js`, `theme-backgrounds.js`, `avatar-menu.js`,
`analytics-session.js`), shadcn primitives in `ui/`. Feature folders:
`home-dashboard/` (with `inspiration-cards/` and `long-game/`), `visualizer/`,
`lift-explorer/`, `log/`, `onboarding/`, `ai-assistant/`, `ai-elements/`
(composable chat UI blocks), `year-recap/`, `strength-circles/`,
`strength-level/`, `big-four/`, `homepage/`, `playlist-leaderboard/`,
`warmups/`, `rewards/`, `feedback/`, `magicui/`.

### Sanity CMS

- Blog content lives in the sibling repo `/home/schuller/hacking/strength-journeys-sanity-studio`, not in this app repo
- The front-end reads Sanity content via `src/lib/sanity-io.js`
- Verified studio target: project `czypnl5j`, dataset `production`
- For browsing or writing articles, prefer running Sanity CLI commands from the sibling studio repo because that environment may already have authenticated local access even when this app repo only has public read config
- A quick read-access check that worked from the studio repo was:

```
npx sanity documents query '*[_type == "post"][0...3]{_id,title,publishedAt}'
```

- If an agent needs to create or edit content programmatically, do it from the sibling studio repo first and treat the app repo as the rendering client unless the user explicitly wants front-end integration changes too
- Be careful with `npx sanity documents create ... --replace`: it behaves like a full document replace, not a patch. Any field omitted from the payload can be dropped
- When replacing an existing post, explicitly preserve metadata fields unless the user asked to remove them:
  - `mainImage`
  - `categories`
  - `publishedAt`
  - `author`
  - `slug`
- Before replacing an existing article, fetch the current document first:

```
npx sanity documents get <document-id>
```

- If a replace accidentally drops metadata like the feature image, recover the prior value from Sanity History API rather than guessing. This worked with the local CLI auth token in `~/.config/sanity/config.json`
- Useful recovery flow for an existing document:
  1. Get recent revision IDs:

```
TOKEN=$(node -pe "JSON.parse(require('fs').readFileSync(process.env.HOME+'/.config/sanity/config.json','utf8')).authToken")
curl -sS -H "Authorization: Bearer $TOKEN" \
  "https://czypnl5j.api.sanity.io/v2025-02-19/data/history/production/transactions/<document-id>?reverse=true&limit=10&excludeContent=true"
```

  2. Fetch the prior document revision:

```
curl -sS -H "Authorization: Bearer $TOKEN" \
  "https://czypnl5j.api.sanity.io/v2025-02-19/data/history/production/documents/<document-id>?revision=<revision-id>"
```

- For rewrite jobs, prefer preserving the original feature image and existing categories unless the user explicitly asks for a new image or taxonomy change
- If the user asks to publish or schedule a post, set `publishedAt` explicitly in the payload. Do not assume the previous date should be kept

### Global Provider Order

Defined in `src/pages/_app.js`, nested in this order:

1. `MotionConfig`
2. `ThemeProvider`
3. `SessionProvider`
4. `UserLiftingDataProvider`
5. `TimerProvider`
6. `LiftColorsProvider`
7. `AthleteBioProvider`
8. `Layout`

---

## 3. Code Style & Conventions

---

### Language Rules

- JavaScript only
- No TypeScript files
- No type annotations
- No TS config changes

### Imports

- Use absolute imports with `@/` alias
  - Example: `import { devLog } from "@/lib/processing-utils"`
- Group imports in this order:
  1. React / Next
  2. Third-party libraries
  3. Internal (`@/...`)
  4. Relative imports
- Remove unused imports

### Formatting

- Follow existing formatting style
- Semicolons are used
- Double quotes preferred
- Keep JSX readable and vertically spaced
- Add inline comments that explain the rationale for a function or non-obvious
  block, not just what the code literally does
- Every source file should start with a short explanatory comment block that
  states the file's role in the system and, when useful, the key constraint or
  design choice future agents should keep in mind
- Exception: for SEO changes informed by Search Console reviews, add one short
  provenance comment near the tuned config or metadata block with the review
  date in `YYYY-MM-DD` format so future agents can distinguish evidence-led
  copy changes from generic template wording

### Components

- Use function components only
- Use hooks (no class components)
- Keep components small and composable
- Feature-based grouping under `src/components/`
- In source files, keep the major exported component or primary function near
  the top of the file, with supporting helpers and smaller subordinate pieces
  placed underneath unless a specific hook/constant ordering requirement forces
  a different structure

Naming:

- Components: `PascalCase`
- Hooks: `useSomething`
- Utils: `camelCase`
- Constants: `UPPER_SNAKE_CASE`

### State & Effects

`eslint.config.mjs` downgrades five `react-hooks` v5 rules from error to warn
(`set-state-in-effect`, `refs`, `purity`, `static-components`, `immutability`)
because this project does not use the React Compiler and they flag pre-existing,
intentional patterns. That downgrade is an amnesty for existing code, not a
licence for new code — treat the warnings as real when writing anything new:

- Avoid calling `setState` directly inside effects unless syncing with external systems
- Avoid impure calls (`Math.random`, `Date.now`) during render
- Prefer `useMemo` for derived data
- Prefer lazy initializers for random or one-time values
- Do not mutate refs during render

### Error Handling

- Fail gracefully in UI
- Avoid crashing the entire page
- Use optional chaining where appropriate
- Log dev-only output via `devLog()`
- Never expose sensitive data in logs

### Data Handling

- Lift objects contain:
  - `date` (YYYY-MM-DD)
  - `liftType`
  - `reps`
  - `weight`
  - `unitType`
  - `isHistoricalPR`
  - `isGoal`
- Do not modify this schema without updating parsing + processing
- Imported file preview data is stored client-side in `sessionStorage` and
  overrides the normal linked-sheet pipeline until cleared
- `sheetInfo` in localStorage is the canonical linked-sheet pointer
- Date ordering in parsed data relies on lexical `YYYY-MM-DD` comparisons;
  avoid unnecessary `new Date(...)` creation in hot paths
- Every localStorage key goes through `LOCAL_STORAGE_KEYS` in
  `src/lib/localStorage-keys.js`, the single source of truth. Do not spell a key
  inline
- Read and write it with `usehooks-ts` `useLocalStorage` / `useReadLocalStorage`
  passing `{ initializeWithValue: false }` so the hook does not touch `window`
  during SSR, or with `useStateFromQueryOrLocalStorage` for values that should
  also be shareable via a URL query param

### Styling

- Use Tailwind utility classes
- Themes are defined in `globals.css`
- Use existing CSS variables (e.g., `--heatmap-0` through `--heatmap-4`)
- Preserve established design patterns
- Do not introduce random new color systems

#### Themes (How It Works)

Theme system is a mix of `next-themes` + CSS variable packs.

- **Theme provider:** `src/pages/_app.js` wraps the app with `ThemeProvider` (a thin wrapper around `next-themes` in `src/components/ui-shell/theme-provider.js`).
  - `attribute="class"` means the active theme name is applied as a class on the `html` element.
  - The allowed theme names are the `themes=[...]` list in `src/pages/_app.js`. `ThemeChooser` reads this list via `useTheme().themes`.

- **Theme definitions:** `src/styles/globals.css` defines each theme as a CSS selector that sets shadcn-style CSS variables (`--background`, `--foreground`, `--primary`, etc.) plus app-specific tokens.
  - Base tokens live under `:root` and `.dark`.
  - Additional theme packs are classes like `.neo-brutalism`, `.neo-brutalism-dark`, `.blueprint`, `.blueprint-dark`, `.retro-arcade`, `.retro-arcade-dark`, `.starry-night`, `.starry-night-dark`.
  - Heatmap colors come from `--heatmap-0` through `--heatmap-4` and are consumed by `.react-calendar-heatmap .color-heatmap-*` rules in the same file.
  - Fonts are set per theme via variables like `--font-sans`; required font files are imported in `src/pages/_app.js`.

- **`dark:` Tailwind variant:** `src/styles/globals.css` defines a custom `dark` variant that activates when `html` has one of the dark theme classes (currently `.dark`, `.neo-brutalism-dark`, `.blueprint-dark`, `.retro-arcade-dark`, `.starry-night-dark`).
  - If you add a new `*-dark` theme and expect Tailwind `dark:` utilities to apply inside it, add the new dark class to this `@custom-variant dark` selector.

- **Theme picker + access control:** `src/components/ui-shell/theme-chooser.js`
  - Unauthenticated users are limited to `light` / `dark`.
  - Authenticated users can choose any theme from the registered list and can toggle the animated background option.

- **Animated background option:** stored in localStorage under `LOCAL_STORAGE_KEYS.ANIMATED_BACKGROUND`.
  - The toggle is surfaced in `ThemeChooser` and consumed by `src/components/ui-shell/app-background.js`.
  - `AppBackground` avoids SSR/CSR mismatch by assuming `light` until mounted.

- **Theme-specific backgrounds:** `src/components/ui-shell/app-background.js` picks a background layer based on theme + animated preference.
  - Vanilla `light/dark`: grid pattern; animated version uses `AnimatedGridPattern`.
  - `neo-brutalism*`: when animated enabled, uses layered `FlickeringGrid` with theme-tuned colors.
  - `retro-arcade*`: when animated enabled, uses `WarpBackground` from `src/components/ui-shell/theme-backgrounds.js`.
  - `starry-night*`: uses `StarryNightLayer` from `src/components/ui-shell/theme-backgrounds.js` (static or gently animated depending on the toggle) and suppresses the grid.

- **Theme logos (optional):** `src/lib/theme-logos.js` maps theme name -> logo asset for nav.

Checklist for adding a new theme (always add a dark variant too):

1. Add `.your-theme` and `.your-theme-dark` blocks to `src/styles/globals.css` defining the core shadcn tokens + `--heatmap-0..4`.
2. Add both names to `themes=[...]` in `src/pages/_app.js`.
3. If you want Tailwind `dark:` utilities to work in `.your-theme-dark`, extend the `@custom-variant dark` selector in `src/styles/globals.css`.
4. If the theme needs a custom background, extend the theme checks/branches in `src/components/ui-shell/app-background.js`.
5. If the theme needs a custom nav logo, add an asset and extend `src/lib/theme-logos.js`.

### Charts

- Use Recharts
- Wrap charts in `ResponsiveContainer`
- Memoize heavy computed datasets
- Keep tooltip components lightweight

### Performance

- Memoize derived datasets
- Avoid unnecessary re-renders
- Avoid expensive computations inside render
- Avoid deep object recreation inside JSX
- Prefer single-pass summaries over extra server-side scans, especially in API
  routes that already process large import payloads

---

## 4. SEO & Static Generation

---

- Use `getStaticProps` for ISR pages
- Use `NextSeo` for metadata
- When tuning titles/meta descriptions from GSC evidence, prefer concise
  inline provenance comments such as `GSC review 2026-03-07` over long notes
- Do NOT migrate to App Router patterns
- Do NOT introduce `"use client"` directives
- Do NOT use `generateMetadata`

The project is intentionally committed to the Pages Router.

---

## 5.5. API and Import Flow Notes

---

- The primary linked-sheet read route is `src/pages/api/sheet/read.js`, not the
  older `read-gsheet.js` path referenced in some historical docs/comments
- Import parsing can happen for anonymous users entirely client-side
- Import merges into a linked Google Sheet only happen for authenticated users
  through `src/pages/api/sheet/import-history.js`
- Founder/support notifications should stay best-effort and should not add
  visible extra client requests unless the user explicitly wants that tradeoff
- If adding metadata for founder/support emails, keep it lightweight and
  support-oriented rather than product-analytics-heavy
- Existing server-side founder email transport lives in
  `src/pages/api/auth/[...nextauth].js` via `promptDeveloper(...)`

## 5.6. KV User Funnel Analysis Task

---

When the user asks to review KV user metadata, onboarding success, returning
users, manual email/support notes, or acquisition funnel quality, treat the work
as a product-analysis task, not just a stats dump.

Goal: determine which acquisition surfaces bring real lifters to activation,
real data usage, repeat visits, feedback, and eventual support/donation signals.
The useful question is not which CTA got sign-ins, but which CTA/source produced
activated lifters who saw value and came back.

Use read-only KV access. Do not write KV, delete keys, or store exported user
metadata in the repo. Keep the existing privacy boundary: report aggregates and
masked examples unless the user explicitly asks for identifiable support context.

Core KV sources and fields:

- User records: `sj:user:<email>`
- Daily aggregate sign-in attribution:
  `sj:metrics:signin:daily:<YYYY-MM-DD>`, keyed by `<page>|<cta>`
- Useful per-user fields include `firstSignInAt`, `lastSignInAt`,
  `signInCount`, `firstSignInPage`, `firstSignInCta`, `lastSignInPage`,
  `lastSignInCta`, `lastRequiredDriveScopeGranted`, `connectedAt`,
  `activationPromptedAt`, `connectionMethod`, `provisioningMethod`,
  `lastSeenAt`, `lastSheetReadAt`, `sheetReadDays`, `returnPromptedAt`, and
  `provisionedSheetId`

Recommended funnel definitions:

- Sign-in: `firstSignInAt` or daily attribution metric
- Scope success: `lastRequiredDriveScopeGranted === true`
- Scope failure: signed in with `lastRequiredDriveScopeGranted === false` and
  no activation
- Activation: `connectedAt` and/or `provisionedSheetId` present
- Real app usage: successful sheet reads via `lastSheetReadAt` or
  `sheetReadDays`
- Returning user: an existing activated user with `lastSeenAt` or
  `lastSheetReadAt` in the review window, plus stronger evidence from
  multi-day `sheetReadDays`, `returnPromptedAt`, manual replies, support
  exchanges, or donations

For each review:

1. Define the exact date window in UTC and, if relevant, translate it into
   the user's local-date context.
2. Exclude likely internal/test/admin accounts from public-user conclusions and
   state that exclusion.
3. Segment the funnel by `firstSignInPage|firstSignInCta` and compare against
   daily aggregate attribution keys.
4. Cross-check against any manual notes, email/support PDFs, Gmail searches, or
   donation notes the user provides. Manual qualitative evidence should explain
   the reasons behind the KV counts.
5. Verify current code before recommending funnel changes. In particular, do
   not suggest adding Drive-scope education, scope repair, import-first preview,
   stalled-user founder outreach, or CTA metadata tracking without first
   checking whether those paths already exist.
6. Separate conclusions into:
   - what the data says now
   - what is too early to call
   - which product/acquisition experiments are worth trying next
   - what instrumentation gap, if any, blocks a better read

Prefer a concise output table:

`source -> sign-ins -> scope granted -> activated -> sheet-read users -> repeat/return evidence -> qualitative notes -> recommended action`

---

## 5. Git & Branching

---

- `main` = development branch (Vercel preview)
- `stable` = production branch
- Feature branches branch off `main`
- Never delete `stable`
- Do not force push to `main` or `stable`
- If the current branch is `stable` and the user asks for code changes, warn the
  user up front that they are on the production branch before making edits
- Unless the user explicitly asks to work on `stable`, switch to `main` before
  making changes, then keep commits and pushes flowing to `main`

### Commit Messages

Sentence-case, plain English, describing the change in the author's voice — e.g.
*"Close an open PR card by clicking it, not only by finding the X"*. No
`feat:`/`fix:` prefixes, no ticket numbers, no tooling identifiers.

### Deploy Shortcut

When the user says "deploy", they mean:

1. Ensure the worktree is clean.
2. Fetch `origin main stable`.
3. Switch to `stable`.
4. Fast-forward `stable` to `main`: `git merge --ff-only main`.
5. Push `stable` to origin.
6. Switch back to `main`.
7. Confirm the worktree is clean and report the resulting `stable` commit.

Deploys fast-forward, so `stable` stays an exact pointer into `main`'s
history and GitHub reports it as neither ahead nor behind. If step 4 refuses
because it is not a fast-forward, `stable` has commits `main` does not —
stop and report it. Merge `stable` into `main` to reconcile; never force
push to fix it.

---

## 6. Agent Behavior Guidelines

---

Agents operating in this repo should:

- Prefer minimal, surgical edits
- Preserve visual design consistency
- Avoid architectural rewrites unless explicitly requested
- Run lint after every change
- Love the default workflow of committing and pushing to `main` as you go unless
  the user says otherwise
- If you make a tracked repository change and the user has not opted out, finish
  the task by committing and pushing to `main`
- If you discover you are on `stable`, say so immediately before editing and
  move the work to `main` unless the user explicitly wants a production-branch change
- Do not run `npm run build` unless the user explicitly asks (it can disrupt the user's local `npm run dev` flow)
- Never introduce TypeScript
- Never migrate to App Router
- Keep changes aligned with existing conventions
- Park future follow-up tasks and todos in `.agents/follow-up-audit-items.md`
- Prefer reusing shared flows (`sheet-flow.js`, import helpers, analytics
  helpers, `promptDeveloper`) over creating one-off parallel implementations

If unsure, follow existing patterns in nearby files.

---

## 7. Cursor / Copilot Rules

---

There are currently:

- No `.cursor/rules/`
- No `.cursorrules`
- No `.github/copilot-instructions.md`

If added in the future, those rules should take precedence over this file.

---

## 8. Spirit of the Project

---

This project is a labour of love — built by a lifter, for lifters, over many
years of consistent training. The person behind it has 11+ years of barbell
data and genuinely cares that every UI decision reflects real lifting
experience, not abstract design theory.

Agents working here should bring the same care. Good collaborators in this
codebase discuss _why_ before _what_, push back when something doesn't make
sense, and treat the design as a conversation rather than a specification.

The best sessions feel less like issuing commands to a tool and more like
thinking out loud with a good friend who happens to know how to code.

---

End of AGENTS.md
