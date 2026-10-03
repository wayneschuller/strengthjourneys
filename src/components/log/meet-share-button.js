/**
 * Share a past powerlifting meet as an image: a gold meet card with the
 * meet's name, date, the squat, bench and deadlift that counted, and the total.
 *
 * Reuses the year recap's capture machinery (lib/recap-share-image.js), so the
 * PNG lands at 1080px wide with the same strengthjourneys.xyz watermark as
 * every other share card. The card is only mounted while a share is running,
 * portalled to <body> off screen, so the log carries no hidden markup and no
 * ancestor's transform or overflow can clip the capture.
 *
 * The card uses literal colours rather than theme variables: a shared image
 * should look the same whichever theme the lifter happened to be using.
 */
import { useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

import { useToast } from "@/hooks/use-toast";
import { useTransientSuccess } from "@/hooks/use-transient-success";
import { gaTrackShareCopy } from "@/lib/analytics/analytics";
import { getDisplayWeight } from "@/lib/processing-utils";
import {
  canNativeShareFiles,
  captureRecapSlideBlob,
  downloadBlob,
} from "@/lib/recap-share-image";
import { MEET_LIFTS, formatMeetTotal } from "@/lib/meet-detection";
import { MeetMedalGlyph } from "@/components/meet-medal";
import { ShareCopyButton } from "@/components/share-copy-button";

// Literal colours for the captured card (see the header comment).
const CARD_COLORS = {
  gold: "#f59e0b",
  goldDeep: "#b45309",
  ink: "#111827",
  muted: "#6b7280",
  border: "#fcd34d",
};

/**
 * @param {Object} props
 * @param {{name: string|null, topSets: Object}} props.meetDay - From meetDays.
 * @param {string} props.sessionDate - YYYY-MM-DD of the meet.
 * @param {boolean} props.isMetric - Display unit for weights and the total.
 * @param {string} [props.className] - Extra classes for the button.
 */
export function MeetShareButton({ meetDay, sessionDate, isMetric, className }) {
  const [isSharing, setIsSharing] = useState(false);
  const cardRef = useRef(null);
  const { isSuccess, triggerSuccess } = useTransientSuccess();
  const { toast } = useToast();

  // Feature-detected on the client only: the server snapshot is false so the
  // server and client markup agree on the first render.
  const canNativeShare = useSyncExternalStore(
    subscribeToNothing,
    canNativeShareFiles,
    () => false,
  );

  const fileName = `strength-journeys-meet-${sessionDate}.png`;

  // The card mounts when isSharing flips on; wait for React to commit it and
  // the browser to lay it out before handing it to html2canvas.
  const captureCard = async () => {
    for (let i = 0; i < 10 && !cardRef.current; i += 1) {
      await nextFrame();
    }
    await nextFrame();
    if (!cardRef.current) throw new Error("Meet card did not mount");
    return captureRecapSlideBlob(cardRef.current);
  };

  const saveImage = async (blob) => {
    downloadBlob(blob, fileName);
    toast({ title: "Meet image saved" });
  };

  const handleShare = async () => {
    const action = canNativeShare ? "native_share" : "copy_image";
    gaTrackShareCopy("meet_day", { page: "/log", action });
    setIsSharing(true);
    let blob = null;
    try {
      blob = await captureCard();
      if (canNativeShare) {
        const file = new File([blob], fileName, { type: "image/png" });
        await navigator.share({
          files: [file],
          title: meetDay.name ?? "Meet day",
        });
      } else {
        await navigator.clipboard.write([
          new ClipboardItem({ "image/png": blob }),
        ]);
        triggerSuccess();
      }
    } catch (error) {
      // The lifter dismissing the share sheet is not a failure.
      if (error?.name === "AbortError") return;
      // Safari can drop the user-gesture permission across the capture, and
      // some browsers refuse image clipboard writes. Saving the file still
      // gets the meet onto their device.
      if (blob) {
        try {
          await saveImage(blob);
          return;
        } catch {
          // fall through to the message below
        }
      }
      console.error("Meet share error:", error);
      toast({
        variant: "destructive",
        title: "Could not share this meet",
        description: "Give it another go in a moment.",
      });
    } finally {
      setIsSharing(false);
    }
  };

  return (
    <>
      <ShareCopyButton
        label="Share"
        successLabel="Copied"
        tooltip={
          canNativeShare ? "Share this meet" : "Copy this meet as an image"
        }
        isLoading={isSharing}
        isSuccess={isSuccess}
        onClick={handleShare}
        className={className}
      />
      {isSharing &&
        createPortal(
          <div
            aria-hidden="true"
            style={{
              position: "fixed",
              left: "-10000px",
              top: 0,
              pointerEvents: "none",
            }}
          >
            <MeetShareCard
              ref={cardRef}
              meetDay={meetDay}
              sessionDate={sessionDate}
              isMetric={isMetric}
            />
          </div>,
          document.body,
        )}
    </>
  );
}

// The card that becomes the image. 360px wide, captured at 3x to 1080px.
function MeetShareCard({ ref, meetDay, sessionDate, isMetric }) {
  const attempts = MEET_LIFTS.map(({ liftType, name }) => ({
    name,
    set: meetDay.topSets[liftType],
  })).filter(({ set }) => set);
  const total = formatMeetTotal(meetDay.topSets, isMetric);

  return (
    <div
      ref={ref}
      style={{
        position: "relative",
        width: "360px",
        boxSizing: "border-box",
        padding: "28px 24px 52px",
        borderRadius: "20px",
        border: `2px solid ${CARD_COLORS.border}`,
        background:
          "linear-gradient(150deg, #fef3c7 0%, #fffbeb 40%, #ffffff 100%)",
        color: CARD_COLORS.ink,
        fontFamily:
          'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "56px",
            height: "56px",
            flexShrink: 0,
            borderRadius: "9999px",
            border: `2px solid ${CARD_COLORS.gold}`,
            background: "#ffffff",
          }}
        >
          <MeetMedalGlyph size={32} />
        </div>
        <div style={{ minWidth: 0 }}>
          <p
            style={{
              margin: 0,
              fontSize: "20px",
              lineHeight: 1.25,
              fontWeight: 700,
            }}
          >
            {meetDay.name ?? "Meet day"}
          </p>
          <p
            style={{
              margin: "4px 0 0",
              fontSize: "14px",
              color: CARD_COLORS.muted,
            }}
          >
            {formatMeetDate(sessionDate)}
          </p>
        </div>
      </div>

      {attempts.length > 0 && (
        <div
          style={{
            marginTop: "24px",
            display: "flex",
            flexDirection: "column",
            gap: "10px",
          }}
        >
          {attempts.map(({ name, set }) => {
            const { value, unit } = getDisplayWeight(set, isMetric);
            return (
              <div
                key={name}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  paddingBottom: "8px",
                  borderBottom: "1px solid #fde68a",
                }}
              >
                <span style={{ fontSize: "15px", color: CARD_COLORS.muted }}>
                  {name}
                </span>
                <span
                  style={{
                    fontSize: "18px",
                    fontWeight: 600,
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {value}
                  {unit}
                  {set.reps > 1 ? (
                    <span style={{ color: CARD_COLORS.muted, fontWeight: 400 }}>
                      {` × ${set.reps}`}
                    </span>
                  ) : null}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {total && (
        <div
          style={{
            marginTop: "18px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
          }}
        >
          <span
            style={{
              fontSize: "15px",
              fontWeight: 600,
              color: CARD_COLORS.goldDeep,
            }}
          >
            Meet total
          </span>
          <span
            style={{
              fontSize: "34px",
              fontWeight: 800,
              color: CARD_COLORS.goldDeep,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {total}
          </span>
        </div>
      )}
    </div>
  );
}

function formatMeetDate(sessionDate) {
  const [y, m, d] = sessionDate.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(undefined, {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

// Share support never changes during a visit, so there is nothing to watch.
function subscribeToNothing() {
  return () => {};
}

function nextFrame() {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}
