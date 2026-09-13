# Themes (How It Works)

Read this when adding or changing a theme, a theme background, or `dark:`
behaviour. Moved out of AGENTS.md so it only loads when needed.

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
