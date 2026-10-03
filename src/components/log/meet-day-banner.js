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
import { LiftArtwork } from "@/components/lift-artwork";
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
    liftType,
    set: meetDay.topSets[liftType],
  })).filter(({ set }) => set);
  const total = formatMeetTotal(meetDay.topSets, isMetric);
  const ago = getTimeAgo(sessionDate, todayIso);
  // The attempt whose clip is playing in the dialog, if any.
  const [playing, setPlaying] = useState(null);

  return (
    <motion.section
      aria-label="Meet day"
      className="relative mb-5 overflow-hidden rounded-2xl border px-4 py-4 sm:px-6 sm:py-5"
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
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2"
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
          <MeetMedalGlyph size={26} />
        </motion.span>
        <div className="min-w-0 flex-1">
          <p className="text-lg leading-snug font-semibold sm:text-xl">
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

      {/* Two by two: squat, bench, deadlift, and the total as the fourth. */}
      {attempts.length > 0 && (
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {attempts.map(({ name, liftType, set }, index) => (
            <AttemptTile
              key={name}
              name={name}
              liftType={liftType}
              set={set}
              isMetric={isMetric}
              index={index}
              onPlay={() => setPlaying({ name, set })}
            />
          ))}
          {total && <TotalTile total={total} index={attempts.length} />}
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

// The tiles rise in one after another, squat first, the total last.
function tileMotion(index, prefersReducedMotion) {
  return {
    initial: prefersReducedMotion ? false : { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.35, ease: "easeOut", delay: 0.2 + index * 0.08 },
  };
}

// One attempt: the lift's drawing and name, the weight, the lifter's note
// from that set, and when it was filmed a big button to watch it. Clips that
// play here get the gold play button and open the dialog; clips that live on
// their own site get a gold-ringed button wearing that site's mark.
function AttemptTile({ name, liftType, set, isMetric, index, onPlay }) {
  const prefersReducedMotion = useReducedMotion();
  const { value, unit } = getDisplayWeight(set, isMetric);
  const url = set.URL || set.url || null;
  const source = url ? getVideoSourceMeta(url) : null;
  const canEmbed = !!(url && getVideoEmbedUrl(url));
  const note = set.notes?.trim();
  const label = `Watch the ${name.toLowerCase()} attempt`;

  const bigButtonClass =
    "group/play relative flex h-14 w-14 shrink-0 items-center justify-center self-center rounded-full shadow-md transition-transform hover:scale-105 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none";
  const ping = (
    <span
      aria-hidden="true"
      className="absolute inset-0 rounded-full opacity-40 group-hover/play:animate-ping"
      style={{ background: MEET_GOLD }}
    />
  );

  return (
    <motion.div
      {...tileMotion(index, prefersReducedMotion)}
      className="bg-background/75 flex min-h-[8.5rem] items-stretch gap-4 rounded-xl border p-4"
    >
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-2">
          <LiftArtwork liftType={liftType} size="sm" animate={false} />
          <p className="text-muted-foreground text-sm font-medium">{name}</p>
        </div>
        <p className="mt-1 text-3xl font-bold tracking-tight tabular-nums">
          {value}
          <span className="text-xl font-semibold">{unit}</span>
          {set.reps > 1 ? (
            <span className="text-muted-foreground text-lg font-normal">
              {` × ${set.reps}`}
            </span>
          ) : null}
        </p>
        {note && (
          <p
            className="text-muted-foreground mt-1.5 line-clamp-3 text-sm leading-snug italic"
            title={note}
          >
            “{note}”
          </p>
        )}
      </div>
      {url &&
        (canEmbed ? (
          <button
            type="button"
            onClick={onPlay}
            aria-label={label}
            className={`${bigButtonClass} text-white`}
            style={{ background: MEET_GOLD }}
          >
            {ping}
            <Play className="relative h-6 w-6 translate-x-px fill-current" />
          </button>
        ) : (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${label} on ${source?.name ?? "its site"}`}
            title={source?.name ? `Watch on ${source.name}` : label}
            className={`${bigButtonClass} bg-background border-2`}
            style={{ borderColor: MEET_GOLD }}
          >
            {ping}
            <VideoSourceIcon source={source} className="relative h-7 w-7" />
          </a>
        ))}
    </motion.div>
  );
}

// The fourth square: the meet total, the one number a meet is remembered by.
function TotalTile({ total, index }) {
  const prefersReducedMotion = useReducedMotion();
  return (
    <motion.div
      {...tileMotion(index, prefersReducedMotion)}
      className="relative flex min-h-[8.5rem] flex-col justify-center overflow-hidden rounded-xl border-2 p-4"
      style={{
        borderColor: MEET_GOLD,
        background: `linear-gradient(140deg, color-mix(in srgb, ${MEET_GOLD} 22%, var(--background)) 0%, var(--background) 75%)`,
      }}
    >
      <MeetMedalGlyph
        size={96}
        className="pointer-events-none absolute -right-3 -bottom-4 opacity-15"
      />
      <p className="text-muted-foreground text-sm font-medium">Meet total</p>
      <p
        className="mt-1 text-4xl font-extrabold tracking-tight tabular-nums sm:text-5xl"
        style={{ color: MEET_GOLD }}
      >
        {total}
      </p>
      <p className="text-muted-foreground mt-1 text-sm">
        Squat, bench and deadlift
      </p>
    </motion.div>
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
