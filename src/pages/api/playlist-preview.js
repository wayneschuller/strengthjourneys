import { kv } from "@/lib/kv";
import {
  validateUrl,
  sanitizeAndNormalizeUrl,
  isWhitelistedUrl,
  fetchPlaylistOembedData,
  parseStoredPlaylist,
} from "@/components/playlist-leaderboard/playlist-utils";
import {
  getRequestClientIp,
  moderateThumbnail,
} from "@/lib/playlist-security";

// Matches the server-side title limit, so a resolved title always arrives already valid rather
// than failing validation after the submitter has filled in everything else.
const MAX_TITLE_LENGTH = 120;

function fitTitle(title) {
  if (typeof title !== "string") return null;
  const trimmed = title.trim();
  if (trimmed.length <= MAX_TITLE_LENGTH) return trimmed;
  return `${trimmed.slice(0, MAX_TITLE_LENGTH - 1).trimEnd()}…`;
}

// Generous enough that nobody hits it while filling in one form, tight enough that we aren't
// a free oEmbed proxy.
const PREVIEW_LIMIT = 20;
const PREVIEW_WINDOW_SECONDS = 10 * 60;

async function isOverPreviewLimit(clientIp) {
  const key = `playlist-preview:${clientIp}`;
  const count = await kv.incr(key);
  if (count === 1) await kv.expire(key, PREVIEW_WINDOW_SECONDS);
  return count > PREVIEW_LIMIT;
}

/**
 * Resolves a pasted playlist link into a title and cover art so the submit form can fill itself
 * in. Public, because it runs before anyone has committed to submitting anything.
 *
 * Art is moderated here too — the preview renders it in our own UI, so it goes through the same
 * bar as art we would publish.
 */
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const rawUrl = typeof req.body?.url === "string" ? req.body.url.trim() : "";

  if (!rawUrl || !validateUrl(rawUrl)) {
    return res.status(400).json({
      error: "That doesn't look like a link. Paste the full https:// address.",
    });
  }

  const url = sanitizeAndNormalizeUrl(rawUrl);

  if (!isWhitelistedUrl(url)) {
    return res.status(400).json({
      error:
        "That's not one of the music platforms we accept. Spotify, YouTube Music, Apple Music, SoundCloud and friends all work.",
    });
  }

  try {
    if (await isOverPreviewLimit(getRequestClientIp(req))) {
      return res
        .status(429)
        .json({ error: "Slow down a moment, then try again." });
    }

    // Nothing is more annoying than filling in a form for something already on the board.
    const stored = (await kv.hgetall("playlists")) || {};
    const duplicate = Object.values(stored)
      .map((entry) => parseStoredPlaylist(entry))
      .find((playlist) => playlist?.url === url);

    if (duplicate) {
      return res.status(200).json({
        url,
        duplicate: true,
        title: duplicate.title,
      });
    }

    const oembed = await fetchPlaylistOembedData(url);
    const verdict = await moderateThumbnail(oembed?.thumbnailUrl);
    const artIsShowable =
      Boolean(oembed?.thumbnailUrl) && verdict.checked && !verdict.flagged;

    return res.status(200).json({
      url,
      duplicate: false,
      title: fitTitle(oembed?.title),
      thumbnailUrl: artIsShowable ? oembed.thumbnailUrl : null,
      // The submitter doesn't need to know why; they just shouldn't see art we wouldn't publish.
      artWithheld: Boolean(oembed?.thumbnailUrl) && !artIsShowable,
    });
  } catch (error) {
    console.error("Error previewing playlist:", error);
    return res.status(500).json({ error: "Could not read that link" });
  }
}
