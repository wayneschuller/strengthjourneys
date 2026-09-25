/**
 * Thumbs feedback and a quiet edition label for one AI assistant reply.
 *
 * The reply's metadata names the prompt edition and model that produced it
 * (set by /api/chat), so a vote is counted against exactly what the lifter saw.
 * After voting, the lifter may choose to share the chat with us; nothing about
 * the conversation leaves the device unless they press that button.
 *
 * It wraps the reply's existing actions (retry, copy) so everything sits on one
 * row, and renders them alone for replies without an edition: older saved chats
 * and replies from a fallback prompt.
 */
import { useState } from "react";
import { useSession } from "next-auth/react";
import { ThumbsUp, ThumbsDown } from "lucide-react";
import { MessageActions, MessageAction } from "@/components/ai-elements/message";
import { Button } from "@/components/ui/button";
import {
  readStoredSentiment,
  writeStoredSentiment,
} from "@/components/feedback/feedback-tracking";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MAX_SHARED_MESSAGES = 20;

/**
 * @param {Object} props
 * @param {Object} props.message The assistant UI message, with metadata { edition, model }.
 * @param {Object[]} props.messages The whole conversation, for sharing.
 * @param {string} [props.userProvidedMetadata] The lifting summary the coach saw.
 * @param {React.ReactNode} props.children The reply's other actions.
 */
export function AiReplyFeedback({ message, messages, userProvidedMetadata, children }) {
  const { status: authStatus } = useSession();
  const { edition, model } = message.metadata || {};
  // Session storage keeps the vote highlighted across a reload of the same chat.
  const storageKey = `sj_ai_reply_vote_${message.id}`;
  const [vote, setVote] = useState(() => toVote(readStoredSentiment(storageKey)));
  const [shareState, setShareState] = useState("idle");

  if (!edition || !model) {
    return <MessageActions>{children}</MessageActions>;
  }

  function handleVote(sentiment) {
    if (sentiment === vote) return;
    const previous = vote;
    setVote(sentiment);
    setShareState("idle");
    writeStoredSentiment(storageKey, sentiment === "up" ? "positive" : "negative");
    // Best effort: a lost vote is not worth interrupting the lifter over.
    postFeedback({ action: "vote", edition, model, sentiment, previous }).catch(() => {});
  }

  async function handleShare() {
    setShareState("sending");
    // Everything up to and including the rated reply, as plain text.
    const upToReply = messages.slice(
      0,
      messages.findIndex((m) => m.id === message.id) + 1,
    );
    try {
      await postFeedback({
        action: "share",
        edition,
        model,
        sentiment: vote,
        messages: upToReply.slice(-MAX_SHARED_MESSAGES).map((m) => ({
          role: m.role,
          text: (m.parts || [])
            .filter((part) => part.type === "text")
            .map((part) => part.text)
            .join(""),
        })),
        userProvidedMetadata,
      });
      setShareState("sent");
    } catch {
      setShareState("failed");
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <MessageActions>
        {children}
        <MessageAction
          onClick={() => handleVote("up")}
          label="Good answer"
          tooltip="Good answer"
          className={vote === "up" ? "text-green-600" : ""}
        >
          <ThumbsUp className="size-3" />
        </MessageAction>
        <MessageAction
          onClick={() => handleVote("down")}
          label="Could be better"
          tooltip="Could be better"
          className={vote === "down" ? "text-foreground" : ""}
        >
          <ThumbsDown className={vote === "down" ? "size-3 fill-current" : "size-3"} />
        </MessageAction>
        <span className="text-muted-foreground/70 ml-1 text-xs" title={`Coach edition ${edition}, ${model}`}>
          {formatEditionLabel(edition)} edition
        </span>
      </MessageActions>
      {vote && shareState !== "sent" && (
        <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs">
          <span>
            Thanks! Want to share this chat with us? It sends the conversation
            and your lifting summary
            {authStatus === "authenticated" ? ", plus your email so we can reply." : "."}
          </span>
          <Button
            variant="outline"
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={handleShare}
            disabled={shareState === "sending"}
          >
            {shareState === "sending" ? "Sending..." : "Share chat"}
          </Button>
          {shareState === "failed" && <span>That didn&apos;t send. Try again?</span>}
        </div>
      )}
      {shareState === "sent" && (
        <p className="text-muted-foreground text-xs">Shared. Thank you for helping the coach improve!</p>
      )}
    </div>
  );
}

async function postFeedback(body) {
  const response = await fetch("/api/chat/feedback", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`Feedback failed: ${response.status}`);
}

function toVote(storedSentiment) {
  if (storedSentiment === "positive") return "up";
  if (storedSentiment === "negative") return "down";
  return null;
}

// "2026-09-26b" reads as "Sep 26b". Parsed by hand so no time zone can shift the day.
function formatEditionLabel(edition) {
  const [, month, dayAndSuffix] = edition.split("-");
  return `${MONTHS[Number(month) - 1]} ${dayAndSuffix.replace(/^0/, "")}`;
}
