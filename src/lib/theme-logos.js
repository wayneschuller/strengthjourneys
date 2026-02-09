/** @format */

// Static imports for all theme logos - Next.js optimizes these at build time
import logoDark from "../../public/nav_logo_light.png";
import logoLight from "../../public/nav_logo_dark.png";
import logoNeoBrutalism from "../../public/nav_logo_neo-brutalism.png";
// import logoNeoBrutalismDark from "../../public/nav_logo_neo-brutalism-dark.png";
import logoRetroArcade from "../../public/nav_logo_retro-arcade.png";
//import logoRetroArcadeDark from "../../public/nav_logo_retro-arcade-dark.png";

// Fallback logos (existing light/dark logic)
import fallbackDarkLogo from "../../public/nav_logo_light.png";
import fallbackLightLogo from "../../public/nav_logo_dark.png";

// Mapping object: theme name -> logo import
export const logoMap = {
  light: logoLight,
  dark: logoDark,
  "neo-brutalism": logoNeoBrutalism,
  "neo-brutalism-dark": logoNeoBrutalism,
  "retro-arcade": logoRetroArcade,
  "retro-arcade-dark": logoRetroArcade,
  "starry-night": fallbackLightLogo,
  "starry-night-dark": fallbackDarkLogo,
};

/**
 * Get the appropriate logo for a given theme
 * Falls back to light/dark logic if theme-specific logo not found
 * @param {string} theme - The theme name (e.g., "light", "dark", "neo-brutalism")
 * @returns {object} - The logo import object for Next.js Image component
 */
export function getLogoForTheme(theme) {
  if (!theme) {
    return fallbackLightLogo;
  }

  // Debug logging (remove in production if needed)
  if (process.env.NODE_ENV === "development") {
    console.log("[theme-logos] Current theme:", theme);
    console.log("[theme-logos] Available themes:", Object.keys(logoMap));
    console.log("[theme-logos] Theme in map?", logoMap[theme] ? "YES" : "NO");
  }

  // Check if theme-specific logo exists
  if (logoMap[theme]) {
    return logoMap[theme];
  }

  // Fallback to existing light/dark logic
  if (theme.includes("dark")) {
    return fallbackDarkLogo;
  }

  return fallbackLightLogo;
}
