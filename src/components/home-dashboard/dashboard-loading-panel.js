/*
 * Home dashboard loading panel for phones and small tablets, shown while a returning lifter's
 * sheet is still on its way. Stacked into one column, the card skeletons filled the whole
 * screen with grey and read as something broken, so this says what is happening instead.
 *
 * The drawing does a rep while we wait. Every lift artwork holds two figures, the start and the
 * finish, so lighting one and then the other plays the lift with no extra assets. The light is
 * a soft mask rather than a crop because some figures overlap (the power clean's plates cross
 * the middle), and a crop would slice them.
 */
import { useState, useEffect } from "react";
import {
  animate,
  motion,
  useMotionTemplate,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from "motion/react";
import { FileUp } from "lucide-react";

import { LiftArtwork } from "@/components/lift-artwork";
import { GOOGLE_SHEETS_ICON_URL } from "@/lib/google-sheets-icon";
import { BIG_FOUR_LIFTS } from "@/lib/lifts/lift-registry";

// One full rep: hold the start, drive to the finish, hold, return. The first swap lands inside
// half a second, because a quick sheet read may only leave time for one.
const REP_SECONDS = 2.2;
const REP_TIMES = [0, 0.2, 0.45, 0.75, 1];
const REP_KEYFRAMES = [0, 0, 1, 1, 0];

// How much of the resting figure stays visible. Enough to read as the other half of the lift.
const RESTING_ALPHA = 0.2;

// Where the light hands from one figure to the other, as a share of the drawing's width. Soft
// on purpose, so overlapping bars and plates fade across the seam instead of being cut.
const SEAM_START = "44%";
const SEAM_END = "56%";

/**
 * A lift drawing that alternates between its start and finish figures, like a rep.
 * With reduced motion it rests on the finish figure.
 *
 * @param {Object} props
 * @param {string} props.liftType - A lift with artwork, e.g. "Back Squat".
 */
function RepSpotlight({ liftType }) {
  const prefersReducedMotion = useReducedMotion();
  // 0 lights the start figure, 1 lights the finish figure.
  const progress = useMotionValue(0);

  useEffect(() => {
    if (prefersReducedMotion) {
      progress.set(1);
      return;
    }
    const controls = animate(progress, REP_KEYFRAMES, {
      duration: REP_SECONDS,
      times: REP_TIMES,
      ease: "easeInOut",
      repeat: Infinity,
    });
    return () => controls.stop();
  }, [prefersReducedMotion, progress]);

  const startAlpha = useTransform(progress, [0, 1], [1, RESTING_ALPHA]);
  const finishAlpha = useTransform(progress, [0, 1], [RESTING_ALPHA, 1]);
  const mask = useMotionTemplate`linear-gradient(to right, rgba(0,0,0,${startAlpha}) ${SEAM_START}, rgba(0,0,0,${finishAlpha}) ${SEAM_END})`;

  return (
    <motion.div
      aria-hidden
      className="inline-block"
      style={{ maskImage: mask, WebkitMaskImage: mask }}
    >
      <LiftArtwork liftType={liftType} size="lg" animate={false} />
    </motion.div>
  );
}

/**
 * Centred loading state for the dashboard below lg: a lift doing reps, what we are reading,
 * and which sheet it is. The row count is unknown until the read returns, so it stays in the
 * header, where the odometer rolls it as the cards arrive.
 *
 * @param {Object} props
 * @param {"sheet"|"preview"} [props.mode] - Source being loaded.
 * @param {string|null} [props.sheetFilename] - Linked sheet name, known before the read returns.
 * @param {string} [props.className] - Extra classes, e.g. to hide it at larger breakpoints.
 */
export function DashboardLoadingPanel({ mode = "sheet", sheetFilename, className = "" }) {
  const [liftType] = useState(() => {
    const drawn = BIG_FOUR_LIFTS.filter((lift) => lift.artwork);
    return drawn[Math.floor(Math.random() * drawn.length)]?.liftType ?? null;
  });

  const isPreviewMode = mode === "preview";
  const label = isPreviewMode ? "Preparing your imported preview" : "Reading your workout data";
  const sourceName = isPreviewMode ? null : (sheetFilename || "Your Google Sheet").trim();

  return (
    <motion.div
      role="status"
      aria-live="polite"
      className={`flex min-h-[60vh] flex-col items-center justify-center gap-5 text-center ${className}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
    >
      {liftType && <RepSpotlight liftType={liftType} />}
      <div className="flex max-w-full flex-col items-center gap-1.5">
        <p className="text-lg font-semibold">{label}</p>
        {isPreviewMode ? (
          <FileUp className="text-muted-foreground h-4 w-4" aria-hidden />
        ) : (
          <p className="text-muted-foreground flex max-w-full items-center gap-1.5 text-sm">
            <img
              src={GOOGLE_SHEETS_ICON_URL}
              alt=""
              className="h-4 w-4 shrink-0"
              aria-hidden
            />
            <span className="truncate">{sourceName}</span>
          </p>
        )}
      </div>
    </motion.div>
  );
}
