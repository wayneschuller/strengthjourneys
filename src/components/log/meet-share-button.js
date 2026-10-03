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
 * The card wears the lifter's theme: its card and text colours, its fonts and
 * its corner radius come from the theme tokens, so a shared meet looks like
 * their app. Only the gold is literal (and opacity modifiers are avoided),
 * because the canvas renderer cannot resolve every CSS colour function.
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

// The meet gold as literals for the capture. GOLD matches MEET_GOLD's
// fallback; the wash is the same gold at low alpha.
const GOLD = "#f59e0b";
const GOLD_WASH = "rgba(245, 158, 11, 0.16)";

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
// Laid out like the log's meet card: the name and date, then squat, bench,
// deadlift and the total in a two by two grid.
function MeetShareCard({ ref, meetDay, sessionDate, isMetric }) {
  const attempts = MEET_LIFTS.map(({ liftType, name }) => ({
    name,
    set: meetDay.topSets[liftType],
  })).filter(({ set }) => set);
  const total = formatMeetTotal(meetDay.topSets, isMetric);

  return (
    <div
      ref={ref}
      className="bg-card text-card-foreground relative box-border w-[360px] rounded-2xl border-2 px-5 pt-6 pb-12"
      style={{
        borderColor: GOLD,
        backgroundImage: `linear-gradient(150deg, ${GOLD_WASH} 0%, transparent 55%)`,
      }}
    >
      <div className="flex items-center gap-3">
        <div
          className="bg-background flex h-14 w-14 shrink-0 items-center justify-center rounded-full border-2"
          style={{ borderColor: GOLD }}
        >
          <MeetMedalGlyph size={32} color={GOLD} />
        </div>
        <div className="min-w-0">
          <p className="m-0 text-lg leading-tight font-bold">
            {meetDay.name ?? "Meet day"}
          </p>
          <p className="text-muted-foreground m-0 mt-1 text-sm">
            {formatMeetDate(sessionDate)}
          </p>
        </div>
      </div>

      {attempts.length > 0 && (
        <div className="mt-5 grid grid-cols-2 gap-2.5">
          {attempts.map(({ name, set }) => {
            const { value, unit } = getDisplayWeight(set, isMetric);
            return (
              <div
                key={name}
                className="bg-background border-border rounded-xl border px-3 py-3"
              >
                <p className="text-muted-foreground m-0 text-xs font-medium">
                  {name}
                </p>
                <p className="m-0 mt-1 text-2xl font-bold tabular-nums">
                  {value}
                  <span className="text-base font-semibold">{unit}</span>
                  {set.reps > 1 ? (
                    <span className="text-muted-foreground text-sm font-normal">
                      {` × ${set.reps}`}
                    </span>
                  ) : null}
                </p>
              </div>
            );
          })}
          {total && (
            <div
              className="bg-background rounded-xl border-2 px-3 py-3"
              style={{
                borderColor: GOLD,
                backgroundImage: `linear-gradient(140deg, ${GOLD_WASH} 0%, transparent 80%)`,
              }}
            >
              <p className="text-muted-foreground m-0 text-xs font-medium">
                Meet total
              </p>
              <p
                className="m-0 mt-1 text-2xl font-extrabold tabular-nums"
                style={{ color: GOLD }}
              >
                {total}
              </p>
            </div>
          )}
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
