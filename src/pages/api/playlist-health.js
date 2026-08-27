import { kv } from "@/lib/kv";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/pages/api/auth/[...nextauth]";
import { parseStoredPlaylist } from "@/components/playlist-leaderboard/playlist-utils";
import {
  isLeaderboardAdminEmail,
  moderateThumbnail,
  thumbnailStatusFromVerdict,
} from "@/lib/playlist-security";
import { checkPlaylistLink } from "@/lib/playlist-link-health";
import { notifyPlaylistModeration } from "@/lib/playlist-moderation-mail";

/*
 * Scheduled health sweep: re-checks playlist links and re-moderates every cover image.
 *
 * Runnable two ways — by Vercel Cron with the CRON_SECRET bearer token, or by a signed-in admin
 * from the leaderboard banner.
 *
 * A link is only marked broken after CONSECUTIVE_FAILURES_TO_BREAK checks in a row have said so.
 * Platforms rate-limit and throw interstitials at server-side fetches, and a single bad reading
 * should never take a working playlist off the board.
 *
 * ---------------------------------------------------------------------------
 * Why this is not a plain for-loop any more
 *
 * A single playlist can cost ~38s in the worst case: a 10s oEmbed timeout, then a 20s page
 * fetch, then an 8s moderation call. Run serially, a few slow platforms are enough to exceed
 * the function's maximum duration — and a killed function is a silent failure. Worse, because
 * the id ordering is stable, the kill lands in the same place every run, so the tail of the
 * list (the newest submissions) would never be swept at all and nothing would say so.
 *
 * Three things stop that:
 *   1. A rotating cursor, persisted after every batch, so a hard kill still resumes at the
 *      right place on the next run instead of restarting from the top.
 *   2. Bounded concurrency, so slow platforms overlap rather than queue.
 *   3. A time budget, so we stop deliberately and record where we got to.
 *
 * Cover art is checked on every visit and link liveness is staggered, which is the opposite of
 * what the cost profile alone would suggest. It is deliberate: the art check is the cheap one
 * (a single API call, and the API is free) and it is the security-sensitive one, because
 * approved art can be swapped for something offensive on the source platform at any time. Link
 * rot is slow, nobody weaponises it, and a link found dead three days late costs nothing. The
 * exception is a link already mid-failure — those are re-checked every run so a genuine
 * breakage is confirmed in three days rather than nine.
 */

const CONSECUTIVE_FAILURES_TO_BREAK = 3;

// How many playlists to have in flight at once. Small on purpose: these are outbound fetches to
// platforms that rate-limit, and a stampede reads as bot traffic.
const CONCURRENCY = 4;

// Stop cleanly with time to spare for the KV writes and the revalidate that follow. Override
// with PLAYLIST_HEALTH_BUDGET_MS if the plan's function ceiling changes.
const DEFAULT_TIME_BUDGET_MS = 45_000;

// A live link re-checked this recently is taken on trust.
const LINK_RECHECK_INTERVAL_MS = 3 * 24 * 60 * 60 * 1000;

const CURSOR_KEY = "playlist-health-cursor";

function getTimeBudgetMs() {
  const configured = Number(process.env.PLAYLIST_HEALTH_BUDGET_MS);
  return Number.isFinite(configured) && configured > 0
    ? configured
    : DEFAULT_TIME_BUDGET_MS;
}

function isAuthorisedCron(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.authorization === `Bearer ${secret}`;
}

/**
 * Orders the ids so the sweep resumes where the last one stopped, wrapping around.
 * A cursor pointing at a deleted playlist simply falls back to the start.
 */
function orderFromCursor(ids, cursor) {
  if (!cursor) return ids;
  const index = ids.indexOf(cursor);
  if (index <= 0) return ids;
  return [...ids.slice(index), ...ids.slice(0, index)];
}

/**
 * Decides whether this playlist's link is due for a check. Anything already failing is checked
 * every run so its streak resolves promptly in either direction.
 */
function isLinkCheckDue(playlist, { force }) {
  if (force) return true;
  if ((playlist.linkFailureCount || 0) > 0) return true;
  if (playlist.linkStatus === "broken") return true;
  const checkedAt = playlist.linkCheckedAt || 0;
  return Date.now() - checkedAt >= LINK_RECHECK_INTERVAL_MS;
}

/**
 * Sweeps one playlist: optional link check, always a cover-art re-moderation.
 * Writes back only when something actually changed, and returns summary deltas.
 */
async function sweepPlaylist(id, entry, { force }) {
  const delta = {
    checked: 0,
    live: 0,
    unreachable: 0,
    unknown: 0,
    linkChecksSkipped: 0,
    newlyBroken: 0,
    recovered: 0,
    artRechecked: 0,
    artBlocked: 0,
  };

  const playlist = parseStoredPlaylist(entry);
  if (!playlist?.url) return delta;

  delta.checked = 1;
  const updated = { ...playlist, id };
  let changed = false;

  if (isLinkCheckDue(playlist, { force })) {
    const result = await checkPlaylistLink(playlist.url);
    delta[result.status] += 1;

    const previousFailures = playlist.linkFailureCount || 0;
    const failureCount =
      result.status === "unreachable" ? previousFailures + 1 : 0;
    const linkStatus =
      failureCount >= CONSECUTIVE_FAILURES_TO_BREAK ? "broken" : "ok";

    if (linkStatus === "broken" && playlist.linkStatus !== "broken") {
      delta.newlyBroken = 1;
    }
    if (playlist.linkStatus === "broken" && linkStatus === "ok") {
      delta.recovered = 1;
    }

    updated.linkStatus = linkStatus;
    updated.linkFailureCount = failureCount;
    updated.linkCheckedAt = Date.now();
    updated.linkDetail = result.detail;
    changed = true;
  } else {
    delta.linkChecksSkipped = 1;
  }

  // Cover art is editable on the source platform after we approve it, so the sweep is also
  // where a swapped-out image gets caught. Checked every pass, never staggered.
  if (playlist.thumbnailUrl) {
    const verdict = await moderateThumbnail(playlist.thumbnailUrl);
    const status = thumbnailStatusFromVerdict(verdict);
    delta.artRechecked = 1;

    if (status === "rejected") {
      delta.artBlocked = 1;
      if (playlist.thumbnailStatus !== "rejected") {
        await notifyPlaylistModeration({
          event: "image-rejected",
          playlist: updated,
          detail: verdict.reason || "flagged during health sweep",
          source: "scheduled health sweep",
          imageUrl: playlist.thumbnailUrl,
        });
      }
    }

    // Never quietly downgrade art an admin approved by hand just because a check timed out.
    if (status !== "pending" || playlist.thumbnailStatus !== "approved") {
      if (updated.thumbnailStatus !== status) changed = true;
      updated.thumbnailStatus = status;
    }
    updated.thumbnailCheckedAt = Date.now();
    changed = true;
  }

  if (changed) {
    await kv.hset("playlists", { [id]: JSON.stringify(updated) });
  }

  return delta;
}

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  const isAdmin = isLeaderboardAdminEmail(session?.user?.email);

  if (!isAdmin && !isAuthorisedCron(req)) {
    return res.status(401).json({ error: "Not authorised" });
  }

  // Admins can force every link to be re-checked rather than only the stale ones. The time
  // budget still applies — the cursor just means the rest is picked up on the next run.
  const force = isAdmin && req.query.full === "1";

  const startedAt = Date.now();
  const budgetMs = getTimeBudgetMs();

  const summary = {
    checked: 0,
    live: 0,
    unreachable: 0,
    unknown: 0,
    linkChecksSkipped: 0,
    newlyBroken: 0,
    recovered: 0,
    artRechecked: 0,
    artBlocked: 0,
    total: 0,
    completedFullPass: false,
    resumedFrom: null,
    stoppedAt: null,
    durationMs: 0,
  };

  try {
    const stored = (await kv.hgetall("playlists")) || {};
    const ids = Object.keys(stored).sort();
    summary.total = ids.length;

    if (ids.length === 0) {
      return res.status(200).json({ message: "Nothing to sweep", summary });
    }

    // Upstash deserializes on read, so coerce rather than type-check: a cursor that came back
    // as anything other than a string would otherwise silently restart the sweep from the top.
    const cursor = await kv.get(CURSOR_KEY);
    summary.resumedFrom = cursor == null ? null : String(cursor);
    const ordered = orderFromCursor(ids, summary.resumedFrom);

    let processed = 0;

    for (let i = 0; i < ordered.length; i += CONCURRENCY) {
      if (Date.now() - startedAt > budgetMs) break;

      const batch = ordered.slice(i, i + CONCURRENCY);
      const deltas = await Promise.all(
        batch.map((id) =>
          sweepPlaylist(id, stored[id], { force }).catch((error) => {
            // One bad playlist must not abort the sweep for the rest.
            console.error(`Health sweep failed for playlist ${id}:`, error);
            return null;
          }),
        ),
      );

      for (const delta of deltas) {
        if (!delta) continue;
        for (const [key, value] of Object.entries(delta)) {
          summary[key] += value;
        }
      }

      processed += batch.length;

      // Persist the cursor after every batch, not at the end. If the platform kills the
      // function mid-sweep we never reach the end, and a cursor written only there would
      // leave the tail of the list permanently unswept.
      const next = ordered[processed] ?? null;
      if (next) {
        await kv.set(CURSOR_KEY, next);
      } else {
        await kv.del(CURSOR_KEY);
      }
    }

    summary.completedFullPass = processed >= ordered.length;
    summary.stoppedAt = summary.completedFullPass
      ? null
      : (ordered[processed] ?? null);
    summary.durationMs = Date.now() - startedAt;

    try {
      await res.revalidate("/gym-playlist-leaderboard");
    } catch (error) {
      console.error("Revalidation after health sweep failed:", error);
    }

    console.log("Playlist health sweep:", JSON.stringify(summary));
    return res.status(200).json({ message: "Health sweep complete", summary });
  } catch (error) {
    console.error("Playlist health sweep failed:", error);
    summary.durationMs = Date.now() - startedAt;
    return res.status(500).json({ error: "Health sweep failed", summary });
  }
}
