import { Resend } from "resend";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/pages/api/auth/[...nextauth]";
import { RegExpMatcher, englishDataset } from "obscenity";

const resend = new Resend(process.env.RESEND_API_KEY);
const matcher = new RegExpMatcher({ ...englishDataset.build() });

function containsProfanity(text) {
  return matcher.hasMatch(text);
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const { message, sentiment, page, email, userType } = req.body;

  if (!message || typeof message !== "string" || message.trim().length === 0) {
    return res.status(400).json({ error: "Message is required" });
  }

  if (message.length > 5000) {
    return res.status(400).json({ error: "Message too long (max 5000 chars)" });
  }

  // Get session if authenticated
  const session = await getServerSession(req, res, authOptions);
  const userName = session?.user?.name || "Anonymous";
  const userEmail = session?.user?.email || email || "not provided";

  const hasProfanity = containsProfanity(message);
  const subjectPrefix = hasProfanity ? "[PROFANITY] [Feedback]" : "[Feedback]";
  const sentimentLabel = sentiment === "positive" ? "thumbs up" : "thumbs down";

  const to = process.env.FEEDBACK_EMAIL_TO;
  if (!to) {
    console.error("FEEDBACK_EMAIL_TO env var is not set");
    return res.status(500).json({ error: "Feedback service not configured" });
  }

  try {
    const { data, error: sendError } = await resend.emails.send({
      from: "Strength Journeys <onboarding@resend.dev>",
      to,
      subject: `${subjectPrefix} from ${userName} — ${sentimentLabel} — ${page || "/"}`,
      text: [
        `Sentiment: ${sentimentLabel}`,
        `Page: ${page || "/"}`,
        `User type: ${userType || "unknown"}`,
        `Name: ${userName}`,
        `Email: ${userEmail}`,
        "",
        "Message:",
        message.trim(),
      ].join("\n"),
    });

    if (sendError) {
      console.error("Resend API error:", sendError);
      return res.status(500).json({ error: "Failed to send feedback" });
    }

    console.log("Feedback email sent:", data?.id);
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("Error sending feedback email:", error);
    return res.status(500).json({ error: "Failed to send feedback" });
  }
}
