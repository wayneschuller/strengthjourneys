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

End of AGENTS.md
