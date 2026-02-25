
import Link from "next/link";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { estimateE1RM } from "@/lib/estimate-e1rm";
import {
  PlayCircle,
  StickyNote,
  ArrowUpRight,
  ArrowDownRight,
  Trophy,
  Medal,
} from "lucide-react";
import {
  LiftTypeIndicator,
  bigFourURLs,
} from "@/components/lift-type-indicator";
import { getLiftSvgPath } from "@/components/year-recap/lift-svg";
import {
  getStrengthLevelForWorkouts,
  getStandardForLiftDate,
  STRENGTH_LEVEL_EMOJI,
} from "@/hooks/use-athlete-biodata";
import { getDisplayWeight } from "@/lib/processing-utils";
import { getRatingBadgeVariant } from "@/lib/strength-level-ui";

/**
 * Renders a block of workout sets for a single lift type. Shows reps×weight pills with
 * PR indicators (lifetime/yearly), notes, and video links. In "full" variant also shows
 * tonnage comparison and strength level when bio data is available.
 *
 * @param {Object} props
 * @param {"full"|"compact"} [props.variant="full"] - Display mode. "full" shows full layout with
 *   tonnage and strength level; "compact" shows a condensed row of pills, used in MostRecentSessionCard.
 * @param {string} props.liftType - Display name of the lift (e.g. "Bench Press").
 * @param {Array<{reps: number, weight: number, unitType?: string, lifetimeRanking?: number, yearlyRanking?: number, notes?: string, URL?: string, lifetimeSignificanceAnnotation?: string, yearlySignificanceAnnotation?: string}>} props.workouts - Array of set objects.
 * @param {Object} [props.perLiftTonnageStats] - Map of liftType -> {currentLiftTonnage, avgLiftTonnage, sessionCount, pctDiff, unitType}. Used in full variant for tonnage comparison.
 * @param {string} [props.authStatus] - Session auth status; strength level shown only when "authenticated".
 * @param {boolean} [props.hasBioData] - Whether athlete bio (age, bodyweight, sex) is available for strength standards.
 * @param {Object} [props.standards] - Map of liftType -> strength standard objects for age/bodyweight adjustment.
 * @param {string} [props.e1rmFormula="Brzycki"] - E1RM formula for estimates (Brzycki, Epley, etc.).
 * @param {string} [props.sessionDate] - Session date (YYYY-MM-DD) for age-at-time-of-lift in strength standards.
 * @param {number} [props.age] - Athlete age for strength standards.
 * @param {number} [props.bodyWeight] - Athlete bodyweight for strength standards.
 * @param {string} [props.sex] - Athlete sex for strength standards.
 * @param {boolean} [props.isMetric] - Whether to use kg for strength standards.
 * @param {boolean} [props.hideSvg=false] - When true, hides the lift type SVG/diagram in compact variant.
 * @param {string} [props.label] - Optional label (e.g. date string) shown before the pills.
 */
export function SessionExerciseBlock({
  variant = "full",
  liftType,
  workouts,
  perLiftTonnageStats,
  authStatus,
  hasBioData,
  standards,
  e1rmFormula,
  sessionDate,
  age,
  bodyWeight,
  sex,
  isMetric,
  hideSvg = false,
  label,
}) {
  const formula = e1rmFormula || "Brzycki";
  let bestE1rm = 0;
  const e1rms = workouts.map((w) =>
    estimateE1RM(w.reps ?? 0, w.weight ?? 0, formula),
  );
  workouts.forEach((w, i) => {
    const e1rm = e1rms[i];
    if (e1rm > bestE1rm) bestE1rm = e1rm;
  });
  // All indices with equal best e1rm (e.g. 3x5 top sets) get highlighted
  const bestE1rmIndices = new Set(
    workouts
      .map((w, i) => (e1rms[i] >= bestE1rm - 1e-6 ? i : null))
      .filter((i) => i != null),
  );

  const e1rmMin = Math.min(...e1rms);
  const e1rmMax = Math.max(...e1rms);
  const e1rmRange = e1rmMax - e1rmMin || 1;

  function getSizeForE1rm(e1rm) {
    const t = (e1rm - e1rmMin) / e1rmRange;
    if (t < 0.2) return { text: "text-xs", pad: "px-2 py-1.5" };
    if (t < 0.4) return { text: "text-sm", pad: "px-2.5 py-2" };
    if (t < 0.6) return { text: "text-base", pad: "px-3 py-2" };
    if (t < 0.8) return { text: "text-lg", pad: "px-3.5 py-2.5" };
    return { text: "text-xl", pad: "px-4 py-3" };
  }

  // Groups: consecutive sets with same reps×weight (e.g. 3x5 of 60kg)
  const groups = [];
  let currentGroup = [];
  let currentKey = null;
  workouts.forEach((w, i) => {
    const key = `${w.reps}×${w.weight}`;
    if (key !== currentKey) {
      if (currentGroup.length > 0) groups.push(currentGroup);
      currentGroup = [i];
      currentKey = key;
    } else {
      currentGroup.push(i);
    }
  });
  if (currentGroup.length > 0) groups.push(currentGroup);

  // Initially highlighted: PRs or all sets with best e1rm (full variant only)
  const initiallyHighlighted = new Set(
    workouts
      .map((w, i) =>
        w.lifetimeRanking !== -1 || bestE1rmIndices.has(i) ? i : null,
      )
      .filter((i) => i != null),
  );
  const highlightedIndices = new Set();
  groups.forEach((group) => {
    if (group.some((i) => initiallyHighlighted.has(i))) {
      group.forEach((i) => highlightedIndices.add(i));
    }
  });

  const highlightClass = "border-emerald-500/30 bg-emerald-500/5";
  const isCompact = variant === "compact";

  // Compact: big four uses SVG; full always uses LiftTypeIndicator
  const svgPath = isCompact && !hideSvg ? getLiftSvgPath(liftType) : null;

   const canShowStrengthLevel =
    authStatus === "authenticated" &&
    hasBioData &&
    (standards?.[liftType] ||
      (sessionDate && age && bodyWeight != null && sex != null));

  const bestE1rmLastIndex =
    canShowStrengthLevel && bestE1rmIndices.size
      ? Math.max(...bestE1rmIndices)
      : null;

  const basePills = (
    <div className="flex flex-wrap gap-2">
      {workouts.map((workout, index) => {
        const isHighlighted = highlightedIndices.has(index);
        const size = getSizeForE1rm(e1rms[index]);
        const padClass =
          isHighlighted && !isCompact ? "px-3.5 py-2.5" : size.pad;
        const textClass = isHighlighted ? "font-semibold" : "";

        return (
          <div
            key={index}
            className={`flex flex-col gap-1 rounded-lg border transition-colors ${padClass} ${
              isHighlighted ? highlightClass : "border-border/60 bg-muted/30"
            }`}
          >
            <div className="flex items-center gap-2">
              <span className={`tabular-nums ${size.text} ${textClass}`}>
                {workout.reps}×{getDisplayWeight(workout, isMetric ?? false).value}
                {getDisplayWeight(workout, isMetric ?? false).unit}
              </span>
              <div className="flex shrink-0 items-center gap-1.5 md:gap-2">
                {workout.lifetimeRanking !== -1 && (
                  <TooltipProvider delayDuration={0}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span
                          className="text-amber-600 transition-transform hover:scale-110 hover:text-amber-500 dark:text-amber-500 dark:hover:text-amber-400"
                          aria-label="Lifetime PR"
                        >
                          <Trophy className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>
                          Lifetime PR
                          {workout.lifetimeSignificanceAnnotation
                            ? `: ${workout.lifetimeSignificanceAnnotation}`
                            : ""}
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
                {workout.yearlyRanking != null &&
                  workout.yearlyRanking !== -1 && (
                    <TooltipProvider delayDuration={0}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span
                            className="text-blue-600 transition-transform hover:scale-110 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300"
                            aria-label="12-month PR"
                          >
                            <Medal className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>
                            12-month PR
                            {workout.yearlySignificanceAnnotation
                              ? `: ${workout.yearlySignificanceAnnotation} of the year`
                              : ""}
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                {workout.notes && (
                  <TooltipProvider delayDuration={0}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span
                          className="text-muted-foreground hover:text-foreground transition-transform hover:scale-110"
                          aria-label="Note"
                        >
                          <StickyNote className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="max-w-xs">
                          <span className="font-semibold">Note: </span>
                          {workout.notes}
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
                {workout.URL && (
                  <TooltipProvider delayDuration={0}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <a
                          href={workout.URL}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-muted-foreground hover:bg-muted hover:text-foreground inline-flex rounded p-0.5 transition-transform hover:scale-110"
                          aria-label="Video"
                        >
                          <PlayCircle className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
                        </a>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>
                          Click to open video
                          {workout.URL.length > 40
                            ? ` (${workout.URL.slice(0, 37)}…)`
                            : ""}
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>
              {canShowStrengthLevel && index === bestE1rmLastIndex && (
                <div className="ml-1">
                  <LiftStrengthLevel
                    liftType={liftType}
                    workouts={workouts}
                    standards={standards}
                    e1rmFormula={e1rmFormula}
                    sessionDate={sessionDate}
                    age={age}
                    bodyWeight={bodyWeight}
                    sex={sex}
                    isMetric={isMetric}
                    bestSetReps={workout.reps}
                    bestSetWeight={workout.weight}
                    inline
                  />
                </div>
              )}
            </div>
            {(workout.lifetimeSignificanceAnnotation ||
              workout.yearlySignificanceAnnotation) && (
              <span
                className={
                  isHighlighted
                    ? "text-muted-foreground text-sm"
                    : "text-muted-foreground text-xs"
                }
              >
                {workout.lifetimeSignificanceAnnotation}
                {workout.lifetimeSignificanceAnnotation &&
                  workout.yearlySignificanceAnnotation &&
                  ", "}
                {workout.yearlySignificanceAnnotation &&
                  `${workout.yearlySignificanceAnnotation} of the year`}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );

  const compactPills = (
    <div className="flex min-w-0 flex-1 flex-wrap content-center items-center gap-2">
      {groups.map((group) => {
        const firstIdx = group[0];
        const firstWorkout = workouts[firstIdx];
        const count = group.length;

        const isHighlighted = group.some((i) => highlightedIndices.has(i));
        const hasLifetimePR = group.some((i) => workouts[i].lifetimeRanking !== -1);
        const hasYearlyPR = group.some(
          (i) => workouts[i].yearlyRanking != null && workouts[i].yearlyRanking !== -1,
        );
        const lifetimeAnnotation = group
          .map((i) => workouts[i].lifetimeSignificanceAnnotation)
          .find(Boolean);
        const yearlyAnnotation = group
          .map((i) => workouts[i].yearlySignificanceAnnotation)
          .find(Boolean);
        const groupNotes = group
          .map((i, groupIdx) =>
            workouts[i].notes ? { note: workouts[i].notes, setNum: groupIdx + 1 } : null,
          )
          .filter(Boolean);
        const groupURLs = group
          .map((i, groupIdx) =>
            workouts[i].URL ? { url: workouts[i].URL, setNum: groupIdx + 1 } : null,
          )
          .filter(Boolean);

        const { value: weightValue, unit: weightUnit } = getDisplayWeight(
          firstWorkout,
          isMetric ?? false,
        );
        const displayText =
          count > 1
            ? `${count}×${firstWorkout.reps}@${weightValue}${weightUnit}`
            : `${firstWorkout.reps}@${weightValue}${weightUnit}`;

        const padClass = isHighlighted ? "px-3.5 py-2.5" : "px-2.5 py-2";
        const textClass = isHighlighted
          ? "font-semibold text-emerald-600 dark:text-emerald-400"
          : "";

        return (
          <div
            key={firstIdx}
            className={`flex flex-col gap-1 rounded-lg border transition-colors ${padClass} ${
              isHighlighted ? highlightClass : "border-border/60 bg-muted/30"
            }`}
          >
            <div className="flex items-center gap-2">
              <span className={`tabular-nums text-sm ${textClass}`}>
                {displayText}
              </span>
              <div className="flex shrink-0 items-center gap-1.5 md:gap-2">
                {hasLifetimePR && (
                  <TooltipProvider delayDuration={0}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span
                          className="text-amber-600 transition-transform hover:scale-110 hover:text-amber-500 dark:text-amber-500 dark:hover:text-amber-400"
                          aria-label="Lifetime PR"
                        >
                          <Trophy className="h-4 w-4 sm:h-3 sm:w-3" />
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>
                          Lifetime PR
                          {lifetimeAnnotation ? `: ${lifetimeAnnotation}` : ""}
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
                {hasYearlyPR && (
                  <TooltipProvider delayDuration={0}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span
                          className="text-blue-600 transition-transform hover:scale-110 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300"
                          aria-label="12-month PR"
                        >
                          <Medal className="h-4 w-4 sm:h-3 sm:w-3" />
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>
                          12-month PR
                          {yearlyAnnotation
                            ? `: ${yearlyAnnotation} of the year`
                            : ""}
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
                {groupNotes.length > 0 && (
                  <TooltipProvider delayDuration={0}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span
                          className="text-muted-foreground hover:text-foreground transition-transform hover:scale-110"
                          aria-label="Note"
                        >
                          <StickyNote className="h-4 w-4 sm:h-3 sm:w-3" />
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        <div className="flex max-w-xs flex-col gap-1">
                          {groupNotes.map(({ note, setNum }, i) => (
                            <p key={i}>
                              <span className="font-semibold">
                                {count > 1 ? `Set ${setNum}: ` : "Note: "}
                              </span>
                              {note}
                            </p>
                          ))}
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
                {groupURLs.map(({ url, setNum }, i) => (
                  <TooltipProvider key={i} delayDuration={0}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <a
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-muted-foreground hover:bg-muted hover:text-foreground inline-flex rounded p-0.5 transition-transform hover:scale-110"
                          aria-label="Video"
                        >
                          <PlayCircle className="h-4 w-4 sm:h-3 sm:w-3" />
                        </a>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>
                          {count > 1 ? `Set ${setNum}: ` : ""}Click to open video
                          {url.length > 40 ? ` (${url.slice(0, 37)}…)` : ""}
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                ))}
              </div>
              {canShowStrengthLevel && group.includes(bestE1rmLastIndex) && (
                <div className="ml-1">
                  <LiftStrengthLevel
                    liftType={liftType}
                    workouts={workouts}
                    standards={standards}
                    e1rmFormula={e1rmFormula}
                    sessionDate={sessionDate}
                    age={age}
                    bodyWeight={bodyWeight}
                    sex={sex}
                    isMetric={isMetric}
                    bestSetReps={firstWorkout.reps}
                    bestSetWeight={firstWorkout.weight}
                    inline
                  />
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );

  if (isCompact) {
    const liftTypeArea = svgPath ? (
      <div className="flex shrink-0 items-center">
        <img
          src={svgPath}
          alt={`${liftType} diagram`}
          className="h-16 w-auto object-contain"
        />
      </div>
    ) : null;

    return (
      <div
        className={`bg-muted/20 flex h-full min-h-0 flex-col gap-2.5 rounded-xl border sm:flex-row sm:items-center sm:gap-3 ${
          hideSvg ? "px-2 py-1.5 gap-2" : "p-3"
        }`}
      >
        {liftTypeArea &&
          (bigFourURLs[liftType] ? (
            <Link
              href={bigFourURLs[liftType]}
              className="flex shrink-0 justify-center transition-opacity hover:opacity-80 sm:justify-start"
            >
              {liftTypeArea}
            </Link>
          ) : (
            liftTypeArea
          ))}
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          {!hideSvg && (
            <LiftTypeIndicator
              liftType={liftType}
              className="text-base max-w-36 leading-tight"
            />
          )}
          {label && (
            <span className="text-muted-foreground shrink-0 text-xs font-medium">
              {label}
            </span>
          )}
          {compactPills}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-muted/20 rounded-xl border p-4">
      <div className="space-y-3">
        <div className="flex flex-wrap items-baseline gap-2">
          <LiftTypeIndicator liftType={liftType} className="text-lg" />
        </div>
        {basePills}
        {perLiftTonnageStats?.[liftType] && (
          <LiftTonnageRow
            liftType={liftType}
            stats={perLiftTonnageStats[liftType]}
            isMetric={isMetric}
          />
        )}
      </div>
    </div>
  );
}

// One-line tonnage comparison row: current session tonnage vs. 12-month average with a ±% badge.
function LiftTonnageRow({ liftType, stats, isMetric = false }) {
  const {
    currentLiftTonnage,
    avgLiftTonnage,
    sessionCount,
    pctDiff,
    unitType,
  } = stats;
  const displayUnit = isMetric ? "kg" : "lb";
  const currentDisplay = getDisplayWeight({ weight: currentLiftTonnage, unitType }, isMetric).value;
  const avgDisplay = getDisplayWeight({ weight: avgLiftTonnage, unitType }, isMetric).value;

  if (
    !currentLiftTonnage ||
    !sessionCount ||
    sessionCount <= 1 ||
    pctDiff === null
  ) {
    return (
      <p className="text-muted-foreground text-xs">
        Not enough history yet to compare {liftType.toLowerCase()} tonnage over
        the last year.
      </p>
    );
  }

  const isUp = pctDiff > 0;

  return (
    <div
      className={`flex flex-wrap items-center gap-2 ${isUp ? "text-sm" : "text-xs"}`}
    >
      <span className="text-muted-foreground">
        Tonnage: {Math.round(currentDisplay).toLocaleString()}
        {displayUnit} vs {Math.round(avgDisplay).toLocaleString()}
        {displayUnit} avg
      </span>
      <Badge
        variant="outline"
        className={
          isUp
            ? "gap-0.5 border-emerald-500/60 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
            : "gap-0.5 border-red-500/60 bg-red-500/10 text-red-600 dark:text-red-400"
        }
      >
        {isUp ? (
          <>
            <ArrowUpRight className="h-4 w-4" />
            {Math.abs(pctDiff).toFixed(1)}%
          </>
        ) : (
          <>
            <ArrowDownRight className="h-3 w-3" />
            {Math.abs(pctDiff).toFixed(1)}%
          </>
        )}
      </Badge>
    </div>
  );
}

/**
 * Displays the strength level rating (e.g. "Advanced", "Elite") for a set of workouts on a given lift,
 * rendered as an inline pill or styled badge linking to the calculator pre-filled with the best set.
 *
 * @param {Object} props
 * @param {string} props.liftType - Display name of the lift (e.g. "Bench Press").
 * @param {Array<{reps: number, weight: number, unitType?: string}>} props.workouts - Set objects used to derive the best e1RM.
 * @param {Object} [props.standards] - Map of liftType -> strength standard. Used when sessionDate/age/bodyWeight/sex are not provided.
 * @param {string} [props.e1rmFormula] - E1RM formula key (default "Brzycki").
 * @param {string} [props.sessionDate] - Session date (YYYY-MM-DD) for age-adjusted historical standard lookup.
 * @param {number} [props.age] - Athlete age for historical standard lookup.
 * @param {number} [props.bodyWeight] - Athlete bodyweight for standard lookup.
 * @param {string} [props.sex] - Athlete sex for standard lookup.
 * @param {boolean} [props.isMetric] - Whether the athlete uses kg.
 * @param {boolean} [props.inline=false] - When true renders a compact dashed-border pill; when false renders a text link row.
 * @param {number} [props.bestSetReps] - Explicit rep count for the best set (overrides scanning workouts).
 * @param {number} [props.bestSetWeight] - Explicit weight for the best set (overrides scanning workouts).
 * @param {boolean} [props.asBadge=false] - When true renders a shadcn Badge instead of a text link.
 */
export function LiftStrengthLevel({
  liftType,
  workouts,
  standards,
  e1rmFormula,
  sessionDate,
  age,
  bodyWeight,
  sex,
  isMetric,
  inline = false,
  bestSetReps,
  bestSetWeight,
  asBadge = false,
}) {
  const formula = e1rmFormula || "Brzycki";
  const standard =
    sessionDate && age && bodyWeight != null && sex != null
      ? getStandardForLiftDate(
          age,
          sessionDate,
          bodyWeight,
          sex,
          liftType,
          isMetric ?? false,
        )
      : standards?.[liftType];
  const standardsForLift = standard ? { [liftType]: standard } : {};
  const result = getStrengthLevelForWorkouts(
    workouts,
    liftType,
    standardsForLift,
    formula,
  );
  if (!result) return null;

  const { rating, bestE1RM } = result;
  const eliteMax = standard?.elite ?? 0;
  const isBeyondElite = rating === "Elite" && bestE1RM > eliteMax;

  // Best set to prefill the calculator with: use explicit override when provided,
  // otherwise fall back to scanning workouts for the highest e1RM.
  let bestSet = null;
  let bestSetE1RM = 0;
  if (bestSetReps != null && bestSetWeight != null) {
    bestSet = { reps: bestSetReps, weight: bestSetWeight };
    bestSetE1RM = estimateE1RM(bestSetReps, bestSetWeight, formula);
  } else if (Array.isArray(workouts)) {
    for (const w of workouts) {
      const reps = w.reps ?? 0;
      const weight = w.weight ?? 0;
      if (reps === 0 || weight === 0) continue;
      const e1rm = estimateE1RM(reps, weight, formula);
      if (e1rm > bestSetE1RM) {
        bestSetE1RM = e1rm;
        bestSet = { reps, weight };
      }
    }
  }

  const searchParams = new URLSearchParams();
  if (bestSet) {
    searchParams.set("reps", String(bestSet.reps));
    searchParams.set("weight", String(bestSet.weight));
  }
  searchParams.set("calcIsMetric", (isMetric ?? false).toString());
  searchParams.set("formula", formula);

  if (age != null && bodyWeight != null && sex && liftType) {
    searchParams.set("AthleteAge", String(age));
    searchParams.set("AthleteBodyWeight", String(bodyWeight));
    searchParams.set("AthleteSex", String(sex));
    searchParams.set("AthleteLiftType", liftType);
    searchParams.set("advanced", "true");
  }

  const href = `/calculator?${searchParams.toString()}`;
  const ratingLabel = isBeyondElite ? "Beyond Elite" : rating;
  const ratingEmoji =
    isBeyondElite ? STRENGTH_LEVEL_EMOJI.Elite : STRENGTH_LEVEL_EMOJI[rating] ?? "";
  const ratingContent = (
    <span className="text-foreground font-semibold">
      {ratingEmoji} {ratingLabel}
    </span>
  );

  if (asBadge) {
    return (
      <Link
        href={href}
        aria-label={`${liftType} strength level: ${ratingLabel}`}
        className="inline-flex"
      >
        <Badge
          variant={getRatingBadgeVariant(rating)}
          className="inline-flex items-center gap-1 cursor-pointer"
        >
          {ratingEmoji && <span>{ratingEmoji}</span>}
          <span>{ratingLabel}</span>
        </Badge>
      </Link>
    );
  }

  return (
    <Link
      href={href}
      className={
        inline
          ? "text-muted-foreground hover:text-foreground inline-flex items-center gap-1 rounded-full border border-dashed px-2.5 py-0.5 text-xs font-medium transition-colors hover:bg-muted/40"
          : "text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 rounded-md py-1 text-base font-medium transition-colors hover:underline"
      }
    >
      {inline ? (
        <>
          <span className="sr-only">{liftType} strength level</span>
          {ratingContent}
        </>
      ) : (
        <>
          {liftType} strength level: {ratingContent}
        </>
      )}
    </Link>
  );
}
