# AGENTS.md

This document provides guidance for autonomous coding agents operating in the
Strength Journeys repository.

The project is a **Next.js 16 application using the Pages Router (JavaScript only)**
and is deployed on Vercel.

Longer workflows live in `docs/agents/` and are only worth reading when the task
calls for them:

- `docs/agents/articles.md` when writing, editing, or publishing articles
- `docs/agents/kv-funnel-review.md` when reviewing KV user metadata, onboarding
  funnels, returning users, or acquisition quality
- `docs/agents/themes.md` when adding or changing a theme, theme background, or
  `dark:` behaviour

---

## 1. Commands

---

```
npm run dev            # Turbopack dev server; the user usually has one running
npm run dev:webpack    # fallback when Turbopack itself seems to be the problem
npx eslint <paths>     # lint the files you touched
npm run validate:hevy  # importer regression checks against fixtures/imports/
```

There is **no test framework configured**. Validation is lint, plus
`validate:hevy` whenever you touch import parsing.

Do not run `npm run build` unless the user asks. It disrupts the user's local
`npm run dev` flow. It runs `next-sitemap` as a postbuild step.

Node `>=24` is required. Formatting is Prettier with
`prettier-plugin-tailwindcss` (`.prettierrc`).

### Sitemaps

Two sitemaps, both generated - never commit sitemap files to git:

- `/sitemap.xml` + `/sitemap-0.xml` - static routes, written into `public/` by
  `next-sitemap` at postbuild time from `next-sitemap.config.js`
- `/server-sitemap.xml` - article URLs with their `updatedAt` from
  `content/articles/`, served by `src/pages/server-sitemap.xml.js` (kept at this
  URL because Search Console already has it registered)

Both are listed in the generated `robots.txt` and should both be submitted in
Google Search Console.

---

## 2. Architecture Overview

---

React 19, Tailwind CSS v4, shadcn/ui (Radix primitives), Recharts, and NextAuth
v4 (Google OAuth). Google Sheets is the primary user data source. Vercel KV
holds lightweight lifecycle/support metadata. Founder/support notification
emails use Resend on best-effort server-side paths.

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
user's analyzed training state. Import parsing can happen for anonymous users
entirely client-side; merges into a linked Google Sheet only happen for
authenticated users.

### Things That Are Not Obvious From the File Tree

- **`use-userlift-data.js`** is the heart of the app: the
  `UserLiftingDataProvider` context owns fetching, parsing, demo mode,
  imported-file mode, and every shared derived metric. **Consume derived data
  from this context — do not recompute PRs or tonnage in a component.**
- **Import pipeline:** `data-sources/import-dispatcher.js` is the single entry
  point, with two functions — `parseData(rows)` for Google Sheets (Strength
  Journeys format only, read/write) and `parseImportedFile(file)` for
  drag-and-drop CSV/XLSX (any format, view-only). `parse-data.js` is a thin
  re-export kept for older import sites.
- **Sheet writes** in `api/sheet/*` are *operation-oriented*, not
  REST-over-rows. Each file's header comment explains why it earns its own
  operation — read it before adding a new one.
- **KV keys:** `src/lib/user-kv-keys.js` owns the `sj:user:<email>` key
  convention and the read-modify-write helpers. Never interpolate that key
  inline.
- **Best-effort paths:** `feedback.js`, `onboarding-event.js`,
  `import-limit-event.js`, `import/profile.js`, and founder/support emails must
  never block or slow a user path, or add visible extra client requests unless
  the user explicitly wants that tradeoff. Keep founder email metadata
  lightweight and support-oriented. The existing transport is
  `promptDeveloper(...)` in `src/pages/api/auth/[...nextauth].js`.
- **AI assistant:** `api/chat/suggestions.js` is split out from `api/chat.js`
  so the main answer stream closes promptly.
- **`next.config.js`** carries a long list of SEO redirects, each with a dated
  comment explaining why it exists.
- **Articles** are markdown files in `content/articles/`, rendered to HTML at
  build time by `src/lib/articles.js`. Writing and publishing live in
  `docs/agents/articles.md`.
- **`next-sitemap.config.js`** deliberately emits `<loc>` only, because a
  blanket `lastmod` that resets every deploy is a freshness claim we cannot
  back up.

---

## 3. Code Style & Conventions

---

### Imports

- Use absolute imports with `@/` alias
  - Example: `import { devLog } from "@/lib/processing-utils"`
- Group imports in this order:
  1. React / Next
  2. Third-party libraries
  3. Internal (`@/...`)
  4. Relative imports

### Comments and File Structure

- Add inline comments that explain the rationale for a function or non-obvious
  block, not just what the code literally does
- Every source file should start with a short explanatory comment block that
  states the file's role in the system and, when useful, the key constraint or
  design choice future agents should keep in mind
- For SEO changes informed by Search Console reviews, add one short provenance
  comment near the tuned config or metadata block with the review date, such as
  `GSC review 2026-03-07`, so future agents can distinguish evidence-led copy
  changes from generic template wording
- Keep the major exported component or primary function near the top of the
  file, with supporting helpers and smaller subordinate pieces placed underneath
  unless a specific hook/constant ordering requirement forces a different
  structure

### State & Effects

`eslint.config.mjs` downgrades five `react-hooks` v5 rules from error to warn
(`set-state-in-effect`, `refs`, `purity`, `static-components`, `immutability`)
because this project does not use the React Compiler and they flag pre-existing,
intentional patterns. That downgrade is an amnesty for existing code, not a
licence for new code — treat the warnings as real when writing anything new.

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
- Log dev-only output via `devLog()`, and never expose sensitive data in logs
- Prefer single-pass summaries over extra server-side scans, especially in API
  routes that already process large import payloads

### Styling

- Use Tailwind utility classes and the existing theme CSS variables (e.g.,
  `--heatmap-0` through `--heatmap-4`) defined in `globals.css`
- Do not introduce random new color systems
- Charts use Recharts inside `ResponsiveContainer`

---

## 4. SEO & Static Generation

---

- Use `getStaticProps` for ISR pages
- Use `NextSeo` for metadata
- Do NOT migrate to App Router patterns
- Do NOT introduce `"use client"` directives
- Do NOT use `generateMetadata`
- Never introduce TypeScript

The project is intentionally committed to the Pages Router.

---

## 5. Git & Branching

---

- `main` = development branch (Vercel preview)
- `stable` = production branch
- Feature branches branch off `main`
- Never delete `stable`
- Do not force push to `main` or `stable`
- If you discover you are on `stable`, say so immediately before editing and
  move the work to `main` unless the user explicitly wants a production-branch
  change
- Commit and push to `main` as you go. If you make a tracked repository change
  and the user has not opted out, finish the task by committing and pushing

### Commit Messages

Sentence-case, plain English, describing the change in the author's voice — e.g.
*"Close an open PR card by clicking it, not only by finding the X"*. No
`feat:`/`fix:` prefixes, no ticket numbers, no tooling identifiers.

### Working Alongside Other Agents

Several agents may be working in this one checkout at the same time, and the
user is always running a local dev server against it. That is deliberate: work
has to be visible the moment it is written, so agents do not hide in worktrees
here. It means the working tree, the index, and the branch are shared with
people and agents you cannot see.

Stay in your own lane:

- Keep a list of the files you touched, and stage only those:
  `git add -- <your paths>`
- Commit with an explicit pathspec: `git commit -- <your paths>`. That form
  commits the working-tree version of those paths and ignores the index, so a
  neighbour's staged work cannot ride along in your commit
- Never `git add -A`, `git add .`, or `git commit -a`
- Never `git reset --hard`, `git checkout -- .`, or `git stash`. The stash is
  shared, and a hard reset destroys work that is not yours
- Never switch branches. Another agent is mid-edit on this one
- Do not rebase. Rebase demands a clean tree, so with neighbours mid-edit it
  either refuses or, with `--autostash`, pockets their work. To catch up before
  pushing: `git fetch origin main && git merge origin/main`, which tolerates a
  dirty tree as long as the incoming commit does not touch the dirty files.
  Agents on separate areas satisfy that; an occasional merge commit on `main`
  is the accepted cost
- Lint your own files (`npx eslint <your paths>`), not the repo. A repo-wide
  run reports a neighbour's half-finished code as your problem
- A red dev server or a failing build may belong to someone else. Check whether
  the error is in a file you touched before chasing it
- If you do find yourself needing a file another agent is clearly editing, say
  so rather than working around them

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
- Park future follow-up tasks and todos in `.agents/follow-up-audit-items.md`
- Prefer reusing shared flows (`sheet-flow.js`, import helpers, analytics
  helpers, `promptDeveloper`) over creating one-off parallel implementations

If unsure, follow existing patterns in nearby files.

---

## 7. Spirit of the Project

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

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
