import { useMemo, useState } from "react";
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
import {
  getDisplayWeight,
  getReadableDateString,
} from "@/lib/processing-utils";
import {
  getYouTubeThumbnailSrc,
  getYouTubeWatchHref,
} from "@/components/log/utils";

export function LiftSuggestions({ liftType, sessionDate, parsedData, isMetric }) {
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

  return (
    <p className="pb-1 text-xs italic text-muted-foreground/70">
      Last {getReadableDateString(lastSets[0].date)}: {summary}
    </p>
  );
}

export function LiftTechniqueAssist({
  techniqueAssist,
  hasBigFourIcon = false,
}) {
  if (!techniqueAssist?.cues?.length && !techniqueAssist?.videoAssist) return null;

  return (
    <div className={`mx-4 mt-2 space-y-3 ${hasBigFourIcon ? "md:ml-28 lg:ml-32" : ""}`}>
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
  const visibleButtons = buttons.slice(0, 3);

  return (
    <>
      <div className="flex items-stretch divide-x divide-border/40">
        {visibleButtons.map((s, i) => {
          const { Icon, className: iconClassName } = getSuggestionIcon(s, lastRealSet);

          return (
          <button
            key={i}
            type="button"
            disabled={disabled}
            className={`flex flex-1 flex-col items-center justify-center gap-0.5 py-3.5 text-sm transition-colors ${
              disabled ? "cursor-not-allowed opacity-50" : "hover:bg-accent/50"
            } ${
              s.variant === "primary"
                ? "bg-accent/20 font-semibold text-foreground"
                : s.variant === "secondary"
                  ? "font-medium text-foreground"
                  : "text-muted-foreground"
            }`}
            onClick={() => onAddSet({ reps: s.reps, weight: s.weight, unitType: s.unitType })}
          >
            <span className="flex items-center gap-1.5">
              <Icon className={`h-3.5 w-3.5 ${iconClassName}`} />
              {s.label}
            </span>
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground/70">
              {s.sublabel}
            </span>
            {s.rankingMessage && (
              <span className={`text-[10px] uppercase tracking-wide ${s.rankingScope === "lifetime" ? "text-amber-500" : "text-blue-500"}`}>
                {s.rankingMessage}
              </span>
            )}
          </button>
          );
        })}
        <button
          type="button"
          disabled={disabled}
          className={`flex flex-1 flex-col items-center justify-center gap-0.5 py-3.5 text-sm transition-colors ${
            disabled ? "cursor-not-allowed opacity-50" : "hover:bg-accent/50"
          } text-muted-foreground`}
          onClick={onStartCustomSet}
        >
          <span className="flex items-center gap-1.5">
            <PenLine className="h-3.5 w-3.5 text-muted-foreground" />
            Custom set
          </span>
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground/70">
            any reps or weight
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

  if (isPastSession && inSessionCoachState.mode === "history") {
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
        alignClass={hasBigFourIcon ? "md:pl-28 lg:pl-32" : ""}
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

export function AddLiftButton({
  parsedData,
  onAddLift,
  chips,
  label = "Add another lift type",
  disabled = false,
}) {
  const [showInput, setShowInput] = useState(false);
  const [liftType, setLiftType] = useState("");

  const mergedChips = useMemo(() => {
    const seen = new Set();
    return (chips ?? []).filter(({ name }) => {
      if (seen.has(name)) return false;
      seen.add(name);
      return true;
    });
  }, [chips]);

  function submit(lt) {
    if (disabled) return;
    const raw = (lt ?? liftType).trim();
    if (!raw) return;
    const clean = raw.replace(/\S+/g, (w) => w[0].toUpperCase() + w.slice(1).toLowerCase());
    setShowInput(false);
    setLiftType("");
    onAddLift(clean);
  }

  if (!showInput) {
    return (
      <Button
        variant="outline"
        className="w-full gap-2"
        disabled={disabled}
        onClick={() => setShowInput(true)}
      >
        <ClipboardPlus className="h-4 w-4" />
        {label}
      </Button>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl space-y-3 rounded-lg border p-4">
      <Command className="rounded-lg border bg-background">
        <CommandInput
          placeholder="Lift type (e.g. Back Squat)"
          value={liftType}
          disabled={disabled}
          onValueChange={setLiftType}
        />
        <CommandList className="max-h-56">
          <CommandEmpty>
            {liftType.trim()
              ? `No match. Add "${liftType.trim()}" below.`
              : "No lift found."}
          </CommandEmpty>
          {liftType.trim() ? (
            <CommandGroup heading="Add new">
              <CommandItem
                value={`create-${liftType.trim()}`}
                disabled={disabled}
                onSelect={() => submit(liftType)}
              >
                <ClipboardPlus className="h-4 w-4" />
                {`Add "${liftType.trim()}"`}
              </CommandItem>
            </CommandGroup>
          ) : null}
          <CommandGroup heading="Lifts">
            <div className="grid grid-cols-1 gap-1 md:grid-cols-2">
              {mergedChips.map(({ name }) => (
                <CommandItem
                  key={name}
                  value={name}
                  disabled={disabled}
                  onSelect={() => submit(name)}
                  className="min-w-0"
                >
                  <span className="truncate">{name}</span>
                </CommandItem>
              ))}
            </div>
          </CommandGroup>
        </CommandList>
      </Command>
      <div className="flex gap-2">
        <Button size="sm" onClick={() => submit()} disabled={disabled || !liftType.trim()}>
          Add
        </Button>
        <Button size="sm" variant="ghost" onClick={() => { setShowInput(false); setLiftType(""); }}>
          Cancel
        </Button>
      </div>
      {disabled ? (
        <p className="text-xs text-muted-foreground">
          Row positions are updating. Add controls will re-enable once the current save finishes.
        </p>
      ) : null}
    </div>
  );
}
