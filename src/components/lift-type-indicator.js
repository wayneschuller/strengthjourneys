
import Link from "next/link";
import { useLiftColors } from "@/hooks/use-lift-colors";

export const bigFourURLs = {
  "Back Squat": "/progress-guide/squat",
  "Bench Press": "/progress-guide/bench-press",
  Deadlift: "/progress-guide/deadlift",
  "Strict Press": "/progress-guide/strict-press",
};

/**
 * Returns the best detail-page URL for any lift type.
 * Big four lifts get their dedicated progress guide; everything else
 * goes to the lift explorer with the lift pre-selected.
 *
 * @param {string} liftType - e.g. "Back Squat", "Front Squat"
 * @param {string} [hash] - Optional hash fragment (e.g. "#lift-prs", "#tonnage-chart")
 * @returns {string|null} URL string, or null if liftType is falsy.
 */
export function getLiftDetailUrl(liftType, hash = "") {
  if (!liftType) return null;
  const base =
    bigFourURLs[liftType] ||
    `/lift-explorer?liftType=${encodeURIComponent(liftType)}`;
  return hash ? `${base}${hash}` : base;
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
