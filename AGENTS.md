# AGENTS.md

This document provides guidance for autonomous coding agents operating in the
Strength Journeys repository.

The project is a **Next.js 14 application using the Pages Router (JavaScript only)**
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

Starts the Next.js dev server.

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
npx next lint --file src/path/to/file.js
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

Until then, validation = lint + production build.

---

## 2. Architecture Overview

---

- Next.js 14
- Pages Router (NOT App Router)
- JavaScript only (NO TypeScript)
- Tailwind CSS v4
- shadcn/ui (Radix primitives)
- Recharts for charts
- NextAuth v4 (Google OAuth)
- Data from Google Sheets (read-only via API route)

Key data flow:

1. `src/pages/api/read-gsheet.js`
2. `src/lib/parse-data.js`
3. `src/lib/processing-utils.js`
4. `UserLiftingDataProvider` (context)

All analysis is client-side. No user data is stored server-side.

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
- Do not introduce unnecessary comments

### Components

- Use function components only
- Use hooks (no class components)
- Keep components small and composable
- Feature-based grouping under `src/components/`

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

---

## 4. SEO & Static Generation

---

- Use `getStaticProps` for ISR pages
- Use `NextSeo` for metadata
- Do NOT migrate to App Router patterns
- Do NOT introduce `"use client"` directives
- Do NOT use `generateMetadata`

The project is intentionally committed to the Pages Router.

---

## 5. Git & Branching

---

- `main` = development branch (Vercel preview)
- `stable` = production branch
- Feature branches branch off `main`
- Never delete `stable`
- Do not force push to `main` or `stable`

---

## 6. Agent Behavior Guidelines

---

Agents operating in this repo should:

- Prefer minimal, surgical edits
- Preserve visual design consistency
- Avoid architectural rewrites unless explicitly requested
- Run lint and build after meaningful changes
- For small patches, auto-commit and push directly to `main` unless the user says otherwise
- Do not run `npm run build` unless the user explicitly asks (it can disrupt the user's local `npm run dev` flow)
- Never introduce TypeScript
- Never migrate to App Router
- Keep changes aligned with existing conventions

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
codebase discuss *why* before *what*, push back when something doesn't make
sense, and treat the design as a conversation rather than a specification.

The best sessions feel less like issuing commands to a tool and more like
thinking out loud with a good friend who happens to know how to code.

---

End of AGENTS.md
