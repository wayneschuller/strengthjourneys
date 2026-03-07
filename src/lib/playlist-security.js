const LEADERBOARD_ADMIN_ENV = "STRENGTH_JOURNEYS_LEADERBOARD_ADMINS";

export function getLeaderboardAdminEmails() {
  return (process.env[LEADERBOARD_ADMIN_ENV] || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function isLeaderboardAdminEmail(email) {
  const normalizedEmail = email?.trim().toLowerCase();
  if (!normalizedEmail) return false;
  return getLeaderboardAdminEmails().includes(normalizedEmail);
}

export function getRequestClientIp(req) {
  const forwardedFor = req.headers["x-forwarded-for"];
  if (Array.isArray(forwardedFor)) {
    return forwardedFor[0]?.split(",")[0]?.trim() || req.socket.remoteAddress || "unknown";
  }

  if (typeof forwardedFor === "string" && forwardedFor.length > 0) {
    return forwardedFor.split(",")[0].trim();
  }

  return req.socket.remoteAddress || "unknown";
}

export function isValidPlaylistId(id) {
  return typeof id === "string" && /^[A-Za-z0-9_-]{8,64}$/.test(id);
}
