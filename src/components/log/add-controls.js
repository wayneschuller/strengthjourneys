/**
 * Add controls for the training log, including last-session context,
 * in-session coaching, smart set suggestions, and custom lift entry.
 */

import { useId, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  ArrowDown,
  ArrowUp,
  ChevronRight,
  ClipboardPlus,
  PenLine,
  PlayCircle,
  Plus,
  Repeat,
} from "lucide-react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { getConsecutiveWorkoutGroups } from "@/components/home-dashboard/session-exercise-block";
import { DRAWN_LIFT_TYPES, LiftArtwork } from "@/components/lift-artwork";
import { getDisplayWeight } from "@/lib/processing-utils";
import { getDaysBetweenYmd, getReadableDateString } from "@/lib/date-utils";
import { useLiftColors } from "@/hooks/use-lift-colors";
import {
  getYouTubeThumbnailSrc,
  getYouTubeWatchHref,
} from "@/components/log/utils";

export function LiftSuggestions({
  liftType,
  sessionDate,
  parsedData,
  isMetric,
  onNavigateToDate,
}) {
  const lastSets = useMemo(() => {
    if (!parsedData) return null;
    const prior = parsedData.filter(
      (e) => e.liftType === liftType && e.date < sessionDate && !e.isGoal,
    );
    if (!prior.length) return null;
    const lastDate = prior[prior.length - 1].date;
    return prior.filter((e) => e.date === lastDate);
  }, [parsedData, liftType, sessionDate]);

  if (!lastSets) return null;

  const summary = getConsecutiveWorkoutGroups(lastSets)
    .map((group) => {
      const firstSet = lastSets[group[0]];
      const { value, unit } = getDisplayWeight(firstSet, isMetric);
      const baseSummary = `${firstSet.reps}@${value}${unit}`;
      return group.length > 1 ? `${group.length}×${baseSummary}` : baseSummary;
    })
    .join("  ·  ");

  const lastDate = lastSets[0].date;
  const dateLabel = getReadableDateString(lastDate);

  return (
    <p className="pb-1 text-xs italic text-muted-foreground">
      Last{" "}
      {onNavigateToDate ? (
        <button
          type="button"
          onClick={() => onNavigateToDate(lastDate)}
          className="font-medium not-italic underline decoration-dotted underline-offset-2 hover:text-foreground"
        >
          {dateLabel}
        </button>
      ) : (
        dateLabel
      )}
      : {summary}
    </p>
  );
}

export function LiftTechniqueAssist({
  techniqueAssist,
  hasBigFourIcon = false,
}) {
  if (!techniqueAssist?.cues?.length && !techniqueAssist?.videoAssist) return null;

  return (
    <div className={`mx-4 mt-2 space-y-3 ${hasBigFourIcon ? "md:ml-34" : ""}`}>
      {techniqueAssist?.cues?.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground/70">
            Form cues
          </p>
          <ul className="space-y-1.5">
            {techniqueAssist.cues.map((cue) => (
              <li key={cue} className="flex items-start gap-2 text-sm text-muted-foreground">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/60" />
                <span>{cue}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {techniqueAssist?.videoAssist && (
        <div className="pt-1">
          <LiftCoachVideoAssist videoAssist={techniqueAssist.videoAssist} />
        </div>
      )}
    </div>
  );
}

function LiftCoachCopy({ inSessionCoaching, alignClass = "" }) {
  if (!inSessionCoaching) return null;

  return (
    <div className={`border-b border-border/40 px-4 py-3 ${alignClass}`}>
      <div className="space-y-1.5">
        {inSessionCoaching.eyebrow && (
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground/70">
            {inSessionCoaching.eyebrow}
          </p>
        )}
        {inSessionCoaching.title && (
          <p className="text-sm font-semibold text-foreground">
            {inSessionCoaching.title}
          </p>
        )}
        {inSessionCoaching.body && (
          <p className="text-sm text-muted-foreground">
            {inSessionCoaching.body}
          </p>
        )}
        {inSessionCoaching.effortCue && (
          <p className="text-xs italic text-muted-foreground/75">
            {inSessionCoaching.effortCue}
          </p>
        )}
      </div>
    </div>
  );
}

function LiftCoachVideoAssist({ videoAssist }) {
  const [isOpen, setIsOpen] = useState(Boolean(videoAssist.defaultOpen));
  const activeVideoUrl = videoAssist?.videoUrl;
  const activeVideoHref = getYouTubeWatchHref(activeVideoUrl) ?? activeVideoUrl;
  const activeThumbnailSrc = getYouTubeThumbnailSrc(activeVideoUrl);

  if (!activeVideoUrl) return null;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="overflow-hidden rounded-xl border border-border/60 bg-background/75">
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex w-full items-center justify-between gap-3 px-3 py-3 text-left transition-colors hover:bg-accent/30"
          >
            <div className="min-w-0">
              <p className="flex items-center gap-2 text-sm font-medium text-foreground">
                <PlayCircle className="h-4 w-4 text-muted-foreground" />
                {videoAssist.prompt}
              </p>
            </div>
            <ChevronRight
              className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${
                isOpen ? "rotate-90" : ""
              }`}
            />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent className="border-t border-border/50 px-3 py-3">
          <a
            href={activeVideoHref}
            target="_blank"
            rel="noreferrer"
            className="group block overflow-hidden rounded-xl border border-border/60 bg-card transition-colors hover:border-primary/40 hover:bg-accent/20"
          >
            <div className="relative aspect-video overflow-hidden bg-muted">
              {activeThumbnailSrc ? (
                <Image
                  src={activeThumbnailSrc}
                  alt={`${videoAssist.prompt} thumbnail`}
                  fill
                  className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                  unoptimized
                />
              ) : null}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-black/5" />
              <div className="absolute inset-x-3 bottom-3 flex items-end justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-base font-semibold text-white">
                    Watch the quick form check
                  </p>
                </div>
                <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-white/92 px-3 py-1.5 text-xs font-semibold text-slate-900 shadow-sm">
                  <PlayCircle className="h-3.5 w-3.5" />
                  Play
                </span>
              </div>
            </div>
          </a>
          {videoAssist.slug ? (
            <div className="mt-3">
              <Link
                href={`/${videoAssist.slug}`}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
              >
                Open the full lift guide
                <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          ) : null}
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

function getSuggestionIcon(button, lastRealSet) {
  if (!lastRealSet?.weight || button.weight == null) {
    return {
      Icon: Plus,
      className: "text-muted-foreground",
    };
  }

  if (button.weight === lastRealSet.weight) {
    return {
      Icon: Repeat,
      className: "text-muted-foreground",
    };
  }

  if (button.weight > lastRealSet.weight) {
    return {
      Icon: ArrowUp,
      className: "text-emerald-600",
    };
  }

  return {
    Icon: ArrowDown,
    className: "text-sky-600",
  };
}

function SmartAddButtonGrid({
  buttons,
  lastRealSet,
  onAddSet,
  onStartCustomSet,
  showHint,
  disabled = false,
}) {
  const visibleButtons = buttons.slice(0, 4);
  const suggestionButtonClass =
    "grid min-h-[6.25rem] min-w-0 grid-rows-[1.75rem_1.1rem_1.4rem] place-items-center gap-1 px-2 py-3 text-center text-sm transition-colors";
  const desktopGridClass =
    visibleButtons.length >= 4 ? "sm:grid-cols-5" : "sm:grid-cols-4";
  const buttonBorderClass = (index, count) => {
    const mobileLastRowStart = count % 2 === 0 ? count - 2 : count - 1;

    return [
      "border-border/40",
      index % 2 === 0 && index < count - 1 ? "border-r" : "",
      index < mobileLastRowStart ? "border-b" : "",
      "sm:border-b-0",
      index < count - 1 ? "sm:border-r" : "sm:border-r-0",
    ]
      .filter(Boolean)
      .join(" ");
  };
  const buttonRadiusClass = (index, count) => {
    const mobileRow = Math.floor(index / 2);
    const mobileLastRow = Math.ceil(count / 2) - 1;
    const isMobileBottomLeft = mobileRow === mobileLastRow && index % 2 === 0;

    return [
      isMobileBottomLeft ? "rounded-bl-xl" : "",
      index === 0 ? "sm:rounded-bl-xl" : "sm:rounded-bl-none",
      index === count - 1 ? "sm:rounded-br-xl" : "sm:rounded-br-none",
    ]
      .filter(Boolean)
      .join(" ");
  };

  return (
    <>
      <div
        className={`grid grid-cols-2 overflow-hidden rounded-b-xl ${desktopGridClass}`}
      >
        {visibleButtons.map((s, i) => {
          const { Icon, className: iconClassName } = getSuggestionIcon(s, lastRealSet);
          const totalButtonCount = visibleButtons.length + 1;

          return (
            <button
              key={i}
              type="button"
              disabled={disabled}
              className={`${suggestionButtonClass} ${buttonBorderClass(i, totalButtonCount)} ${buttonRadiusClass(i, totalButtonCount)} ${
                disabled ? "cursor-not-allowed opacity-50" : "hover:bg-accent/50"
              } ${
                s.variant === "primary"
                  ? "bg-accent/20 text-foreground"
                  : s.variant === "secondary"
                    ? "text-foreground"
                    : "text-muted-foreground"
              }`}
              onClick={() => onAddSet({ reps: s.reps, weight: s.weight, unitType: s.unitType })}
            >
              <span
                className={`flex min-w-0 items-center justify-center gap-1.5 self-end ${
                  s.variant === "primary"
                    ? "font-semibold"
                    : s.variant === "secondary"
                      ? "font-medium"
                      : ""
                }`}
              >
                <Icon className={`h-3.5 w-3.5 ${iconClassName}`} />
                <span className="min-w-0 break-words">{s.label}</span>
              </span>
              <span className="self-start text-[10px] font-normal uppercase tracking-wider text-muted-foreground/70">
                {s.sublabel}
              </span>
              <span
                className={`self-start text-[10px] font-normal uppercase tracking-wide ${
                  s.rankingMessage
                    ? s.rankingScope === "lifetime"
                      ? "text-amber-500"
                      : "text-blue-500"
                    : "invisible"
                }`}
              >
                {s.rankingMessage ?? "No ranking"}
              </span>
            </button>
          );
        })}
        <button
          type="button"
          disabled={disabled}
          className={`${suggestionButtonClass} ${buttonBorderClass(visibleButtons.length, visibleButtons.length + 1)} ${buttonRadiusClass(visibleButtons.length, visibleButtons.length + 1)} ${
            disabled ? "cursor-not-allowed opacity-50" : "hover:bg-accent/50"
          } text-muted-foreground`}
          onClick={onStartCustomSet}
        >
          <span className="flex min-w-0 items-center justify-center gap-1.5 self-end">
            <PenLine className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="min-w-0 break-words">Custom set</span>
          </span>
          <span className="self-start text-[10px] uppercase tracking-wider text-muted-foreground/70">
            any reps or weight
          </span>
          <span className="invisible self-start text-[10px] uppercase tracking-wide">
            No ranking
          </span>
        </button>
      </div>
      {showHint && disabled && (
        <p className="pb-2 pt-1 text-center text-[11px] italic text-muted-foreground/60">
          Row positions are updating. Add controls will re-enable in a moment.
        </p>
      )}
    </>
  );
}

function PastSessionSmartAddButtons({
  liftType,
  buttons,
  lastRealSet,
  onAddSet,
  onStartCustomSet,
  showHint,
  disabled = false,
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const prefersReducedMotion = useReducedMotion();
  const transition = prefersReducedMotion
    ? { duration: 0 }
    : { duration: 0.18, ease: "easeOut" };

  return (
    <div
      className="mt-2 overflow-hidden rounded-b-xl border-t border-border bg-muted/20"
      onMouseEnter={() => setIsExpanded(true)}
      onMouseLeave={() => setIsExpanded(false)}
      onFocusCapture={() => setIsExpanded(true)}
      onBlurCapture={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) {
          setIsExpanded(false);
        }
      }}
    >
      <button
        type="button"
        disabled={disabled}
        className={`flex w-full items-center justify-between px-4 py-2.5 text-left text-xs text-muted-foreground transition-colors ${
          disabled ? "cursor-not-allowed opacity-50" : "hover:bg-accent/30 hover:text-foreground"
        }`}
        onClick={() => setIsExpanded((prev) => !prev)}
        aria-expanded={isExpanded}
      >
        <span className="flex items-center gap-2">
          <Plus className="h-3.5 w-3.5" />
          {`Add another ${liftType} set`}
        </span>
        <span className="flex items-center gap-1 text-[10px] text-muted-foreground/70">
          <motion.span
            animate={{ rotate: isExpanded ? 90 : 0 }}
            transition={transition}
            className="inline-flex"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </motion.span>
        </span>
      </button>
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={transition}
            className="overflow-hidden border-t border-border/40 bg-muted/30"
          >
            <SmartAddButtonGrid
              buttons={buttons}
              lastRealSet={lastRealSet}
              onAddSet={onAddSet}
              onStartCustomSet={onStartCustomSet}
              showHint={showHint}
              disabled={disabled}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function SmartAddButtons({
  inSessionCoachState,
  lastRealSet,
  liftType,
  onAddSet,
  onStartCustomSet,
  showHint,
  hasBigFourIcon = false,
  isPastSession = false,
  collapseSuggestions = false,
  disabled = false,
}) {
  if (!inSessionCoachState?.buttons?.length) {
    return (
      <div className="mt-2 overflow-hidden rounded-b-xl border-t border-border bg-muted/30">
        <button
          type="button"
          disabled={disabled}
          className={`flex w-full items-center justify-center gap-2 py-3.5 text-sm text-muted-foreground transition-colors ${
            disabled ? "cursor-not-allowed opacity-50" : "hover:bg-accent/50 hover:text-foreground"
          }`}
          onClick={() => onAddSet(lastRealSet)}
        >
          <Plus className="h-4 w-4" />
          Add set
        </button>
      </div>
    );
  }

  if (
    collapseSuggestions ||
    (isPastSession && inSessionCoachState.mode === "history")
  ) {
    return (
      <PastSessionSmartAddButtons
        liftType={liftType}
        buttons={inSessionCoachState.buttons}
        lastRealSet={lastRealSet}
        onAddSet={onAddSet}
        onStartCustomSet={onStartCustomSet}
        showHint={showHint}
        disabled={disabled}
      />
    );
  }

  return (
    <div className="mt-2 overflow-hidden rounded-b-xl border-t border-border bg-muted/30">
      <LiftCoachCopy
        inSessionCoaching={inSessionCoachState.inSessionCoaching}
        alignClass={hasBigFourIcon ? "md:pl-34" : ""}
      />
      <SmartAddButtonGrid
        buttons={inSessionCoachState.buttons}
        lastRealSet={lastRealSet}
        onAddSet={onAddSet}
        onStartCustomSet={onStartCustomSet}
        showHint={showHint}
        disabled={disabled}
      />
    </div>
  );
}

/**
 * When a lift was last trained, for its gallery tile. Relative on today's
 * session, where "how long since?" is the question being asked; a plain date
 * when back-filling or browsing another day, where "ago" would mislead.
 */
function getLastLiftedLabel(lastDate, sessionDate, isToday) {
  if (!lastDate || !sessionDate) return null;
  if (!isToday) return `Last ${getReadableDateString(lastDate)}`;

  const days = getDaysBetweenYmd(lastDate, sessionDate);
  if (days <= 1) return "Yesterday";
  if (days < 14) return `${days} days ago`;
  if (days < 60) return `${Math.round(days / 7)} weeks ago`;
  if (days < 365) return `${Math.round(days / 30)} months ago`;
  const years = Math.floor(days / 365);
  return years === 1 ? "A year ago" : `${years} years ago`;
}

/**
 * A visible gallery of every illustrated lift, followed by a search tile for
 * other lift types. Both empty and active sessions use this same catalogue.
 * Tiles lead with what has been trained lately and say when each was last
 * done. `readOnly` shows the same gallery to preview visitors with nothing to
 * tap, headed by `readOnlyCta` so the reason is plain.
 */
export function AddLiftButton({
  onAddLift,
  chips,
  excludeLiftTypes,
  sessionDate,
  isToday = false,
  label,
  disabled = false,
  readOnly = false,
  readOnlyCta = null,
}) {
  const [showInput, setShowInput] = useState(false);
  const [liftType, setLiftType] = useState("");
  const searchId = useId();
  const otherButtonRef = useRef(null);
  const { getColor } = useLiftColors();
  const { drawnLifts, searchLifts } = useMemo(() => {
    const excluded = new Set(excludeLiftTypes ?? []);
    const chipsByName = new Map((chips ?? []).map((chip) => [chip.name, chip]));
    const recentSets = (name) => chipsByName.get(name)?.recentSets ?? 0;
    const frequency = (name) => chipsByName.get(name)?.frequency ?? 0;
    return {
      // Recent training leads, lifetime volume breaks ties, and stable ties
      // keep catalogue order for lifts with no logged history.
      drawnLifts: DRAWN_LIFT_TYPES.filter((name) => !excluded.has(name))
        .sort(
          (a, b) =>
            recentSets(b) - recentSets(a) || frequency(b) - frequency(a),
        )
        .map((name) => ({
          name,
          color: getColor(name),
          lastLiftedLabel: getLastLiftedLabel(
            chipsByName.get(name)?.lastDate,
            sessionDate,
            isToday,
          ),
        })),
      // The search covers what the tiles don't, so a drawn lift never shows
      // up twice.
      searchLifts: [...new Set((chips ?? []).map(({ name }) => name))].filter(
        (name) => !excluded.has(name) && !DRAWN_LIFT_TYPES.includes(name),
      ),
    };
  }, [chips, excludeLiftTypes, sessionDate, isToday, getColor]);
  // Keep a row's drawings level when only some tiles have a date under them,
  // without reserving the line for a lifter who has no history yet.
  const hasAnyLastLifted = drawnLifts.some((lift) => lift.lastLiftedLabel);

  function close() {
    setShowInput(false);
    setLiftType("");
    otherButtonRef.current?.focus();
  }

  function submit(name) {
    if (disabled) return;
    const raw = (name ?? liftType).trim();
    if (!raw) return;
    // Preserve existing spelling (including acronyms) when matching a lift.
    const known = (chips ?? []).find(
      (chip) => chip.name.toLowerCase() === raw.toLowerCase(),
    );
    const clean =
      known?.name ??
      raw.replace(
        /\S+/g,
        (word) => word[0].toUpperCase() + word.slice(1).toLowerCase(),
      );
    close();
    onAddLift(clean);
  }

  const typed = liftType.trim();
  const hasExactMatch = (chips ?? []).some(
    ({ name }) => name.toLowerCase() === typed.toLowerCase(),
  );
  const tileClass =
    "group relative flex min-w-0 flex-col items-center justify-center gap-2 overflow-hidden rounded-xl border border-border/60 bg-card/80 px-2 py-3 text-center shadow-sm transition-colors";
  const interactiveTileClass =
    "hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50";
  // The strip along the top is the lift block's own colour bar, so a tile
  // already looks like the card it becomes. Hover tints the border to match.
  const liftTileClass = `${tileClass} ${
    readOnly
      ? ""
      : `${interactiveTileClass} hover:border-[color:color-mix(in_srgb,var(--lift-color)_55%,transparent)]`
  }`;
  const TileElement = readOnly ? "div" : "button";

  return (
    <section aria-labelledby={`${searchId}-heading`} className="w-full space-y-3">
      <h2 id={`${searchId}-heading`} className="text-base font-semibold">
        {label ?? (readOnly ? "Lifts you can log" : "Log another lift type")}
      </h2>
      {readOnly && readOnlyCta}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
        {drawnLifts.map(({ name, color, lastLiftedLabel }) => (
          <TileElement
            key={name}
            {...(readOnly
              ? {}
              : {
                  type: "button",
                  "aria-label": lastLiftedLabel
                    ? `Add ${name}. ${lastLiftedLabel}`
                    : `Add ${name}`,
                  disabled,
                  onClick: () => submit(name),
                })}
            className={liftTileClass}
            style={{ "--lift-color": color }}
          >
            <span
              aria-hidden="true"
              className="absolute inset-x-0 top-0 h-1"
              style={{ backgroundColor: color }}
            />
            <span
              aria-hidden="true"
              className="flex h-12 w-full items-center justify-center sm:h-14"
            >
              <LiftArtwork
                liftType={name}
                size="md"
                animate={false}
                className="h-full max-h-full w-auto md:h-full"
              />
            </span>
            <span className="flex flex-col items-center">
              <span className="flex min-h-10 items-center text-sm leading-snug font-medium">
                {name}
              </span>
              {hasAnyLastLifted && (
                <span
                  className={`text-muted-foreground text-xs ${
                    lastLiftedLabel ? "" : "invisible"
                  }`}
                >
                  {lastLiftedLabel ?? "\u00a0"}
                </span>
              )}
            </span>
          </TileElement>
        ))}
        {!readOnly && (
          <button
            ref={otherButtonRef}
            type="button"
            disabled={disabled}
            aria-expanded={showInput}
            aria-controls={searchId}
            onClick={() => (showInput ? close() : setShowInput(true))}
            className={`${tileClass} ${interactiveTileClass} hover:border-primary/40 bg-muted/20 border-dashed`}
          >
            <span
              aria-hidden="true"
              className="flex h-12 items-center justify-center sm:h-14"
            >
              <span className="bg-primary/10 text-primary group-hover:bg-primary/15 flex size-8 items-center justify-center rounded-full transition-colors">
                <Plus className="size-4" strokeWidth={1.5} />
              </span>
            </span>
            <span className="flex min-h-10 items-center text-sm leading-snug font-medium">
              Add other lift types
            </span>
          </button>
        )}
      </div>
      {showInput && (
        <div
          id={searchId}
          className="bg-card space-y-3 rounded-2xl border p-3 shadow-sm"
        >
          <Command
            className="bg-background rounded-xl border"
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.stopPropagation();
                close();
              }
            }}
          >
            <CommandInput
              autoFocus
              aria-label="Search or name a lift"
              placeholder="Search, or type a new lift"
              value={liftType}
              disabled={disabled}
              onValueChange={setLiftType}
            />
            <CommandList className="max-h-64">
              <CommandEmpty>No other lifts found.</CommandEmpty>
              <CommandGroup heading="Lift types">
                {searchLifts.map((name) => (
                  <CommandItem
                    key={name}
                    value={name}
                    disabled={disabled}
                    onSelect={() => submit(name)}
                  >
                    {name}
                  </CommandItem>
                ))}
              </CommandGroup>
              {typed && !hasExactMatch && (
                <CommandGroup heading="New lift type">
                  <CommandItem
                    value={`create-${typed}`}
                    disabled={disabled}
                    onSelect={() => submit()}
                  >
                    <ClipboardPlus className="size-4" />
                    {`Add "${typed}"`}
                  </CommandItem>
                </CommandGroup>
              )}
            </CommandList>
          </Command>
          <Button size="sm" variant="ghost" onClick={close}>
            Cancel
          </Button>
        </div>
      )}
      {disabled && (
        <p className="text-muted-foreground text-xs">
          Add controls will re-enable once the current update finishes.
        </p>
      )}
    </section>
  );
}
