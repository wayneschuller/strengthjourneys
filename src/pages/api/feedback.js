import { Resend } from "resend";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/pages/api/auth/[...nextauth]";
import { RegExpMatcher, englishDataset } from "obscenity";

const matcher = new RegExpMatcher({ ...englishDataset.build() });

function containsProfanity(text) {
  return matcher.hasMatch(text);
}

function escapeHtml(text = "") {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatCount(value) {
  return typeof value === "number" && Number.isFinite(value)
    ? value.toLocaleString("en-US")
    : "unknown";
}

function getBaseUrl(req) {
  if (process.env.NEXTAUTH_URL) {
    return process.env.NEXTAUTH_URL.replace(/\/$/, "");
  }

  const host = req.headers.host;
  if (!host) return "";
  const protocol = req.headers["x-forwarded-proto"] || "https";
  return `${protocol}://${host}`;
}

function toAbsolutePageUrl(req, page) {
  const safePage = typeof page === "string" && page.startsWith("/") ? page : "/";
  const baseUrl = getBaseUrl(req);
  return baseUrl ? `${baseUrl}${safePage}` : safePage;
}

function normalizeMetadata(metadata) {
  if (!metadata || typeof metadata !== "object") {
    return {
      parsedRowCount: "unknown",
    };
  }

  return {
    parsedRowCount: formatCount(metadata.parsedRowCount),
  };
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.FEEDBACK_EMAIL_TO;

  if (!apiKey || !to) {
    console.error(
      "Feedback env vars missing — RESEND_API_KEY:",
      !!apiKey,
      "FEEDBACK_EMAIL_TO:",
      !!to,
    );
    return res.status(503).json({ error: "Feedback service not configured" });
  }

  const { message, sentiment, page, includeEmail, email, userType, metadata } = req.body;

  if (!message || typeof message !== "string" || message.trim().length === 0) {
    return res.status(400).json({ error: "Message is required" });
  }

  if (message.length > 5000) {
    return res.status(400).json({ error: "Message too long (max 5000 chars)" });
  }

  // Get session if authenticated
  const session = await getServerSession(req, res, authOptions);
  const isLoggedIn = Boolean(session?.user);
  const userName = isLoggedIn ? (session?.user?.name || "Authenticated user") : "Anonymous visitor";
  const optedInForReply = includeEmail === true;
  const submittedEmail = typeof email === "string" ? email.trim() : "";
  const replyToCandidate = optedInForReply ? (submittedEmail || session?.user?.email || "") : "";
  const replyToEmail = isValidEmail(replyToCandidate) ? replyToCandidate : null;
  const contactEmailLabel = replyToEmail
    ? replyToEmail
    : optedInForReply
      ? "opted in but no valid email provided"
      : "not shared";

  const hasProfanity = containsProfanity(message);
  const subjectPrefix = hasProfanity ? "[PROFANITY] [Feedback]" : "[Feedback]";
  const sentimentLabel = sentiment === "positive" ? "thumbs up" : "thumbs down";
  const pagePath = typeof page === "string" && page.startsWith("/") ? page : "/";
  const baseUrl = getBaseUrl(req);
  const pageUrl = toAbsolutePageUrl(req, pagePath);
  const logoUrl = baseUrl ? `${baseUrl}/nav_logo_light.png` : "";
  const safeMessage = message.trim();
  const safeName = escapeHtml(userName);
  const safeContactEmail = escapeHtml(contactEmailLabel);
  const safeAuthStatus = isLoggedIn ? "Logged in" : "Not logged in (anonymous)";
  const safePagePath = escapeHtml(pagePath);
  const safePageUrl = escapeHtml(pageUrl);
  const safeUserType = escapeHtml(userType || "unknown");
  const safeLogoUrl = escapeHtml(logoUrl);
  const meta = normalizeMetadata(metadata);

  const resend = new Resend(apiKey);

  try {
    const emailPayload = {
      from: "Strength Journeys <feedback@updates.strengthjourneys.xyz>",
      to,
      subject: `${subjectPrefix} from ${userName} — ${sentimentLabel} — ${pagePath}`,
      text: [
        `Sentiment: ${sentimentLabel}`,
        `Authentication: ${safeAuthStatus}`,
        `Page: ${pagePath}`,
        `Page URL: ${pageUrl}`,
        `User type: ${userType || "unknown"}`,
        `Parsed rows: ${meta.parsedRowCount}`,
        `Name: ${userName}`,
        `Contact email: ${contactEmailLabel}`,
        `User agent: ${req.headers["user-agent"] || "unknown"}`,
        "",
        "Message:",
        safeMessage,
      ].join("\n"),
      html: `
        <div style="background:#f3f4f6;padding:24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#111827;">
          <div style="max-width:680px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
            <div style="background:#111827;color:#ffffff;padding:16px 20px;">
              ${
                safeLogoUrl
                  ? `<img src="${safeLogoUrl}" alt="Strength Journeys logo" width="170" style="display:block;max-width:170px;height:auto;margin-bottom:10px;" />`
                  : ""
              }
              <div style="font-size:18px;font-weight:700;">New Feedback</div>
              <div style="font-size:13px;opacity:0.9;margin-top:4px;">${escapeHtml(sentimentLabel)} from ${safeName}</div>
            </div>
            <div style="padding:20px;">
              <table role="presentation" cellspacing="0" cellpadding="0" style="width:100%;border-collapse:collapse;">
                <tr><td style="padding:6px 0;color:#6b7280;width:140px;">Authentication</td><td style="padding:6px 0;font-weight:${isLoggedIn ? "500" : "700"};color:${isLoggedIn ? "#111827" : "#b91c1c"};">${escapeHtml(safeAuthStatus)}</td></tr>
                <tr><td style="padding:6px 0;color:#6b7280;width:140px;">Page</td><td style="padding:6px 0;"><a href="${safePageUrl}" style="color:#2563eb;text-decoration:underline;">${safePagePath}</a></td></tr>
                <tr><td style="padding:6px 0;color:#6b7280;">User type</td><td style="padding:6px 0;">${safeUserType}</td></tr>
                <tr><td style="padding:6px 0;color:#6b7280;">Contact email</td><td style="padding:6px 0;">${safeContactEmail}</td></tr>
                <tr><td style="padding:6px 0;color:#6b7280;">Parsed rows</td><td style="padding:6px 0;">${escapeHtml(meta.parsedRowCount)}</td></tr>
              </table>

              <div style="margin-top:20px;">
                <div style="font-size:12px;letter-spacing:0.06em;text-transform:uppercase;color:#6b7280;margin-bottom:8px;">Message</div>
                <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:12px;white-space:pre-wrap;line-height:1.5;">${escapeHtml(safeMessage)}</div>
              </div>

              <div style="margin-top:16px;color:#6b7280;font-size:12px;">User agent: ${escapeHtml(req.headers["user-agent"] || "unknown")}</div>
            </div>
          </div>
        </div>
      `,
    };

    if (replyToEmail) {
      emailPayload.replyTo = replyToEmail;
    }

    const { data, error: sendError } = await resend.emails.send(emailPayload);

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
