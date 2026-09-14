/**
 * The rep-range trophy cabinet for one lift: your best set at one rep, two
 * reps, three, and so on down the ladder.
 *
 * The card is about the set itself: the day, the note you wrote, the clip you
 * filmed, and the way back to that session. Underneath sits a small sparkline
 * of your best at that rep count over time, with the record marked. It replaced a
 * separate singles/triples/fives chart that only ever covered three rep ranges
 * and stacked them on one axis where they tangled; one line per card covers
 * every rep range and keeps each one legible.
 *
 * One card per rep range, all on one page, no tabs — a second view of ten
 * records mostly repeats the first. Opening a record grows it to full width in
 * place and lists the rest of that rep range beneath it, so the overview never
 * goes away and there is nothing to navigate back from.
 *
 * Records that were filmed use the clip's own poster frame as the card, which
 * is the whole reason to bother filming a set.
 */

import { useCallback, useId, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/router";

import { motion, useReducedMotion } from "motion/react";
import { ChevronDown, X } from "lucide-react";
import { useReadLocalStorage, useResizeObserver } from "usehooks-ts";

import { useUserLiftingData } from "@/hooks/use-userlift-data";
import { useLiftColors } from "@/hooks/use-lift-colors";
import { useAthleteBio } from "@/hooks/use-athlete-biodata";
import { getDisplayWeight } from "@/lib/processing-utils";
import {
  formatDateToYmdLocal,
  getReadableDateString,
  parseYmdUtc,
} from "@/lib/date-utils";
import {
  getVideoSourceMeta,
  getVideoThumbnailInfo,
} from "@/lib/video-thumbnails";
import { LOCAL_STORAGE_KEYS } from "@/lib/localStorage-keys";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { VideoLinkButton } from "@/components/log/video-link-button";
import { VideoSourceIcon } from "@/components/log/video-source-icon";
import { LiftStrengthLevel } from "@/components/home-dashboard/session-exercise-block";
import { DemoModeBadge } from "@/components/demo-mode-badge";

// Medals stop at bronze on purpose. The old ladder ran on to 💪👌👏🏆🔥💯🤩,
// which gave #7 a trophy and #9 a hundred-points and read as clip art.
const RANK_MEDALS = ["\u{1F947}", "\u{1F948}", "\u{1F949}"];

const RECENT_RECORD_DAYS = 30;

// Below this the date line already says it; "6 weeks ago" adds nothing.
const STANDING_SINCE_MIN_DAYS = 60;

// Rows merged in by an old import carry a machine-written note. It is not a
// training note and should not occupy the slot reserved for what you thought
// about the lift.
const IMPORT_BOILERPLATE_NOTE = /^\s*strength journeys import\b/i;

// The four rep ranges a cramped panel shows when the caller asks for compact.
const COMPACT_REP_COUNTS = [1, 3, 5, 10];

/**
 * Best set at every rep range for a single lift, as an openable card grid.
 *
 * @param {Object} props
 * @param {string} props.liftType - Display name of the lift (e.g. "Bench Press").
 * @param {boolean} [props.compact] - Show only the headline rep ranges, for narrow panels.
 */
export const LiftTypeRepPRsDisplay = ({ liftType, compact = false }) => {
  const {
    parsedData,
    topLiftsByTypeAndReps,
    topLiftsByTypeAndRepsLast12Months,
    isDemoMode,
  } = useUserLiftingData();
  const { getColor } = useLiftColors();
  const { age, bodyWeight, sex, standards, isMetric } = useAthleteBio();
  const router = useRouter();
  const prefersReducedMotion = useReducedMotion();
  // Two ways of learning our own width, because one is not enough. The
  // observer only ever attaches in a mount-only effect (usehooks-ts 3.1.1), so
  // it silently measures nothing if the node is not there on the first pass.
  // The callback ref measures whenever the node actually lands, whichever
  // render that turns out to be, and the observer takes over for later resizes.
  const containerRef = useRef(null);
  const [attachedWidth, setAttachedWidth] = useState(0);
  const setContainerNode = useCallback((node) => {
    containerRef.current = node;
    if (node) setAttachedWidth(node.getBoundingClientRect().width);
  }, []);
  const { width: observedWidth = 0 } = useResizeObserver({ ref: containerRef });
  const width = observedWidth || attachedWidth;

  // Read the clock once on mount so "5 years ago" stays pure across renders.
  const [todayYmd] = useState(() => formatDateToYmdLocal(new Date()));
  const [openRepOverride, setOpenRepOverride] = useState(null);
  const [scopeOverride, setScopeOverride] = useState(null);

  const e1rmFormula =
    useReadLocalStorage(LOCAL_STORAGE_KEYS.FORMULA, {
      initializeWithValue: false,
    }) ?? "Brzycki";

  // A PR badge in the log links here with ?prScope and ?prReps, so the URL
  // opens the matching record rather than just landing near it.
  const requestedScope =
    router.query.prScope === "yearly" || router.query.prScope === "lifetime"
      ? router.query.prScope
      : null;
  const requestedReps = Number(router.query.prReps);
  const requestedRep =
    Number.isInteger(requestedReps) && requestedReps >= 1 && requestedReps <= 10
      ? requestedReps
      : null;

  const scope = scopeOverride ?? requestedScope ?? "lifetime"; // "lifetime" | "yearly"
  // null means untouched, so the URL still decides; -1 means deliberately closed.
  const openRep =
    openRepOverride === null
      ? requestedRep
      : openRepOverride === -1
        ? null
        : openRepOverride;

  const hasBioData = Boolean(
    age && bodyWeight && standards && Object.keys(standards).length > 0,
  );
  const bio = hasBioData ? { age, bodyWeight, sex, isMetric } : null;

  const activeSource =
    scope === "yearly"
      ? topLiftsByTypeAndRepsLast12Months
      : topLiftsByTypeAndReps;
  const topLiftsByReps = activeSource?.[liftType];

  const repRangesWithData = useMemo(() => {
    if (!topLiftsByReps) return [];

    return topLiftsByReps
      .map((repRange, index) => ({
        repRange,
        repCount: index + 1,
      }))
      .filter(({ repRange }) => repRange?.length > 0)
      .filter(
        ({ repCount }) => !compact || COMPACT_REP_COUNTS.includes(repCount),
      )
      .slice(0, 10);
  }, [topLiftsByReps, compact]);

  // The PR table only keeps the top handful per rep range, so the sparklines
  // read the full log. One pass for all ten rep counts, not one per card.
  const dailyBestsByReps = useMemo(
    () =>
      getDailyBestsByReps(
        parsedData,
        liftType,
        isMetric ?? false,
        scope === "yearly" ? shiftYmdByYears(todayYmd, -1) : null,
      ),
    [parsedData, liftType, isMetric, scope, todayYmd],
  );

  const hasYearlyData = Boolean(
    topLiftsByTypeAndRepsLast12Months?.[liftType]?.some(
      (repRange) => repRange?.length > 0,
    ),
  );

  // A rep range requested by URL may not exist in the active scope.
  const effectiveOpenRep = repRangesWithData.some(
    ({ repCount }) => repCount === openRep,
  )
    ? openRep
    : null;

  const liftColor = getColor(liftType);

  // Container-aware, not viewport-aware: this renders both at full page width
  // on the guide pages and inside a narrow explorer panel.
  const columnCount = compact ? 2 : width >= 1040 ? 3 : width >= 620 ? 2 : 1;
  // Width arrives one paint late, so the grid always starts as a single column.
  // Holding the layout animation until then keeps that first correction from
  // playing as a shuffle every time the page mounts.
  const isLayoutAnimated = !prefersReducedMotion && width > 0;

  const handleToggleRep = (repCount) => {
    setOpenRepOverride(effectiveOpenRep === repCount ? -1 : repCount);
  };

  // Single return on purpose. useResizeObserver attaches its observer in a
  // mount-only effect, so a container that is absent on the first render —
  // while the sheet read is still in flight — is never observed at all, width
  // stays 0, and the grid is stuck at one column for the life of the page.
  // The measured div must exist from the first paint, empty or not.
  return (
    <div ref={setContainerNode} className="space-y-4">
      {repRangesWithData.length === 0 ? (
        topLiftsByReps && (
          <p className="text-muted-foreground text-center">
            No PRs recorded for {liftType} yet.
          </p>
        )
      ) : (
        <>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="flex flex-wrap items-center gap-2 text-xl font-semibold sm:text-2xl">
              {isDemoMode && <DemoModeBadge size="sm" />}
              {liftType} PRs
            </h2>
            {hasYearlyData && (
              <div className="flex items-center rounded-full border p-0.5 text-xs">
                <ScopeButton
                  isActive={scope === "lifetime"}
                  onClick={() => setScopeOverride("lifetime")}
                >
                  Lifetime
                </ScopeButton>
                <ScopeButton
                  isActive={scope === "yearly"}
                  onClick={() => setScopeOverride("yearly")}
                >
                  12 months
                </ScopeButton>
              </div>
            )}
          </div>

          <p className="text-muted-foreground text-sm">
            Your best {liftType} set at every rep range
            {scope === "yearly" ? " in the last 12 months" : ", all time"}. Open
            a record to see the rest of that rep range.
          </p>

          <div
            className="grid gap-4"
            style={{
              gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))`,
            }}
          >
            {repRangesWithData.map(({ repRange, repCount }) => (
              <RepRangeCard
                key={`${liftType}-${scope}-${repCount}`}
                repRange={repRange}
                repCount={repCount}
                dailyBests={dailyBestsByReps[repCount]}
                liftType={liftType}
                liftColor={liftColor}
                isOpen={effectiveOpenRep === repCount}
                // The single is the number people came for, so it gets the room.
                isHero={repCount === 1 && columnCount > 1}
                columnCount={columnCount}
                onToggle={() => handleToggleRep(repCount)}
                scope={scope}
                todayYmd={todayYmd}
                bio={bio}
                standards={hasBioData ? standards : null}
                e1rmFormula={e1rmFormula}
                isMetric={isMetric}
                prefersReducedMotion={prefersReducedMotion}
                isLayoutAnimated={isLayoutAnimated}
                listColumnCount={compact ? 1 : columnCount}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
};

// One rep range: the record as a card, and — when opened — everything else you
// have done at that rep count underneath it.
function RepRangeCard({
  repRange,
  repCount,
  dailyBests,
  liftType,
  liftColor,
  isOpen,
  isHero,
  columnCount,
  onToggle,
  scope,
  todayYmd,
  bio,
  standards,
  e1rmFormula,
  isMetric,
  prefersReducedMotion,
  isLayoutAnimated,
  listColumnCount,
}) {
  const record = repRange[0];
  const poster = useVideoPoster(record?.URL);
  const videoSource = useMemo(
    () => getVideoSourceMeta(record?.URL),
    [record?.URL],
  );

  if (!record) return null;

  const { value, unit } = getDisplayWeight(record, isMetric ?? false);
  const isRecent = isRecordRecent(record.date, todayYmd);
  const standingFor =
    scope === "lifetime" ? formatStandingFor(record.date, todayYmd) : null;
  const note = getDisplayNote(record.notes);
  const olderRecords = repRange.slice(1);
  const hasPoster = Boolean(poster.src);

  const layoutTransition = prefersReducedMotion
    ? { duration: 0 }
    : { duration: 0.28, ease: [0.22, 1, 0.36, 1] };

  // An open card is full of things worth clicking — session links, video
  // links, strength badges, Show more — so closing on a click has to mean a
  // click on the card itself, not on anything standing on it. The X is a
  // button, so its own handler runs and this bows out rather than toggling
  // twice. A click that ends a text selection is not a click either.
  const handleOpenSurfaceClick = (event) => {
    // The sparkline is for hovering and tapping, not for shutting the card.
    if (
      event.target.closest?.(
        "a, button, input, textarea, [role='button'], [data-sparkline]",
      )
    ) {
      return;
    }
    if (window.getSelection?.()?.toString()) return;
    onToggle();
  };

  const strengthBadge = bio ? (
    <LiftStrengthLevel
      liftType={liftType}
      workouts={[
        { reps: repCount, weight: record.weight, unitType: record.unitType },
      ]}
      standards={standards}
      e1rmFormula={e1rmFormula}
      sessionDate={record.date}
      age={bio.age}
      bodyWeight={bio.bodyWeight}
      sex={bio.sex}
      isMetric={bio.isMetric}
      inline
      asBadge
    />
  ) : null;

  return (
    <motion.div
      layout={isLayoutAnimated ? "position" : false}
      transition={layoutTransition}
      className={cn(
        "bg-card relative overflow-hidden rounded-xl border transition-colors",
        !isOpen && "hover:border-foreground/40",
      )}
      style={{
        gridColumn: isOpen
          ? "1 / -1"
          : isHero && columnCount === 3
            ? "span 2"
            : isHero && columnCount === 2
              ? "1 / -1"
              : undefined,
        borderColor: isOpen ? liftColor : undefined,
        // Unfilmed records still get to wear the lift's colour, just quietly.
        backgroundImage: hasPoster
          ? undefined
          : `linear-gradient(135deg, ${liftColor}1f, transparent 62%)`,
      }}
    >
      {hasPoster && !isOpen && (
        <>
          <Image
            src={poster.src}
            alt=""
            fill
            unoptimized
            aria-hidden="true"
            className="object-cover"
            onError={poster.onError}
          />
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/55 to-black/25"
          />
        </>
      )}

      {!isOpen && (
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={false}
          aria-label={`Show all ${repCount}-rep ${liftType} records`}
          className="focus-visible:ring-ring absolute inset-0 z-10 rounded-xl focus-visible:ring-2 focus-visible:outline-none"
        />
      )}

      {!isOpen ? (
        <div
          className={cn(
            "pointer-events-none relative z-20 flex flex-col gap-3 p-4",
            isHero ? "min-h-[13rem]" : "min-h-[10.5rem]",
            hasPoster && "text-white",
          )}
        >
          <div className="flex items-start justify-between gap-2">
            <span
              className={cn(
                "text-xs font-semibold tracking-widest uppercase",
                hasPoster ? "text-white/80" : "text-muted-foreground",
              )}
            >
              {repCount}RM
            </span>
            <div className="pointer-events-auto flex flex-wrap items-center justify-end gap-1.5">
              {isRecent && (
                <Badge variant="secondary" className="text-xs">
                  ⚡ Recent
                </Badge>
              )}
              {strengthBadge}
            </div>
          </div>

          <div className="mt-auto space-y-1">
            {/* The clip belongs beside the number it proves, not exiled to the
                far corner of the card. */}
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  "leading-none font-bold",
                  isHero ? "text-5xl" : "text-4xl",
                )}
                style={{ color: hasPoster ? "#fff" : liftColor }}
              >
                {value}
                <span className={isHero ? "text-3xl" : "text-2xl"}>{unit}</span>
              </div>
              <div className="pointer-events-auto">
                <VideoLinkButton
                  url={record.URL}
                  source={videoSource}
                  size="lg"
                  className={hasPoster ? "bg-white/15 hover:bg-white/25" : ""}
                />
              </div>
            </div>
            <div
              className={cn(
                "text-sm",
                hasPoster ? "text-white/85" : "text-muted-foreground",
              )}
            >
              {getReadableDateString(record.date, true)}
              {standingFor && (
                <span className={hasPoster ? "text-white/70" : ""}>
                  {" · "}
                  {standingFor}
                </span>
              )}
            </div>
            {/* No note on the closed card: it is a glance at the number and
                its trend. What you wrote that day waits inside the card. */}
          </div>

          <RepSparkline
            points={dailyBests}
            recordDate={record.date}
            repCount={repCount}
            unit={unit}
            scope={scope}
            color={hasPoster ? "#ffffff" : liftColor}
            onPoster={hasPoster}
            onClick={onToggle}
            className={isHero ? "h-14" : "h-10"}
          />

          <span
            className={cn(
              "text-xs",
              hasPoster ? "text-white/70" : "text-muted-foreground",
            )}
          >
            {olderRecords.length > 0
              ? `+${olderRecords.length} more ${repCount}RM${olderRecords.length > 1 ? "s" : ""}`
              : "Your only one"}
            <ChevronDown className="ml-1 inline h-3.5 w-3.5" />
          </span>
        </div>
      ) : (
        // Clicking the open card shuts it again, the same way clicking the
        // closed one opened it. The X stays as the visible, keyboard-reachable
        // control; this is the mouse shortcut on top of it.
        <div
          className="relative z-20 cursor-pointer space-y-5 p-5"
          onClick={handleOpenSurfaceClick}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold sm:text-xl">
                {repCount}RM records for {liftType}
              </h3>
              <p className="text-muted-foreground text-sm">
                {scope === "yearly" ? "Last 12 months" : "All time"}, heaviest
                first. Open a set to see the session it came from.
              </p>
            </div>
            <button
              type="button"
              onClick={onToggle}
              aria-label={`Close ${repCount}RM records`}
              className="text-muted-foreground hover:text-foreground hover:bg-muted -mt-1 -mr-1 rounded-full p-1.5 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <motion.div
            initial={prefersReducedMotion ? false : { opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={layoutTransition}
            className="space-y-5"
          >
            <RecordHero
              record={record}
              liftColor={liftColor}
              poster={poster}
              videoSource={videoSource}
              isMetric={isMetric}
              isRecent={isRecent}
              standingFor={standingFor}
              strengthBadge={strengthBadge}
              note={note}
            />

            <RepSparkline
              points={dailyBests}
              recordDate={record.date}
              repCount={repCount}
              unit={unit}
              scope={scope}
              color={liftColor}
              className="h-24"
            />

            {/* Ranked lists read down, so the columns fill top to bottom
                before moving across, rather than row by row. */}
            {olderRecords.length > 0 && (
              <ul
                className="gap-x-8 border-t pt-1"
                style={{ columnCount: listColumnCount }}
              >
                {olderRecords.map((lift, index) => (
                  <RecordRow
                    key={`${lift.date}-${lift.weight}-${index}`}
                    lift={lift}
                    rank={index + 2}
                    repCount={repCount}
                    liftType={liftType}
                    todayYmd={todayYmd}
                    bio={bio}
                    standards={standards}
                    e1rmFormula={e1rmFormula}
                    isMetric={isMetric}
                  />
                ))}
              </ul>
            )}
          </motion.div>
        </div>
      )}
    </motion.div>
  );
}

// The record itself, given room: the clip as a real poster frame rather than a
// background, beside the number and whatever you wrote that day.
function RecordHero({
  record,
  liftColor,
  poster,
  videoSource,
  isMetric,
  isRecent,
  standingFor,
  strengthBadge,
  note,
}) {
  const { value, unit } = getDisplayWeight(record, isMetric ?? false);

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
      {poster.src && (
        <a
          href={record.URL}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`${videoSource?.name ? `Watch on ${videoSource.name}` : "Open the video link"} (opens in a new tab)`}
          className="group bg-muted relative block aspect-video w-full shrink-0 overflow-hidden rounded-lg sm:w-64"
        >
          <Image
            src={poster.src}
            alt=""
            aria-hidden="true"
            fill
            unoptimized
            className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            onError={poster.onError}
          />
          <div className="absolute inset-0 bg-black/20 transition-colors group-hover:bg-black/10" />
          {/* The source mark rather than a VideoLinkButton: that control is an
              anchor of its own, and the whole poster is already the link. */}
          <span className="absolute right-2 bottom-2 inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm transition group-hover:bg-white/35">
            <VideoSourceIcon source={videoSource} className="h-5 w-5" />
          </span>
        </a>
      )}

      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className="text-4xl leading-none font-bold"
            style={{ color: liftColor }}
          >
            {value}
            <span className="text-2xl">{unit}</span>
          </span>
          {isRecent && (
            <Badge variant="secondary" className="text-xs">
              ⚡ Recent
            </Badge>
          )}
          {strengthBadge}
          {/* Google Photos and the rest offer no poster frame, so the mark
              beside the number is all the clip gets. Give it the same weight
              it has on the closed card. */}
          {!poster.src && (
            <VideoLinkButton url={record.URL} source={videoSource} size="lg" />
          )}
        </div>
        <div className="text-muted-foreground text-sm">
          <Link
            href={`/log?date=${record.date}`}
            className="hover:text-foreground transition-colors hover:underline"
          >
            {getReadableDateString(record.date, true)}
          </Link>
          {standingFor && ` · ${standingFor}`}
        </div>
        {note && <TruncatedText text={note} className="mt-2 text-sm" />}
      </div>
    </div>
  );
}

// One of the also-rans for a rep range. A row rather than a card: ten cards of
// ragged height was the old detail view, and it read as a wall.
function RecordRow({
  lift,
  rank,
  repCount,
  liftType,
  todayYmd,
  bio,
  standards,
  e1rmFormula,
  isMetric,
}) {
  const videoSource = useMemo(() => getVideoSourceMeta(lift.URL), [lift.URL]);
  const { value, unit } = getDisplayWeight(lift, isMetric ?? false);
  const note = getDisplayNote(lift.notes);
  const medal = RANK_MEDALS[rank - 1];

  return (
    <li className="border-border/70 flex break-inside-avoid items-start gap-3 border-b py-3">
      <span className="text-muted-foreground w-8 shrink-0 pt-0.5 text-sm font-medium tabular-nums">
        {medal ?? `#${rank}`}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/log?date=${lift.date}`}
            className="text-base font-semibold hover:underline"
          >
            {repCount}@{value}
            {unit}
          </Link>
          {isRecordRecent(lift.date, todayYmd) && (
            <Badge variant="secondary" className="text-xs">
              ⚡ Recent
            </Badge>
          )}
          {bio && (
            <LiftStrengthLevel
              liftType={liftType}
              workouts={[
                {
                  reps: repCount,
                  weight: lift.weight,
                  unitType: lift.unitType,
                },
              ]}
              standards={standards}
              e1rmFormula={e1rmFormula}
              sessionDate={lift.date}
              age={bio.age}
              bodyWeight={bio.bodyWeight}
              sex={bio.sex}
              isMetric={bio.isMetric}
              inline
              asBadge
            />
          )}
          {/* Hangs off the near right of the set, after the weight and the
              rating. The eye scans the numbers down the list first; the clip
              is something you reach for once a set has caught your attention,
              so it must not arrive before the number or sit out at the far
              edge of a very wide row. */}
          <VideoLinkButton url={lift.URL} source={videoSource} />
        </div>
        <div className="text-muted-foreground text-sm">
          {getReadableDateString(lift.date, true)}
        </div>
        {note && (
          <p className="text-muted-foreground mt-1 line-clamp-2 text-sm text-pretty italic">
            {note}
          </p>
        )}
      </div>
    </li>
  );
}

/**
 * Best set over time at one rep count, drawn against real time so a long
 * layoff reads as a long flat stretch rather than being squeezed out. Longer
 * histories are grouped into weeks or months, keeping the heaviest set of each,
 * so the light days between heavy ones stop sawing the line down to the floor.
 * The record gets a dot so the eye can find where the headline number lives.
 *
 * Hovering or touching shows the set behind a point. On the closed card a click
 * on the chart still opens the card, so the chart never steals the card's job.
 */
function RepSparkline({
  points,
  recordDate,
  repCount,
  unit,
  scope,
  color,
  onPoster = false,
  onClick,
  className,
}) {
  const gradientId = `rep-spark-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const [hoverIndex, setHoverIndex] = useState(null);
  const geometry = useMemo(
    () => getSparklineGeometry(points, recordDate),
    [points, recordDate],
  );

  // One day at a rep count is a dot, not a trend. The card already says so.
  if (!geometry) return null;

  const { coords, buckets, recordIndex } = geometry;
  const hovered = hoverIndex === null ? null : coords[hoverIndex];

  const handlePointer = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    if (!rect.width) return;
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    setHoverIndex(findNearestIndex(coords, x));
  };

  return (
    <div
      data-sparkline=""
      className={cn(
        "pointer-events-auto relative w-full touch-pan-y",
        onClick ? "cursor-pointer" : "cursor-crosshair",
        className,
      )}
      onPointerMove={handlePointer}
      onPointerDown={handlePointer}
      onPointerLeave={() => setHoverIndex(null)}
      onClick={onClick}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="absolute inset-0 h-full w-full overflow-visible"
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.28} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <path d={geometry.areaPath} fill={`url(#${gradientId})`} />
        <path
          d={geometry.linePath}
          fill="none"
          stroke={color}
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      {hovered && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 w-px -translate-x-1/2"
          style={{
            left: `${hovered.x}%`,
            backgroundColor: color,
            opacity: 0.45,
          }}
        />
      )}
      {/* HTML dots, because a circle inside a stretched viewBox turns oval. */}
      {[recordIndex, hoverIndex]
        .filter(
          (index, position) =>
            index !== null && (position === 0 || index !== recordIndex),
        )
        .map((index) => (
          <span
            key={index === recordIndex ? "record" : "hover"}
            aria-hidden="true"
            className={cn(
              "pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-full ring-2",
              index === recordIndex ? "size-2" : "size-2.5",
              onPoster ? "ring-black/50" : "ring-card",
            )}
            style={{
              left: `${coords[index].x}%`,
              top: `${coords[index].y}%`,
              backgroundColor: color,
            }}
          />
        ))}
      {hovered && (
        <SparklineTooltip
          bucket={buckets[hoverIndex]}
          x={hovered.x}
          repCount={repCount}
          unit={unit}
          scope={scope}
          isRecord={hoverIndex === recordIndex}
        />
      )}
    </div>
  );
}

// What sits behind one point: the set and the day it was lifted. That it is the
// heaviest of its week or month is left implicit; a heading saying so only
// cluttered it.
function SparklineTooltip({ bucket, x, repCount, unit, scope, isRecord }) {
  // Under the 12 months toggle the marked point is only this year's best, so
  // it must not claim to be the lifetime PR.
  const prLabel = `${scope === "yearly" ? "12-month " : ""}${repCount}RM PR`;

  // Turned inward near either edge, because the card clips anything that
  // spills past its side.
  const transform =
    x < 22 ? "none" : x > 78 ? "translateX(-100%)" : "translateX(-50%)";

  return (
    <div
      role="tooltip"
      className="bg-popover text-popover-foreground pointer-events-none absolute bottom-full z-30 mb-2 w-max max-w-[16rem] space-y-0.5 rounded-lg border px-2.5 py-1.5 text-xs shadow-lg"
      style={{ left: `${x}%`, transform }}
    >
      <div className="text-sm font-semibold">
        {repCount}@{bucket.value}
        {unit}
        {isRecord && <span className="ml-1.5 font-medium">· {prLabel}</span>}
      </div>
      <div className="text-muted-foreground">
        {getReadableDateString(bucket.date, true)}
      </div>
    </div>
  );
}

function ScopeButton({ isActive, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full px-3 py-1 font-medium transition-colors",
        isActive
          ? "bg-foreground text-background"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

// Inline text that truncates to 300 characters with a "Show more / Show less" toggle.
function TruncatedText({ text, className }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const truncLength = 300;

  if (!text) return null;

  const truncatedText =
    text.length > truncLength ? `${text.substring(0, truncLength)}...` : text;

  return (
    <div className={cn("text-muted-foreground text-pretty italic", className)}>
      {isExpanded ? text : truncatedText}
      {text.length > truncLength && (
        <button
          type="button"
          className="text-primary ml-2 text-xs hover:underline"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          {isExpanded ? "Show less" : "Show more"}
        </button>
      )}
    </div>
  );
}

/**
 * Poster frame for a filmed record, with the graceful climb down built in:
 * maxresdefault does not exist for every upload, and only YouTube exposes a
 * thumbnail at all, so a Google Photos clip simply has no poster.
 */
function useVideoPoster(url) {
  const info = useMemo(() => getVideoThumbnailInfo(url), [url]);
  const [failedSrc, setFailedSrc] = useState(null);

  const src =
    info.thumbnailUrl && info.thumbnailUrl !== failedSrc
      ? info.thumbnailUrl
      : info.fallbackThumbnailUrl && info.fallbackThumbnailUrl !== failedSrc
        ? info.fallbackThumbnailUrl
        : null;

  return { src, onError: () => setFailedSrc(src) };
}

/**
 * Heaviest set per day at each rep count from 1 to 10, in the display unit so a
 * log that mixes kg and lb sessions draws one continuous line.
 *
 * @returns {Array<Array<{date: string, value: number}>>} indexed by rep count
 */
function getDailyBestsByReps(parsedData, liftType, isMetric, fromYmd) {
  const byReps = Array.from({ length: 11 }, () => new Map());
  if (!Array.isArray(parsedData)) return byReps.map(() => []);

  for (const entry of parsedData) {
    if (entry.liftType !== liftType || entry.isGoal) continue;
    if (!(entry.reps >= 1 && entry.reps <= 10)) continue;
    if (fromYmd && entry.date < fromYmd) continue;

    const value = Number(getDisplayWeight(entry, isMetric).value);
    if (!Number.isFinite(value)) continue;
    const days = byReps[entry.reps];
    if (!(days.get(entry.date) >= value)) days.set(entry.date, value);
  }

  // parsedData is chronological, so first-seen order is already date order.
  return byReps.map((days) =>
    Array.from(days, ([date, value]) => ({ date, value })),
  );
}

/**
 * Groups daily bests into days, weeks or months by how much time they cover,
 * then lays them out as percentages of the box with a little headroom so the
 * dots are never cropped by the top or bottom edge.
 */
function getSparklineGeometry(points, recordDate) {
  if (!points || points.length < 2) return null;

  const firstTime = parseYmdUtc(points[0].date).getTime();
  const lastTime = parseYmdUtc(points[points.length - 1].date).getTime();
  if (!Number.isFinite(firstTime) || !Number.isFinite(lastTime)) return null;

  const spanDays = (lastTime - firstTime) / 86400000;
  const granularity =
    spanDays <= SPARKLINE_DAILY_MAX_DAYS
      ? "day"
      : spanDays <= SPARKLINE_WEEKLY_MAX_DAYS
        ? "week"
        : "month";

  // Points arrive in date order, so buckets come out in date order too.
  const buckets = [];
  const bucketsByKey = new Map();
  for (const point of points) {
    const key = getBucketKey(point.date, granularity);
    const bucket = bucketsByKey.get(key);
    if (!bucket) {
      const created = { key, date: point.date, value: point.value };
      bucketsByKey.set(key, created);
      buckets.push(created);
      continue;
    }
    // A tie goes to the record's own day so the dot lands where the record is.
    if (
      point.value > bucket.value ||
      (point.value === bucket.value && point.date === recordDate)
    ) {
      bucket.value = point.value;
      bucket.date = point.date;
    }
  }
  if (buckets.length < 2) return null;

  const times = buckets.map(({ date }) => parseYmdUtc(date).getTime());
  const timeSpan = times[times.length - 1] - times[0] || 1;

  let min = Infinity;
  let max = -Infinity;
  for (const { value } of buckets) {
    if (value < min) min = value;
    if (value > max) max = value;
  }
  const valueSpan = max - min;

  const coords = buckets.map(({ value }, index) => ({
    x: ((times[index] - times[0]) / timeSpan) * 100,
    y: valueSpan === 0 ? 50 : 88 - ((value - min) / valueSpan) * 76,
  }));

  const linePath = getMonotonePath(coords);
  const areaPath = `${linePath} L100 100 L0 100 Z`;

  let recordIndex = buckets.findIndex(({ date }) => date === recordDate);
  if (recordIndex === -1 || buckets[recordIndex].value !== max) {
    recordIndex = buckets.findIndex(({ value }) => value === max);
  }

  return { coords, buckets, granularity, recordIndex, linePath, areaPath };
}

// Up to four months, every session is worth seeing. Up to two years, a week is
// the unit a programme thinks in. Past that, months keep a decade readable.
const SPARKLINE_DAILY_MAX_DAYS = 120;
const SPARKLINE_WEEKLY_MAX_DAYS = 730;

function getBucketKey(ymd, granularity) {
  if (granularity === "day") return ymd;
  if (granularity === "month") return ymd.slice(0, 7);
  // Weeks start on Monday, the way most programmes count them.
  const date = parseYmdUtc(ymd);
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
  return date.toISOString().slice(0, 10);
}

// Monotone cubic (Fritsch-Carlson): smooth, but it never bulges past the
// points it joins, so the curve cannot draw a PR that was never lifted.
function getMonotonePath(coords) {
  const n = coords.length;
  const f = (v) => v.toFixed(2);
  if (n < 3) {
    return coords
      .map(({ x, y }, index) => `${index ? "L" : "M"}${f(x)} ${f(y)}`)
      .join(" ");
  }

  const slopes = [];
  for (let i = 0; i < n - 1; i++) {
    const dx = coords[i + 1].x - coords[i].x;
    slopes.push(dx ? (coords[i + 1].y - coords[i].y) / dx : 0);
  }

  const tangents = [slopes[0]];
  for (let i = 1; i < n - 1; i++) {
    tangents.push(
      slopes[i - 1] * slopes[i] <= 0 ? 0 : (slopes[i - 1] + slopes[i]) / 2,
    );
  }
  tangents.push(slopes[n - 2]);

  for (let i = 0; i < n - 1; i++) {
    if (slopes[i] === 0) {
      tangents[i] = 0;
      tangents[i + 1] = 0;
      continue;
    }
    const a = tangents[i] / slopes[i];
    const b = tangents[i + 1] / slopes[i];
    const h = a * a + b * b;
    if (h > 9) {
      const t = 3 / Math.sqrt(h);
      tangents[i] = t * a * slopes[i];
      tangents[i + 1] = t * b * slopes[i];
    }
  }

  let path = `M${f(coords[0].x)} ${f(coords[0].y)}`;
  for (let i = 0; i < n - 1; i++) {
    const p = coords[i];
    const q = coords[i + 1];
    const third = (q.x - p.x) / 3;
    path += ` C${f(p.x + third)} ${f(p.y + tangents[i] * third)} ${f(q.x - third)} ${f(q.y - tangents[i + 1] * third)} ${f(q.x)} ${f(q.y)}`;
  }
  return path;
}

// Coords are in time order, so the nearest point to the pointer is a binary
// search away rather than a scan of a decade of months.
function findNearestIndex(coords, x) {
  let lo = 0;
  let hi = coords.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (coords[mid].x < x) lo = mid;
    else hi = mid;
  }
  return x - coords[lo].x <= coords[hi].x - x ? lo : hi;
}

// "2026-09-14" and -1 gives "2025-09-14". Lexical compare only, so a Feb 29
// that lands on a non-leap year is harmless.
function shiftYmdByYears(ymd, years) {
  if (!ymd) return null;
  return `${Number(ymd.slice(0, 4)) + years}${ymd.slice(4)}`;
}

function isRecordRecent(dateStr, todayYmd) {
  const days = daysBetweenYmd(dateStr, todayYmd);
  return days !== null && days >= 0 && days <= RECENT_RECORD_DAYS;
}

// "5 years ago" beside the date, so nobody has to do the subtraction.
function formatStandingFor(dateStr, todayYmd) {
  const days = daysBetweenYmd(dateStr, todayYmd);
  if (days === null || days < STANDING_SINCE_MIN_DAYS) return null;

  const years = Math.floor(days / 365);
  if (years >= 1) {
    return `${years} year${years > 1 ? "s" : ""} ago`;
  }

  const months = Math.round(days / 30);
  return `${months} months ago`;
}

function daysBetweenYmd(dateStr, todayYmd) {
  if (!dateStr || !todayYmd) return null;
  const from = parseYmdUtc(dateStr);
  const to = parseYmdUtc(todayYmd);
  if (!from || !to) return null;

  const days = Math.round((to.getTime() - from.getTime()) / 86400000);
  return Number.isFinite(days) ? days : null;
}

function getDisplayNote(note) {
  if (typeof note !== "string") return null;
  const trimmed = note.trim();
  if (!trimmed || IMPORT_BOILERPLATE_NOTE.test(trimmed)) return null;
  return trimmed;
}
