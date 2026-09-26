/**
 * The "About this AI lifting coach" section at the foot of the model switcher dropdown.
 *
 * It lists what a curious lifter might wonder about the AI setup: the prompt
 * edition, what the latest reply used, the follow-up model, whether their
 * lifting data is shared, and today's quota. Coach details come from
 * /api/chat/quota, which the page already calls on load. The chosen model is
 * not repeated here; the switcher's tick already shows it.
 */
import { findChatModel } from "@/lib/ai/chat-model-catalog";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const REPO_URL = "https://github.com/wayneschuller/strengthjourneys";

/**
 * @param {Object} props
 * @param {{ edition: string|null, suggestionModel: string|null }|null} props.coach From /api/chat/quota.
 * @param {{ edition?: string|null, model?: string }|null} [props.latestReply] Metadata of the latest assistant reply.
 * @param {{ used: number, limit: number }|null} [props.quota]
 * @param {number} [props.sharedContextChars] Length of the lifting summary sent with the latest message.
 * @param {boolean} [props.isSharing] Whether any lifting data is switched on, for before the first message.
 */
export function CoachDetailsSummary({
  coach,
  latestReply,
  quota,
  sharedContextChars = 0,
  isSharing = false,
}) {
  const rows = [
    [
      "Prompt version",
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
        ? `${findChatModel(latestReply.model)?.label ?? latestReply.model}${latestReply.edition ? `, ${formatEditionShort(latestReply.edition)} prompt` : ""}`
        : null,
    ],
    ["Follow-up ideas", coach?.suggestionModel],
    [
      "Your lifting data",
      sharedContextChars > 0
        ? `Summary shared (${sharedContextChars.toLocaleString("en-US")} characters)`
        : isSharing
          ? "Shared with your first message"
          : "Not shared",
    ],
    ["Messages today", quota ? `${quota.used} of ${quota.limit}` : null],
  ].filter(([, value]) => value);

  return (
    <div className="px-2 py-1.5 text-xs">
      <p className="mb-1.5 font-medium">About this AI lifting coach</p>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
        {rows.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="break-words">{value}</dd>
          </div>
        ))}
      </dl>
      <p className="text-muted-foreground mt-2">
        Each prompt version is a revision of our coaching instructions,
        refined over time with your thumbs up and down. Chats stream to your device and are
        not stored on our servers. Strength Journeys is{" "}
        <a
          href={REPO_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-2"
        >
          open source
        </a>
        ; the coaching instructions are our own recipe.
      </p>
    </div>
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
