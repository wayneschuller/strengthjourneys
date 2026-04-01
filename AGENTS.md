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

- No unit tests
- No integration tests
- No Playwright/Cypress setup

If adding tests:

- Prefer Vitest or Jest
- Co-locate tests as `*.test.js`
- Add a `npm run test` script

Until then, validation = lint. Only run `npm run build` when the user asks or
when you specifically need production-build confirmation.

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
4. `src/components/import-workflow-section.js` and `src/components/sheet-setup-dialog.js` are the main import entry points

All lifting analysis is client-side. The server does store limited operational
metadata in KV for onboarding, recovery, and support visibility, but not the
user's analyzed training state.

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

1. `ThemeProvider`
2. `SessionProvider`
3. `UserLiftingDataProvider`
4. `TimerProvider`
5. `LiftColorsProvider`
6. `AthleteBioProvider`
7. `DevActivityMonitorProvider`

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

### Styling

- Use Tailwind utility classes
- Themes are defined in `globals.css`
- Use existing CSS variables (e.g., `--heatmap-0` through `--heatmap-4`)
- Preserve established design patterns
- Do not introduce random new color systems

#### Themes (How It Works)

Theme system is a mix of `next-themes` + CSS variable packs.

- **Theme provider:** `src/pages/_app.js` wraps the app with `ThemeProvider` (a thin wrapper around `next-themes` in `src/components/theme-provider.js`).
  - `attribute="class"` means the active theme name is applied as a class on the `html` element.
  - The allowed theme names are the `themes=[...]` list in `src/pages/_app.js`. `ThemeChooser` reads this list via `useTheme().themes`.

- **Theme definitions:** `src/styles/globals.css` defines each theme as a CSS selector that sets shadcn-style CSS variables (`--background`, `--foreground`, `--primary`, etc.) plus app-specific tokens.
  - Base tokens live under `:root` and `.dark`.
  - Additional theme packs are classes like `.neo-brutalism`, `.neo-brutalism-dark`, `.blueprint`, `.blueprint-dark`, `.retro-arcade`, `.retro-arcade-dark`, `.starry-night`, `.starry-night-dark`.
  - Heatmap colors come from `--heatmap-0` through `--heatmap-4` and are consumed by `.react-calendar-heatmap .color-heatmap-*` rules in the same file.
  - Fonts are set per theme via variables like `--font-sans`; required font files are imported in `src/pages/_app.js`.

- **`dark:` Tailwind variant:** `src/styles/globals.css` defines a custom `dark` variant that activates when `html` has one of the dark theme classes (currently `.dark`, `.neo-brutalism-dark`, `.blueprint-dark`, `.retro-arcade-dark`, `.starry-night-dark`).
  - If you add a new `*-dark` theme and expect Tailwind `dark:` utilities to apply inside it, add the new dark class to this `@custom-variant dark` selector.

- **Theme picker + access control:** `src/components/theme-chooser.js`
  - Unauthenticated users are limited to `light` / `dark`.
  - Authenticated users can choose any theme from the registered list and can toggle the animated background option.

- **Animated background option:** stored in localStorage under `LOCAL_STORAGE_KEYS.ANIMATED_BACKGROUND`.
  - The toggle is surfaced in `ThemeChooser` and consumed by `src/components/app-background.js`.
  - `AppBackground` avoids SSR/CSR mismatch by assuming `light` until mounted.

- **Theme-specific backgrounds:** `src/components/app-background.js` picks a background layer based on theme + animated preference.
  - Vanilla `light/dark`: grid pattern; animated version uses `AnimatedGridPattern`.
  - `neo-brutalism*`: when animated enabled, uses layered `FlickeringGrid` with theme-tuned colors.
  - `retro-arcade*`: when animated enabled, uses `WarpBackground` from `src/components/theme-backgrounds.js`.
  - `starry-night*`: uses `StarryNightLayer` from `src/components/theme-backgrounds.js` (static or gently animated depending on the toggle) and suppresses the grid.

- **Theme logos (optional):** `src/lib/theme-logos.js` maps theme name -> logo asset for nav.

Checklist for adding a new theme (always add a dark variant too):

1. Add `.your-theme` and `.your-theme-dark` blocks to `src/styles/globals.css` defining the core shadcn tokens + `--heatmap-0..4`.
2. Add both names to `themes=[...]` in `src/pages/_app.js`.
3. If you want Tailwind `dark:` utilities to work in `.your-theme-dark`, extend the `@custom-variant dark` selector in `src/styles/globals.css`.
4. If the theme needs a custom background, extend the theme checks/branches in `src/components/app-background.js`.
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
