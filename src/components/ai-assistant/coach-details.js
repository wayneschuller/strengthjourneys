/**
 * The "Powered by" line in the AI assistant header, extended with the coach's
 * prompt edition and a details panel for the curious.
 *
 * The panel lists everything about the AI setup a lifter might wonder about:
 * models, prompt edition, what the latest reply used, whether their lifting
 * data is shared, and today's quota. Coach details come from /api/chat/quota,
 * which the page already calls on load.
 *
 * It is a popover rather than a tooltip so a tap opens it on phones. A mouse
 * opens it on hover too, which is why hover is handled by pointer type: on
 * touch, the tap's synthetic hover would open it and the click would close it.
 */
import { useEffect, useRef, useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const PROVIDER_NAMES = { xai: "xAI", openai: "OpenAI" };
const HOVER_CLOSE_DELAY_MS = 150;
const REPO_URL = "https://github.com/wayneschuller/strengthjourneys";

/**
 * @param {Object} props
 * @param {{ edition: string|null, model: string|null, provider: string|null, suggestionModel: string|null }|null} props.coach
 * @param {{ edition?: string|null, model?: string }|null} [props.latestReply] Metadata of the latest assistant reply.
 * @param {{ used: number, limit: number }|null} [props.quota]
 * @param {number} [props.sharedContextChars] Length of the lifting summary sent with each message.
 * @param {string} [props.className]
 * @param {React.ReactNode} props.children The existing "Powered by" logo and text.
 */
export function CoachDetails({
  coach,
  latestReply,
  quota,
  sharedContextChars = 0,
  className = "",
  children,
}) {
  const [open, setOpen] = useState(false);
  const closeTimerRef = useRef(null);

  useEffect(() => () => clearTimeout(closeTimerRef.current), []);

  // Moving from the trigger into the panel crosses a small gap, so closing
  // waits a moment and either element's hover cancels it.
  const hoverHandlers = {
    onPointerEnter: (event) => {
      if (event.pointerType !== "mouse") return;
      clearTimeout(closeTimerRef.current);
      setOpen(true);
    },
    onPointerLeave: (event) => {
      if (event.pointerType !== "mouse") return;
      closeTimerRef.current = setTimeout(() => setOpen(false), HOVER_CLOSE_DELAY_MS);
    },
  };

  const providerName = PROVIDER_NAMES[coach?.provider] || coach?.provider;
  const rows = [
    ["Coach model", coach?.model ? `${coach.model}${providerName ? ` by ${providerName}` : ""}` : null],
    [
      "Coach edition",
      coach?.edition ? (
        <>
          {formatEditionDate(coach.edition)}{" "}
          <span className="text-muted-foreground font-mono">({coach.edition})</span>
        </>
      ) : null,
    ],
    [
      "Latest reply",
      latestReply?.model
        ? `${latestReply.edition ? `${formatEditionShort(latestReply.edition)} edition, ` : ""}${latestReply.model}`
        : null,
    ],
    ["Follow-up ideas", coach?.suggestionModel],
    [
      "Your lifting data",
      sharedContextChars > 0
        ? `Summary shared (${sharedContextChars.toLocaleString("en-US")} characters)`
        : "Not shared",
    ],
    ["Messages today", quota ? `${quota.used} of ${quota.limit}` : null],
  ].filter(([, value]) => value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="AI coach details"
          className={`text-muted-foreground hover:text-foreground cursor-help items-center gap-1.5 rounded-sm transition-colors ${className}`}
          {...hoverHandlers}
        >
          {children}
          {coach?.edition && (
            <span className="text-xs opacity-80">
              · {formatEditionShort(coach.edition)} edition
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0 text-xs" {...hoverHandlers}>
        <div className="p-3">
          <p className="mb-2 text-sm font-medium">About this AI coach</p>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5">
            {rows.map(([label, value]) => (
              <div key={label} className="contents">
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="break-words">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="text-muted-foreground space-y-1 border-t px-3 py-2">
          <p>
            Each edition is a version of our coaching instructions. We refine
            them over time, and your thumbs up and down show us what works.
          </p>
          <p>
            Chats stream to your device and are not stored on our servers.
            Strength Journeys is{" "}
            <a href={REPO_URL} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
              open source
            </a>
            ; the coaching instructions are our own recipe.
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// Edition IDs are parsed by hand so no time zone can shift the day.
// "2026-09-26b" reads as "Sep 26b".
function formatEditionShort(edition) {
  const [, month, dayAndSuffix] = edition.split("-");
  return `${MONTHS[Number(month) - 1]} ${dayAndSuffix.replace(/^0/, "")}`;
}

// "2026-09-26b" reads as "Sep 26, 2026".
function formatEditionDate(edition) {
  const [year, month, dayAndSuffix] = edition.split("-");
  return `${MONTHS[Number(month) - 1]} ${parseInt(dayAndSuffix, 10)}, ${year}`;
}
