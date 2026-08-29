/**
 * Coloured site marks for the video link on a set row.
 *
 * The services lifters actually film into get hand-drawn marks, so they render
 * crisply at 20px with no network request and no dependency on anyone else's
 * uptime. Everything else borrows the destination's own favicon, which
 * is the only way to stay in colour across the long tail of places people keep
 * video, and drops back to a neutral glyph when that 404s or the host blocks
 * it.
 */

import { useEffect, useId, useState } from "react";
import { Video } from "lucide-react";

import { cn } from "@/lib/utils";

// Four half-discs, each rotated a quarter turn from the last, which is exactly
// how the Photos pinwheel is built.
function GooglePhotosMark({ className }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path fill="#4285F4" d="M12 2a5 5 0 0 1 0 10z" />
      <path fill="#EA4335" d="M22 12a5 5 0 0 1-10 0z" />
      <path fill="#FBBC04" d="M12 22a5 5 0 0 1 0-10z" />
      <path fill="#34A853" d="M2 12a5 5 0 0 1 10 0z" />
    </svg>
  );
}

function YouTubeMark({ className }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        fill="#FF0000"
        d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814z"
      />
      <path fill="#FFFFFF" d="M9.545 15.568V8.432L15.818 12z" />
    </svg>
  );
}

// The Drive triangle: yellow left face, green right face, blue base.
function GoogleDriveMark({ className }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path fill="#FFBA00" d="M9.4 3.2 2.1 16h5.2L12 7.6z" />
      <path fill="#00AC47" d="M9.4 3.2h5.2L21.9 16h-5.2z" />
      <path fill="#0066DA" d="M2.1 16l2.6 4.6h14.6L21.9 16z" />
    </svg>
  );
}

// Four rhombi and the lower fold, which is the whole Dropbox glyph.
function DropboxMark({ className }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        fill="#0061FF"
        d="M6.4 3.1 1 6.6l5.4 3.5L11.8 6.6zM17.2 3.1 11.8 6.6l5.4 3.5L22.6 6.6zM1 13.6l5.4 3.5 5.4-3.5-5.4-3.5zM17.2 10.1l-5.4 3.5 5.4 3.5 5.4-3.5zM6.4 18.3l5.4 3.5 5.4-3.5-5.4-3.4z"
      />
    </svg>
  );
}

// The gradient is unique per instance so several filmed sets on one page do
// not fight over the same defs id.
function InstagramMark({ className }) {
  // useId() emits colons, which are awkward inside a url(#...) reference.
  const gradientId = `ig-${useId().replace(/:/g, "")}`;
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <defs>
        <radialGradient id={gradientId} cx="0.3" cy="1.05" r="1.15">
          <stop offset="0" stopColor="#FFD776" />
          <stop offset="0.25" stopColor="#F3A345" />
          <stop offset="0.5" stopColor="#E8483F" />
          <stop offset="0.72" stopColor="#C82BA0" />
          <stop offset="1" stopColor="#5C5FE0" />
        </radialGradient>
      </defs>
      <rect
        x="2.2"
        y="2.2"
        width="19.6"
        height="19.6"
        rx="5.6"
        fill={`url(#${gradientId})`}
      />
      <rect
        x="5.1"
        y="5.1"
        width="13.8"
        height="13.8"
        rx="4.1"
        fill="none"
        stroke="#fff"
        strokeWidth="1.7"
      />
      <circle
        cx="12"
        cy="12"
        r="3.6"
        fill="none"
        stroke="#fff"
        strokeWidth="1.7"
      />
      <circle cx="16.7" cy="7.4" r="1.15" fill="#fff" />
    </svg>
  );
}

function FaviconMark({ host, className }) {
  const [failed, setFailed] = useState(false);

  // A row can be re-pointed at another site without remounting, so a previous
  // failure must not poison the new host's icon.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- error state is keyed to the host prop, which is external
    setFailed(false);
  }, [host]);

  if (failed) return <NeutralMark className={className} />;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`https://${host}/favicon.ico`}
      alt=""
      aria-hidden="true"
      loading="lazy"
      // The destination only ever sees a plain request for a public asset.
      referrerPolicy="no-referrer"
      className={cn("object-contain", className)}
      onError={() => setFailed(true)}
    />
  );
}

function NeutralMark({ className }) {
  return <Video className={cn("text-muted-foreground", className)} />;
}

/**
 * Render the mark for a video destination.
 * @param {Object} props
 * @param {{kind: string, host: string}} props.source - Result of getVideoSourceMeta().
 * @param {string} [props.className] - Sizing classes; the mark fills them.
 */
export function VideoSourceIcon({ source, className }) {
  if (!source) return <NeutralMark className={className} />;
  if (source.kind === "google-photos")
    return <GooglePhotosMark className={className} />;
  if (source.kind === "youtube") return <YouTubeMark className={className} />;
  if (source.kind === "google-drive")
    return <GoogleDriveMark className={className} />;
  if (source.kind === "instagram")
    return <InstagramMark className={className} />;
  if (source.kind === "dropbox") return <DropboxMark className={className} />;
  if (source.host)
    return <FaviconMark host={source.host} className={className} />;
  return <NeutralMark className={className} />;
}
