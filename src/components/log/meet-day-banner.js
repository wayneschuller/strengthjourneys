/**
 * The log's look back at a past meet: a gold card above the session with the
 * meet's name, how long ago it was, the attempts that counted and the total.
 *
 * Only ever shown for a meet day in the past. On the day itself the log stays
 * exactly as it always is, because a lifter logging between attempts needs
 * the app they know, not a new layout. The caller enforces that by passing
 * the meet only when the session date is before today.
 *
 * A filmed attempt gets a big gold play button. Hosts that allow framing
 * (YouTube, Vimeo, Google Drive) play in a dialog on the page; the rest,
 * Google Photos above all, refuse to be embedded, so the button opens them in
 * a new tab, and their button wears that site's own mark instead.
 */
import { useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Play } from "lucide-react";

import { getDisplayWeight } from "@/lib/processing-utils";
import { getVideoEmbedUrl, getVideoSourceMeta } from "@/lib/video-thumbnails";
import { MEET_LIFTS, formatMeetTotal } from "@/lib/meet-detection";
import { MEET_GOLD, MeetMedalGlyph } from "@/components/meet-medal";
import { MeetShareButton } from "@/components/log/meet-share-button";
import { VideoSourceIcon } from "@/components/log/video-source-icon";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * @param {Object} props
 * @param {{name: string|null, topSets: Object}} props.meetDay - From meetDays.
 * @param {string} props.sessionDate - YYYY-MM-DD, always before today.
 * @param {string} props.todayIso - YYYY-MM-DD.
 * @param {boolean} props.isMetric - Display unit for weights and the total.
 */
export function MeetDayBanner({ meetDay, sessionDate, todayIso, isMetric }) {
  const prefersReducedMotion = useReducedMotion();
  const attempts = MEET_LIFTS.map(({ liftType, name }) => ({
    name,
    set: meetDay.topSets[liftType],
  })).filter(({ set }) => set);
  const total = formatMeetTotal(meetDay.topSets, isMetric);
  const ago = getTimeAgo(sessionDate, todayIso);
  // The attempt whose clip is playing in the dialog, if any.
  const [playing, setPlaying] = useState(null);

  return (
    <motion.section
      aria-label="Meet day"
      className="relative mb-5 overflow-hidden rounded-2xl border px-4 py-3.5 sm:px-5"
      style={{
        borderColor: `color-mix(in srgb, ${MEET_GOLD} 55%, transparent)`,
        background: `linear-gradient(135deg, color-mix(in srgb, ${MEET_GOLD} 14%, var(--card)) 0%, var(--card) 60%)`,
      }}
      initial={prefersReducedMotion ? false : { opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
    >
      <div className="flex items-center gap-3.5">
        <motion.span
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2"
          style={{ borderColor: MEET_GOLD, background: "var(--background)" }}
          initial={prefersReducedMotion ? false : { scale: 0.4, rotate: -30 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{
            type: "spring",
            stiffness: 260,
            damping: 12,
            delay: 0.15,
          }}
        >
          <MeetMedalGlyph size={24} />
        </motion.span>
        <div className="min-w-0 flex-1">
          <p className="text-base leading-snug font-semibold sm:text-lg">
            {meetDay.name ?? "Meet day"}
          </p>
          <p className="text-muted-foreground text-sm">
            {meetDay.name ? `Meet day, ${ago}` : capitalize(ago)}
          </p>
        </div>
        <MeetShareButton
          meetDay={meetDay}
          sessionDate={sessionDate}
          isMetric={isMetric}
          className="shrink-0 self-start"
        />
      </div>

      {attempts.length > 0 && (
        <div className="mt-3.5 flex flex-wrap items-stretch gap-2.5">
          {attempts.map(({ name, set }) => (
            <AttemptTile
              key={name}
              name={name}
              set={set}
              isMetric={isMetric}
              onPlay={() => setPlaying({ name, set })}
            />
          ))}
          {total && (
            <div className="ml-auto flex flex-col justify-center px-1 text-right">
              <p className="text-muted-foreground text-xs">Total</p>
              <p
                className="text-xl font-bold tabular-nums"
                style={{ color: MEET_GOLD }}
              >
                {total}
              </p>
            </div>
          )}
        </div>
      )}

      <Dialog
        open={!!playing}
        onOpenChange={(open) => !open && setPlaying(null)}
      >
        <DialogContent className="overflow-hidden p-0 sm:max-w-3xl">
          <DialogTitle className="sr-only">
            {playing
              ? `${playing.name} at ${meetDay.name ?? "the meet"}`
              : "Meet video"}
          </DialogTitle>
          <DialogDescription className="sr-only">
            The video of this meet attempt.
          </DialogDescription>
          {playing && (
            <div className="aspect-video w-full bg-black">
              <iframe
                src={getVideoEmbedUrl(playing.set.URL || playing.set.url)}
                title={`${playing.name} video`}
                className="h-full w-full"
                allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                allowFullScreen
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </motion.section>
  );
}

// One attempt: the lift and its weight, and when it was filmed, a big gold
// play button. Embeddable clips open the dialog; anything else is a plain
// link to the clip's own site, captioned with that site's mark.
function AttemptTile({ name, set, isMetric, onPlay }) {
  const { value, unit } = getDisplayWeight(set, isMetric);
  const url = set.URL || set.url || null;
  const source = url ? getVideoSourceMeta(url) : null;
  const canEmbed = !!(url && getVideoEmbedUrl(url));
  const note = set.notes?.trim();
  const label = `Watch the ${name.toLowerCase()} attempt`;

  const bigButtonClass =
    "group/play relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full shadow-md transition-transform hover:scale-105 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none";
  const ping = (
    <span
      aria-hidden="true"
      className="absolute inset-0 rounded-full opacity-40 group-hover/play:animate-ping"
      style={{ background: MEET_GOLD }}
    />
  );

  return (
    <div className="bg-background/70 flex max-w-[24rem] min-w-[11rem] flex-1 items-start gap-3 rounded-xl border px-3 py-2">
      <div className="min-w-0 flex-1">
        <p className="text-muted-foreground text-xs">{name}</p>
        <p className="text-lg font-semibold tabular-nums">
          {value}
          {unit}
          {set.reps > 1 ? (
            <span className="text-muted-foreground text-sm font-normal">
              {` × ${set.reps}`}
            </span>
          ) : null}
        </p>
        {note && (
          <p
            className="text-muted-foreground line-clamp-2 text-xs italic"
            title={note}
          >
            “{note}”
          </p>
        )}
      </div>
      {url &&
        (canEmbed ? (
          // Plays here, so the gold play button.
          <button
            type="button"
            onClick={onPlay}
            aria-label={label}
            className={`${bigButtonClass} self-center text-white`}
            style={{ background: MEET_GOLD }}
          >
            {ping}
            <Play className="relative h-5 w-5 translate-x-px fill-current" />
          </button>
        ) : (
          // Plays on its own site, so that site's mark, big, ringed in gold.
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${label} on ${source?.name ?? "its site"}`}
            title={source?.name ? `Watch on ${source.name}` : label}
            className={`${bigButtonClass} bg-background self-center border-2`}
            style={{ borderColor: MEET_GOLD }}
          >
            {ping}
            <VideoSourceIcon source={source} className="relative h-6 w-6" />
          </a>
        ))}
    </div>
  );
}

function getTimeAgo(sessionDate, todayIso) {
  const [sy, sm, sd] = sessionDate.split("-").map(Number);
  const [ty, tm, td] = todayIso.split("-").map(Number);
  const months = (ty - sy) * 12 + (tm - sm) - (td < sd ? 1 : 0);
  if (months >= 12) {
    const years = Math.floor(months / 12);
    return `${years} year${years === 1 ? "" : "s"} ago`;
  }
  if (months >= 1) return `${months} month${months === 1 ? "" : "s"} ago`;
  const days = Math.round(
    (Date.UTC(ty, tm - 1, td) - Date.UTC(sy, sm - 1, sd)) / 86400000,
  );
  if (days <= 1) return "yesterday";
  if (days < 14) return `${days} days ago`;
  return `${Math.floor(days / 7)} weeks ago`;
}

function capitalize(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
