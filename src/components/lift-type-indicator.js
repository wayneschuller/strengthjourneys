
import Link from "next/link";
import { useLiftColors } from "@/hooks/use-lift-colors";
import { BIG_FOUR_PROGRESS_GUIDE_PATHS } from "@/lib/big-four-lifts";

export const bigFourURLs = BIG_FOUR_PROGRESS_GUIDE_PATHS;

/**
 * Returns the best detail-page URL for any lift type.
 * Big four lifts get their dedicated progress guide; everything else
 * goes to the lift explorer with the lift pre-selected.
 *
 * @param {string} liftType - e.g. "Back Squat", "Front Squat"
 * @param {string} [hash] - Optional hash fragment (e.g. "#lift-prs", "#tonnage-chart")
 * @param {Object} [query] - Optional query params to add before the hash.
 * @returns {string|null} URL string, or null if liftType is falsy.
 */
export function getLiftDetailUrl(liftType, hash = "", query = {}) {
  if (!liftType) return null;
  const base =
    bigFourURLs[liftType] ||
    `/lift-explorer?liftType=${encodeURIComponent(liftType)}`;
  const params = new URLSearchParams(
    base.includes("?") ? base.slice(base.indexOf("?") + 1) : "",
  );
  Object.entries(query).forEach(([key, value]) => {
    if (value == null || value === "") return;
    params.set(key, String(value));
  });
  const basePath = base.split("?")[0];
  const queryString = params.toString();
  const href = queryString ? `${basePath}?${queryString}` : basePath;

  return hash ? `${href}${hash}` : href;
}

/**
 * Renders a small colored square followed by the lift type name. For the four
 * main barbell lifts the entire element is wrapped in a link to its insight page.
 *
 * @param {Object} props
 * @param {string} props.liftType - The name of the lift (e.g. "Back Squat").
 * @param {string} [props.className] - Additional CSS classes for the wrapper element.
 */
export const LiftTypeIndicator = ({ liftType, className = "" }) => {
  const { getColor } = useLiftColors();
  const color = getColor(liftType);

  // Content to be rendered (color square and lift type text)
  const content = (
    <div className={`flex flex-row items-center ${className}`.trim()}>
      <div
        className="mr-1 h-2.5 w-2.5 shrink-0 rounded-[2px]"
        style={{ backgroundColor: color }}
      />
      <div className="font-bold">{liftType}</div>
    </div>
  );

  const href = getLiftDetailUrl(liftType);
  return href ? (
    <Link href={href} className="underline transition-opacity hover:opacity-70">
      {content}
    </Link>
  ) : (
    content
  );
};
