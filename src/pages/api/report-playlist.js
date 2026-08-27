import { kv } from "@/lib/kv";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/pages/api/auth/[...nextauth]";
import {
  parseStoredPlaylist,
  PLAYLIST_REPORT_REASONS,
} from "@/components/playlist-leaderboard/playlist-utils";
import { getRequestClientIp, isValidPlaylistId } from "@/lib/playlist-security";
import { notifyPlaylistReported } from "@/lib/playlist-moderation-mail";

// One report per person per playlist per day. Long enough to stop a pile-on, short enough
// that a genuinely bad entry still accumulates a signal.
const REPORT_THROTTLE_SECONDS = 24 * 60 * 60;
const MAX_NOTE_LENGTH = 500;

/**
 * Visitor-facing report endpoint for the gym playlist leaderboard. Automated moderation is
 * weakest on borderline imagery, so this is the human backstop: it bumps a durable counter in
 * KV and emails the founder inbox.
 */
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const { id, reason, note } = req.body || {};

  if (!isValidPlaylistId(id)) {
    return res.status(400).json({ error: "Invalid playlist id" });
  }

  const matchedReason = PLAYLIST_REPORT_REASONS.find(
    (option) => option.value === reason,
  );
  if (!matchedReason) {
    return res.status(400).json({ error: "Invalid reason" });
  }

  const safeNote =
    typeof note === "string" ? note.trim().slice(0, MAX_NOTE_LENGTH) : "";

  try {
    const playlist = parseStoredPlaylist(await kv.hget("playlists", id));
    if (!playlist) {
      return res.status(404).json({ error: "Playlist not found" });
    }

    const session = await getServerSession(req, res, authOptions);
    const reporterEmail = session?.user?.email?.trim().toLowerCase();
    const clientIp = getRequestClientIp(req);
    const reportSubject = reporterEmail || clientIp;

    const reportLock = await kv.set(
      `playlist-report:${reportSubject}:${id}`,
      Date.now(),
      { ex: REPORT_THROTTLE_SECONDS, nx: true },
    );

    if (reportLock === null) {
      // Already counted today. Answer as though it worked so the reporter isn't left wondering.
      return res.status(200).json({ ok: true, alreadyReported: true });
    }

    const reportCount = await kv.hincrby("playlist-reports", id, 1);

    await notifyPlaylistReported({
      playlist: { ...playlist, id },
      reasonLabel: matchedReason.label,
      note: safeNote,
      reportCount,
      reporter: reporterEmail || `anonymous (${clientIp})`,
    });

    return res.status(200).json({ ok: true, reportCount });
  } catch (error) {
    console.error("Error reporting playlist:", error);
    return res.status(500).json({ error: "Could not record report" });
  }
}
