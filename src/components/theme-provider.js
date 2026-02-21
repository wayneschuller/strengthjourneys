/** @format */

"use client";

import * as React from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";

/**
 * Thin wrapper around next-themes' ThemeProvider that passes all props through.
 * Used as the top-level theme context in `_app.js`.
 *
 * @param {Object} props
 * @param {React.ReactNode} props.children - Child components that will have access to the theme context.
 * @param {...*} props - All other props are forwarded directly to NextThemesProvider (e.g. `attribute`, `defaultTheme`, `themes`).
 */
export function ThemeProvider({ children, ...props }) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
