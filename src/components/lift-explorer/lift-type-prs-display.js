/**
 * The rep-range trophy cabinet for one lift: your best set at one rep, two
 * reps, three, and so on down the ladder.
 *
 * Deliberately not a chart. Every chart view of this data already exists above
 * it on the guide page — e1RM over time, singles/triples/fives over time, and
 * achieved-versus-potential by rep range. What none of those show is the set
 * itself: the day, the note you wrote, the clip you filmed, and the way back
 * to that session. Read down the column of weights and the strength curve is
 * there anyway, without drawing it a fourth time.
 *
 * One card per rep range, all on one page, no tabs — a second view of ten
 * records mostly repeats the first. Opening a record grows it to full width in
 * place and lists the rest of that rep range beneath it, so the overview never
 * goes away and there is nothing to navigate back from.
 *
 * Records that were filmed use the clip's own poster frame as the card, which
 * is the whole reason to bother filming a set.
 */

import { useMemo, useRef, useState } from "react";
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

// Below this the date line already tells the story; "standing 6 weeks" is not
// a boast worth making.
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
    topLiftsByTypeAndReps,
    topLiftsByTypeAndRepsLast12Months,
    isDemoMode,
  } = useUserLiftingData();
  const { getColor } = useLiftColors();
  const { age, bodyWeight, sex, standards, isMetric } = useAthleteBio();
  const router = useRouter();
  const prefersReducedMotion = useReducedMotion();
  const containerRef = useRef(null);
  const { width = 0 } = useResizeObserver({ ref: containerRef });

  // Read the clock once on mount so "standing 5 years" stays pure across renders.
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

  if (!topLiftsByTypeAndReps || !topLiftsByReps) return null;

  const hasYearlyData = Boolean(
    topLiftsByTypeAndRepsLast12Months?.[liftType]?.some(
      (repRange) => repRange?.length > 0,
    ),
  );

  if (repRangesWithData.length === 0) {
    return (
      <div className="text-muted-foreground text-center">
        No PRs recorded for {liftType} yet.
      </div>
    );
  }

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

  return (
    <div ref={containerRef} className="space-y-4">
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
        {scope === "yearly" ? " in the last 12 months" : ", all time"}. Open a
        record to see the rest of that rep range.
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
            hideNotes={compact}
          />
        ))}
      </div>
    </div>
  );
};

// One rep range: the record as a card, and — when opened — everything else you
// have done at that rep count underneath it.
function RepRangeCard({
  repRange,
  repCount,
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
  hideNotes,
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
            {!hideNotes && note && (
              <p
                className={cn(
                  "line-clamp-2 text-sm text-pretty italic",
                  hasPoster ? "text-white/80" : "text-muted-foreground",
                )}
              >
                {note}
              </p>
            )}
          </div>

          <div className="flex items-end justify-between gap-2">
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
            <div className="pointer-events-auto">
              <VideoLinkButton
                url={record.URL}
                source={videoSource}
                className={hasPoster ? "bg-white/15 hover:bg-white/25" : ""}
              />
            </div>
          </div>
        </div>
      ) : (
        <div className="relative z-20 space-y-5 p-5">
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

            {olderRecords.length > 0 && (
              <ul className="divide-border/70 divide-y border-t pt-1">
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
          {!poster.src && (
            <VideoLinkButton url={record.URL} source={videoSource} />
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
    <li className="flex items-start gap-3 py-3">
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
      <VideoLinkButton url={lift.URL} source={videoSource} />
    </li>
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

function isRecordRecent(dateStr, todayYmd) {
  const days = daysBetweenYmd(dateStr, todayYmd);
  return days !== null && days >= 0 && days <= RECENT_RECORD_DAYS;
}

// "standing 5 years" turns a date into a challenge, which is the one thing a
// rep-range cross-section can say that none of the charts above it can.
function formatStandingFor(dateStr, todayYmd) {
  const days = daysBetweenYmd(dateStr, todayYmd);
  if (days === null || days < STANDING_SINCE_MIN_DAYS) return null;

  const years = Math.floor(days / 365);
  if (years >= 1) {
    return `standing ${years} year${years > 1 ? "s" : ""}`;
  }

  const months = Math.round(days / 30);
  return `standing ${months} months`;
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
