/** @format */

// Static imports for all theme logos - Next.js optimizes these at build time
import logoDark from "../../public/nav_logo_light.png";
import logoLight from "../../public/nav_logo_dark.png";
import logoNeoBrutalism from "../../public/nav_logo_neo-brutalism.png";
// import logoNeoBrutalismDark from "../../public/nav_logo_neo-brutalism-dark.png";
import logoRetroArcade from "../../public/nav_logo_retro-arcade.png";
//import logoRetroArcadeDark from "../../public/nav_logo_retro-arcade-dark.png";
import logoStarryNight from "../../public/nav_logo_starry-night.png";

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
  "starry-night": logoStarryNight,
  "starry-night-dark": logoStarryNight,
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

/**
 * Height that keeps a logo's own aspect ratio at a given render width.
 * Static imports carry their intrinsic dimensions, so the nav never has to
 * hardcode a height per theme.
 *
 * @param {object} logo - Logo import object from getLogoForTheme
 * @param {number} width - Render width in pixels
 * @returns {number} - Matching height in pixels
 */
export function getLogoHeight(logo, width) {
  if (!logo?.width || !logo?.height) return width;

  return Math.round((width * logo.height) / logo.width);
}
