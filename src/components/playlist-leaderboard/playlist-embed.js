import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------------------------------
// Inline players for the gym playlist leaderboard.
//
// Every embed URL is built from a hardcoded player host plus the id/path we pull out of the
// submitted URL, so a user-supplied link can never choose the frame origin. Platforms we can't
// embed simply return null and the card falls back to being a plain outbound link.
// ---------------------------------------------------------------------------------------------------

// Spotify localises some share links as /intl-de/playlist/... — the embed player wants it stripped.
function stripSpotifyLocale(pathname) {
  return pathname.replace(/^\/intl-[a-z-]+/i, "");
}

function youtubeEmbed(url) {
  const list = url.searchParams.get("list");
  if (list) {
    return {
      src: `https://www.youtube-nocookie.com/embed/videoseries?list=${encodeURIComponent(list)}`,
      aspect: "video",
    };
  }

  const watchId =
    url.searchParams.get("v") ||
    (url.hostname.endsWith("youtu.be") ? url.pathname.slice(1) : null) ||
    url.pathname.match(/^\/(?:embed|shorts|live)\/([\w-]+)/)?.[1];

  if (!watchId) return null;

  return {
    src: `https://www.youtube-nocookie.com/embed/${encodeURIComponent(watchId)}`,
    aspect: "video",
  };
}

/**
 * Work out how (or whether) a playlist URL can be played inline.
 * @param {string} url - The stored playlist URL.
 * @returns {{src: string, aspect?: "video", height?: number} | null} Embed descriptor, or null when the platform has no player we can frame.
 */
export function getPlaylistEmbed(url) {
  if (!url) return null;

  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  if (parsed.protocol !== "https:") return null;

  const host = parsed.hostname.toLowerCase().replace(/^www\./, "");

  if (host.endsWith("spotify.com")) {
    const path = stripSpotifyLocale(parsed.pathname);
    if (!/^\/(playlist|album|track|episode|show|artist)\/[A-Za-z0-9]+/.test(path)) {
      return null;
    }
    return { src: `https://open.spotify.com/embed${path}`, height: 352 };
  }

  if (
    host === "youtu.be" ||
    host === "youtube.com" ||
    host.endsWith(".youtube.com")
  ) {
    return youtubeEmbed(parsed);
  }

  if (host.endsWith("soundcloud.com")) {
    return {
      src: `https://w.soundcloud.com/player/?url=${encodeURIComponent(parsed.href)}&visual=true&show_comments=false&hide_related=true`,
      height: 320,
    };
  }

  if (host.endsWith("music.apple.com")) {
    return {
      src: `https://embed.music.apple.com${parsed.pathname}${parsed.search}`,
      height: 450,
    };
  }

  if (host.endsWith("tidal.com")) {
    const match = parsed.pathname.match(
      /\/(playlist|album|track|video)\/([A-Za-z0-9-]+)/,
    );
    if (!match) return null;
    const [, kind, id] = match;
    return {
      src: `https://embed.tidal.com/${kind}s/${encodeURIComponent(id)}?layout=gridify`,
      height: 400,
    };
  }

  if (host.endsWith("deezer.com")) {
    const match = parsed.pathname.match(/\/(playlist|album|track)\/(\d+)/);
    if (!match) return null;
    const [, kind, id] = match;
    return {
      src: `https://widget.deezer.com/widget/auto/${kind}/${id}`,
      height: 300,
    };
  }

  if (host.endsWith("mixcloud.com")) {
    return {
      src: `https://www.mixcloud.com/widget/iframe/?feed=${encodeURIComponent(parsed.href)}&hide_cover=1`,
      height: 120,
    };
  }

  return null;
}

/**
 * The framed player itself. Rendered only while a playlist is expanded so we never pay for
 * ten hidden iframes on first paint.
 * @param {Object} props
 * @param {{src: string, aspect?: string, height?: number}} props.embed - Descriptor from getPlaylistEmbed().
 * @param {string} props.title - Playlist title, used for the iframe accessible name.
 */
export function PlaylistEmbed({ embed, title, className }) {
  if (!embed) return null;

  return (
    <iframe
      src={embed.src}
      title={`${title} player`}
      loading="lazy"
      allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
      referrerPolicy="strict-origin-when-cross-origin"
      className={cn(
        "w-full rounded-lg border-0 bg-muted",
        embed.aspect === "video" && "aspect-video h-auto",
        className,
      )}
      style={embed.aspect === "video" ? undefined : { height: embed.height }}
    />
  );
}
