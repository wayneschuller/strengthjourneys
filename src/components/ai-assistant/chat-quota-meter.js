/**
 * Compact quota controls for the AI lifting assistant prompt area.
 *
 * Keep quota feedback close to the composer so it reads as chat status rather
 * than page-level marketing or transcript content.
 */

import { AlertTriangleIcon } from "lucide-react";

import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { GoogleSignInButton } from "@/components/onboarding/google-sign-in";
import { cn } from "@/lib/utils";

const PERCENT_MAX = 100;
const ICON_RADIUS = 10;
const ICON_VIEWBOX = 24;
const ICON_CENTER = 12;
const ICON_STROKE_WIDTH = 2;

function getDailyResetText(date = new Date()) {
  const nextUtcMidnight = new Date(date);
  nextUtcMidnight.setUTCHours(24, 0, 0, 0);

  const resetAt = nextUtcMidnight.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
  const hoursUntilReset = Math.max(
    1,
    Math.ceil((nextUtcMidnight.getTime() - date.getTime()) / (60 * 60 * 1000)),
  );

  return `Resets in about ${hoursUntilReset} ${hoursUntilReset === 1 ? "hour" : "hours"} (${resetAt} your time).`;
}

function getQuotaTone(quota) {
  if (quota?.blocked) return "blocked";
  if (quota?.warn) return "warn";
  return "normal";
}

function getQuotaPercentUsed(quota) {
  if (!quota?.limit) return 0;
  return Math.min(PERCENT_MAX, Math.max(0, (quota.used / quota.limit) * 100));
}

function getQuotaCopy(quota) {
  const isAnonymous = quota?.tier === "anonymous";
  const resetText = getDailyResetText();

  if (quota?.blocked && isAnonymous) {
    return {
      title: "AI quota exhausted",
      detail: resetText,
      footer:
        "Sign in for a higher daily quota and optional lifting data sharing.",
    };
  }

  if (quota?.blocked) {
    return {
      title: "AI quota exhausted",
      detail: resetText,
      footer: "Daily quotas keep the assistant available for everyone.",
    };
  }

  if (isAnonymous) {
    return {
      title: `${quota.remaining} ${quota.remaining === 1 ? "message" : "messages"} left`,
      detail: "Signed-in users get a higher daily quota.",
      footer: resetText,
    };
  }

  return {
    title: `${quota.remaining} ${quota.remaining === 1 ? "message" : "messages"} left today`,
    detail: `${quota.used} of ${quota.limit} assistant messages used.`,
    footer: resetText,
  };
}

function QuotaRing({ quota }) {
  const usedPercent = getQuotaPercentUsed(quota) / PERCENT_MAX;
  const circumference = 2 * Math.PI * ICON_RADIUS;
  const dashOffset = circumference * (1 - usedPercent);

  return (
    <svg
      aria-hidden="true"
      className="size-5"
      style={{ color: "currentcolor" }}
      viewBox={`0 0 ${ICON_VIEWBOX} ${ICON_VIEWBOX}`}
    >
      <circle
        cx={ICON_CENTER}
        cy={ICON_CENTER}
        fill="none"
        opacity="0.25"
        r={ICON_RADIUS}
        stroke="currentColor"
        strokeWidth={ICON_STROKE_WIDTH}
      />
      <circle
        cx={ICON_CENTER}
        cy={ICON_CENTER}
        fill="none"
        opacity="0.8"
        r={ICON_RADIUS}
        stroke="currentColor"
        strokeDasharray={`${circumference} ${circumference}`}
        strokeDashoffset={dashOffset}
        strokeLinecap="round"
        strokeWidth={ICON_STROKE_WIDTH}
        style={{ transform: "rotate(-90deg)", transformOrigin: "center" }}
      />
    </svg>
  );
}

/**
 * Small prompt-footer usage meter. Always shown once quota has loaded; warning
 * colors only appear when the allowance is nearly exhausted or blocked.
 */
export function ChatQuotaMeter({ quota }) {
  if (!quota) {
    return null;
  }

  const tone = getQuotaTone(quota);
  const copy = getQuotaCopy(quota);
  const usedPercent = getQuotaPercentUsed(quota);
  const displayPercent = Math.round(usedPercent);

  return (
    <HoverCard closeDelay={0} openDelay={0}>
      <HoverCardTrigger asChild>
        <Button
          aria-label={`AI chat quota: ${copy.title}`}
          className={cn(
            "h-8 gap-1.5 rounded-full px-2 text-xs",
            tone === "normal" && "text-muted-foreground",
            tone === "warn" &&
              "text-amber-700 hover:bg-amber-100 dark:text-amber-300 dark:hover:bg-amber-950",
            tone === "blocked" &&
              "text-destructive hover:bg-destructive/10",
          )}
          type="button"
          variant="ghost"
        >
          <span className="font-medium">{displayPercent}%</span>
          <QuotaRing quota={quota} />
        </Button>
      </HoverCardTrigger>
      <HoverCardContent align="end" className="w-72 p-0">
        <div className="space-y-2 p-3">
          <div className="flex items-center justify-between gap-3 text-xs">
            <p className="font-medium">{copy.title}</p>
            <p className="font-mono text-muted-foreground">
              {quota.used} / {quota.limit}
            </p>
          </div>
          <Progress className="h-2 bg-muted" value={usedPercent} />
          <p className="text-xs text-muted-foreground">{copy.detail}</p>
        </div>
        <div className="border-t px-3 py-2 text-xs text-muted-foreground">
          {copy.footer}
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}

/**
 * Compact blocked-state rail above the composer. This is intentionally not a
 * page banner; it only appears when the input can no longer accept messages.
 */
export function ChatQuotaLimitNotice({ quota }) {
  if (!quota?.blocked) {
    return null;
  }

  const isAnonymous = quota.tier === "anonymous";
  const copy = getQuotaCopy(quota);

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-md border px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between",
        isAnonymous
          ? "border-amber-200 bg-amber-50/70 text-amber-950 dark:border-amber-800/70 dark:bg-amber-950/30 dark:text-amber-100"
          : "border-destructive/30 bg-destructive/5 text-foreground",
      )}
    >
      <div className="flex min-w-0 items-start gap-2">
        <AlertTriangleIcon className="mt-0.5 size-4 shrink-0" />
        <div className="min-w-0">
          <p className="font-medium leading-snug">{copy.title}</p>
          <p className="text-xs leading-snug opacity-80">{copy.detail}</p>
        </div>
      </div>
      {isAnonymous ? (
        <GoogleSignInButton
          className="h-8 shrink-0"
          cta="ai_assistant"
          size="sm"
        >
          Sign in
        </GoogleSignInButton>
      ) : null}
    </div>
  );
}
