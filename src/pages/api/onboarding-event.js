import { authOptions, promptDeveloper } from "@/pages/api/auth/[...nextauth]";
import { getServerSession } from "next-auth/next";

const ALLOWED_EVENTS = new Set([
  "onboarding-success",
  "onboarding-aborted",
  "onboarding-failed",
]);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) {
    res.status(401).json({ error: "You must be logged in." });
    return;
  }

  const event = typeof req.body?.event === "string" ? req.body.event : "";
  if (!ALLOWED_EVENTS.has(event)) {
    res.status(400).json({ error: "Invalid onboarding event." });
    return;
  }

  const meta = typeof req.body?.meta === "object" && req.body?.meta ? req.body.meta : {};

  try {
    await promptDeveloper(event, session.user, meta);
    res.status(200).json({ ok: true });
  } catch (error) {
    console.error("[onboarding-event] failed:", error);
    res.status(500).json({ error: error.message || "Failed to send onboarding event" });
  }
}
