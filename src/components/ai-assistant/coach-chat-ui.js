/**
 * Visual chrome for the AI Lifting Assistant chat.
 * Barbell-native empty states, context status, and plate accents —
 * keeps presentation out of the streaming/chat logic in the page file.
 */
import { format, parseISO, isValid } from "date-fns";
import {
  Dumbbell,
  ShieldCheck,
  Sparkles,
  UserRound,
  BarChart3,
  CalendarDays,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useLiftColors } from "@/hooks/use-lift-colors";

const BIG_FOUR = [
  "Back Squat",
  "Bench Press",
  "Deadlift",
  "Press",
];

/**
 * Compact colored stripe using the lifter's big-four palette.
 * Reads as a loaded bar across the top of the coach workspace.
 */
export function LoadedBarStripe({ className }) {
  const { getColor } = useLiftColors();

  return (
    <div
      className={cn("flex h-1 w-full overflow-hidden", className)}
      aria-hidden
    >
      {BIG_FOUR.map((lift) => (
        <div
          key={lift}
          className="h-full flex-1"
          style={{ backgroundColor: getColor(lift) }}
        />
      ))}
    </div>
  );
}

/**
 * Stylized plate stack — pure geometry, no stock photos.
 */
export function PlateStackMark({ className }) {
  const plates = [
    { h: 10, w: 7, opacity: 0.35 },
    { h: 14, w: 9, opacity: 0.5 },
    { h: 18, w: 11, opacity: 0.7 },
    { h: 22, w: 13, opacity: 0.9 },
    { h: 18, w: 11, opacity: 0.7 },
    { h: 14, w: 9, opacity: 0.5 },
    { h: 10, w: 7, opacity: 0.35 },
  ];

  return (
    <div
      className={cn(
        "relative flex items-end justify-center gap-0.5",
        className,
      )}
      aria-hidden
    >
      {/* Sleeve / bar through the stack */}
      <div className="bg-foreground/30 absolute top-1/2 left-1/2 h-0.5 w-[115%] -translate-x-1/2 -translate-y-1/2 rounded-full" />
      {plates.map((plate, i) => (
        <div
          key={i}
          className="bg-foreground relative rounded-sm shadow-sm"
          style={{
            height: `${plate.h * 0.2}rem`,
            width: `${plate.w * 0.15}rem`,
            opacity: plate.opacity,
          }}
        />
      ))}
    </div>
  );
}

function formatSessionLabel(dateStr) {
  if (!dateStr) return null;
  try {
    const d = parseISO(dateStr);
    if (!isValid(d)) return dateStr;
    return format(d, "d MMM");
  } catch {
    return dateStr;
  }
}

/**
 * Live "what the coach can see" strip. Trust + purpose in one glance.
 */
export function CoachContextStrip({
  hasSharedBioData,
  hasSharedTrainingData,
  hasSharedFullTrainingData,
  suggestionContext,
  className,
}) {
  const { getColor } = useLiftColors();
  const primaryLift = suggestionContext?.primaryLift;
  const sessionLabel = formatSessionLabel(suggestionContext?.recentSessionDate);
  const age = suggestionContext?.age;

  const chips = [];

  if (hasSharedTrainingData && primaryLift) {
    chips.push({
      key: "lift",
      icon: Dumbbell,
      label: primaryLift,
      color: getColor(primaryLift),
      tone: "lift",
    });
  }

  if (hasSharedTrainingData && sessionLabel) {
    chips.push({
      key: "session",
      icon: CalendarDays,
      label: `Last session ${sessionLabel}`,
      tone: "default",
    });
  }

  if (hasSharedBioData && age) {
    chips.push({
      key: "bio",
      icon: UserRound,
      label: `Age ${age}`,
      tone: "default",
    });
  } else if (hasSharedBioData) {
    chips.push({
      key: "bio",
      icon: UserRound,
      label: "Bio shared",
      tone: "default",
    });
  }

  if (hasSharedFullTrainingData) {
    chips.push({
      key: "data",
      icon: BarChart3,
      label: "Full log open",
      tone: "strong",
    });
  } else if (hasSharedTrainingData) {
    chips.push({
      key: "data",
      icon: BarChart3,
      label: "Partial log",
      tone: "default",
    });
  }

  const isBlind =
    !hasSharedBioData && !hasSharedTrainingData && chips.length === 0;

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-1.5",
        className,
      )}
    >
      <span className="text-muted-foreground mr-1 flex items-center gap-1 text-[11px] font-medium tracking-wide uppercase">
        <ShieldCheck className="size-3.5 opacity-70" aria-hidden />
        Coach sees
      </span>

      {isBlind ? (
        <Badge
          variant="outline"
          className="text-muted-foreground border-dashed font-normal"
        >
          No personal data yet — still a solid general coach
        </Badge>
      ) : (
        chips.map((chip) => {
          const Icon = chip.icon;
          return (
            <Badge
              key={chip.key}
              variant="secondary"
              className={cn(
                "gap-1 border font-normal",
                chip.tone === "strong" &&
                  "border-foreground/20 bg-foreground text-background",
                chip.tone === "lift" && "bg-background",
              )}
              style={
                chip.tone === "lift" && chip.color
                  ? { borderColor: `${chip.color}66` }
                  : undefined
              }
            >
              {chip.tone === "lift" && chip.color ? (
                <span
                  className="size-2 shrink-0 rounded-[2px]"
                  style={{ backgroundColor: chip.color }}
                  aria-hidden
                />
              ) : (
                <Icon className="size-3 opacity-70" aria-hidden />
              )}
              {chip.label}
            </Badge>
          );
        })
      )}
    </div>
  );
}

/**
 * Empty-state hero for the coach chat — purpose before the first message.
 */
export function CoachEmptyState({
  hasSharedBioData,
  hasSharedTrainingData,
  suggestionContext,
  suggestions,
  isChatUnavailable,
  onSuggestion,
  className,
}) {
  const { getColor } = useLiftColors();
  const primaryLift = suggestionContext?.primaryLift;
  const sessionLabel = formatSessionLabel(suggestionContext?.recentSessionDate);

  let headline = "Step onto the platform.";
  let subline =
    "Ask anything about programming, recovery, or the big lifts. Share your log and this becomes your gym buddy who actually read it.";

  if (hasSharedTrainingData && primaryLift && sessionLabel) {
    headline = `${primaryLift} is on the bar.`;
    subline = `Your log is open through ${sessionLabel}. Ask for a session plan, a volume fix, or a straight read on how you're tracking.`;
  } else if (hasSharedTrainingData && primaryLift) {
    headline = `Let's talk ${primaryLift}.`;
    subline =
      "Your training data is loaded. Pick a prompt or ask what you would ask a good training partner between sets.";
  } else if (hasSharedBioData) {
    headline = "Stronger answers start with context.";
    subline =
      "Bio is shared. Connect or share lifting data below and the coaching gets specific — frequencies, tonnage, recent sessions.";
  } else if (hasSharedTrainingData) {
    headline = "Your log is in the rack.";
    subline =
      "Training data is shared. Ask for a review of the last month, a frequency check, or what to do next session.";
  }

  return (
    <div
      className={cn(
        "flex size-full flex-col items-stretch justify-center gap-6 px-4 py-6 sm:px-6 sm:py-8",
        className,
      )}
    >
      <div className="relative mx-auto flex w-full max-w-xl flex-col items-center text-center">
        {/* Soft platform glow */}
        <div
          className="pointer-events-none absolute -inset-x-8 -top-4 h-32 rounded-full opacity-40 blur-3xl"
          style={{
            background: primaryLift
              ? `radial-gradient(ellipse at center, ${getColor(primaryLift)}33, transparent 70%)`
              : "radial-gradient(ellipse at center, var(--primary) / 0.12, transparent 70%)",
          }}
          aria-hidden
        />

        <div className="relative mb-4 flex flex-col items-center gap-3">
          <div className="bg-muted/60 ring-border/60 flex size-14 items-center justify-center rounded-2xl shadow-sm ring-1">
            <PlateStackMark className="relative scale-90" />
          </div>
          <div className="text-muted-foreground flex items-center gap-1.5 text-[11px] font-medium tracking-[0.14em] uppercase">
            <Sparkles className="size-3" aria-hidden />
            Strength coach · private by default
          </div>
        </div>

        <h3 className="text-foreground max-w-md text-2xl font-bold tracking-tight text-balance sm:text-3xl">
          {headline}
        </h3>
        <p className="text-muted-foreground mt-2 max-w-md text-sm leading-relaxed text-pretty sm:text-base">
          {subline}
        </p>
      </div>

      {suggestions?.length > 0 && (
        <div className="mx-auto w-full max-w-2xl">
          <p className="text-muted-foreground mb-2.5 text-center text-[11px] font-medium tracking-wide uppercase">
            Start here
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {suggestions.map((message) => (
              <button
                key={message}
                type="button"
                disabled={isChatUnavailable}
                onClick={() => onSuggestion?.(message)}
                className={cn(
                  "border-border/80 bg-background/80 hover:border-foreground/40 hover:bg-background",
                  "focus-visible:ring-ring max-w-full rounded-full border px-3.5 py-2 text-left text-sm shadow-sm backdrop-blur-sm transition-all",
                  "hover:shadow-md focus-visible:ring-2 focus-visible:outline-none",
                  "disabled:pointer-events-none disabled:opacity-50",
                  "active:scale-[0.98]",
                )}
              >
                {message}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Label row above follow-up suggestion chips after a coach reply.
 */
export function NextWorkLabel({ className }) {
  return (
    <p
      className={cn(
        "text-muted-foreground mb-2 flex items-center gap-1.5 text-[11px] font-medium tracking-wide uppercase",
        className,
      )}
    >
      <Dumbbell className="size-3 opacity-70" aria-hidden />
      Next work
    </p>
  );
}

/**
 * Context-aware composer placeholder for barbell training.
 */
export function getCoachPlaceholder({
  isChatBlocked,
  isAnonymousQuotaBlocked,
  isChatQuotaReady,
  hasSharedTrainingData,
  primaryLift,
}) {
  if (isChatBlocked) {
    return isAnonymousQuotaBlocked
      ? "Sign in to keep training with the coach..."
      : "Daily coach quota exhausted — back tomorrow.";
  }
  if (!isChatQuotaReady) return "Checking message quota...";
  if (hasSharedTrainingData && primaryLift) {
    return `Ask about your ${primaryLift}, next session, or recovery...`;
  }
  if (hasSharedTrainingData) {
    return "Ask about volume, frequency, or your last session...";
  }
  return "Ask about squats, programming, recovery, or PRs...";
}
