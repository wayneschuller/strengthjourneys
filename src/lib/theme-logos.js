/** @format */

// Static imports for all theme logos - Next.js optimizes these at build time
import logoDark from "../../public/nav_logo_light.png";
import logoLight from "../../public/nav_logo_dark.png";
import logoNeoBrutalism from "../../public/nav_logo_neo-brutalism.png";
import logoRetroArcade from "../../public/nav_logo_retro-arcade.png";
import logoStarryNight from "../../public/nav_logo_starry-night.png";
// Evergreen is vector, Fraunces lettering outlined to paths; pine ink by day,
// cream at night.
import logoEvergreen from "../../public/nav_logo_evergreen.svg";
import logoEvergreenDark from "../../public/nav_logo_evergreen-dark.svg";

// Mapping object: theme name -> logo import
const logoMap = {
  light: logoLight,
  dark: logoDark,
  "neo-brutalism": logoNeoBrutalism,
  "neo-brutalism-dark": logoNeoBrutalism,
  "retro-arcade": logoRetroArcade,
  "retro-arcade-dark": logoRetroArcade,
  "starry-night": logoStarryNight,
  "starry-night-dark": logoStarryNight,
  evergreen: logoEvergreen,
  "evergreen-dark": logoEvergreenDark,
};

/**
 * The nav logo for a theme. A theme with no logo of its own (blueprint) gets
 * the stock light or dark one.
 *
 * @param {string} theme - The theme name (e.g., "light", "dark", "neo-brutalism")
 * @returns {object} - The logo import object for Next.js Image component
 */
export function getLogoForTheme(theme) {
  if (theme && logoMap[theme]) return logoMap[theme];
  return theme?.includes("dark") ? logoDark : logoLight;
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
