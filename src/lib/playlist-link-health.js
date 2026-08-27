/*
 * Link liveness for leaderboard playlists.
 *
 * The naive check — "oEmbed 404 means dead" — is wrong, and produced three false positives on
 * this very leaderboard: YouTube's oEmbed endpoint doesn't support auto-generated RDCLAK mixes,
 * which are perfectly playable. So oEmbed success proves life, but oEmbed failure proves
 * nothing, and we fall through to fetching the page.
 *
 * The bias throughout is towards "unknown" over "unreachable". Wrongly flagging a working
 * playlist is worse than missing a broken one, because a false flag is invisible to us and
 * insulting to whoever submitted it.
 */

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const OEMBED_ENDPOINTS = {
  "spotify.com": (url) =>
    `https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`,
  "youtube.com": (url) =>
    `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`,
  "youtu.be": (url) =>
    `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`,
  "soundcloud.com": (url) =>
    `https://soundcloud.com/oembed?url=${encodeURIComponent(url)}&format=json`,
};

// Text that only appears when a platform is actively telling us the thing is gone.
const GONE_MARKERS = [
  /the playlist does not exist/i,
  /this playlist type is unviewable/i,
  /playlist not found/i,
  /page not found/i,
  /content is not available/i,
  /couldn'?t find that (page|playlist)/i,
];

/**
 * YouTube Music pages are a JS shell to a plain fetch, but the same list id renders server-side
 * on youtube.com. Rewrite so there is something to actually read.
 */
function toCheckableUrl(url) {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
    const list = parsed.searchParams.get("list");

    if (host === "music.youtube.com" && list) {
      return `https://www.youtube.com/playlist?list=${encodeURIComponent(list)}`;
    }
    return url;
  } catch {
    return url;
  }
}

/**
 * Checks whether a playlist link still resolves.
 * @param {string} url - The stored playlist URL.
 * @returns {Promise<{status: "live"|"unreachable"|"unknown", detail: string}>}
 */
export async function checkPlaylistLink(url) {
  let host;
  try {
    host = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return { status: "unreachable", detail: "not a valid URL" };
  }

  // 1. oEmbed, where the platform offers it. Success is proof of life.
  const oembedKey = Object.keys(OEMBED_ENDPOINTS).find((domain) =>
    host.endsWith(domain),
  );

  if (oembedKey) {
    try {
      const res = await fetch(OEMBED_ENDPOINTS[oembedKey](url), {
        signal: AbortSignal.timeout(10000),
      });
      if (res.ok) return { status: "live", detail: "oembed ok" };
    } catch {
      // Fall through — an oEmbed timeout says nothing about the playlist.
    }
  }

  // 2. Read the page itself.
  try {
    const res = await fetch(toCheckableUrl(url), {
      redirect: "follow",
      headers: { "User-Agent": BROWSER_UA, "Accept-Language": "en-US,en;q=0.9" },
      signal: AbortSignal.timeout(20000),
    });

    if (res.status === 404 || res.status === 410) {
      return { status: "unreachable", detail: `http ${res.status}` };
    }

    if (!res.ok) {
      // 403s and 5xx are usually bot defences or a bad day, not a dead playlist.
      return { status: "unknown", detail: `http ${res.status}` };
    }

    const body = await res.text();

    // A tiny body is a JS shell or an interstitial, not a verdict either way.
    if (body.length < 20000) {
      return { status: "unknown", detail: `thin response (${body.length} bytes)` };
    }

    const marker = GONE_MARKERS.find((pattern) => pattern.test(body));
    if (marker) return { status: "unreachable", detail: "platform says it's gone" };

    return { status: "live", detail: "page ok" };
  } catch (error) {
    return { status: "unknown", detail: error.message };
  }
}
