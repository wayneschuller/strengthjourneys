import { Resend } from "resend";

/*
 * Founder notifications for the gym playlist leaderboard.
 *
 * Every path here is best effort: a mail failure must never fail the request that triggered it.
 * The durable record is always in KV — these emails just make sure a human finds out.
 */

const FROM = "Strength Journeys <feedback@updates.strengthjourneys.xyz>";
const LEADERBOARD_URL =
  "https://www.strengthjourneys.xyz/gym-playlist-leaderboard";

function escapeHtml(text = "") {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function buildHtml({ emoji, headline, subheading, rows, note, imageUrl, imageCaption }) {
  const rowHtml = rows
    .map(
      ([label, value]) =>
        `<tr><td style="padding:6px 0;color:#6b7280;width:150px;vertical-align:top;">${escapeHtml(label)}</td><td style="padding:6px 0;">${value}</td></tr>`,
    )
    .join("");

  return `
    <div style="background:#f3f4f6;padding:24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#111827;">
      <div style="max-width:680px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
        <div style="background:#111827;color:#ffffff;padding:18px 20px;">
          <div style="font-size:48px;line-height:1;margin-bottom:8px;">${emoji}</div>
          <div style="font-size:30px;font-weight:800;letter-spacing:-0.02em;">${escapeHtml(headline)}</div>
          <div style="font-size:17px;opacity:0.92;margin-top:6px;">${escapeHtml(subheading)}</div>
        </div>
        <div style="padding:20px;">
          ${
            imageUrl
              ? `<div style="margin-bottom:16px;">
                   <img src="${escapeHtml(imageUrl)}" alt="Playlist cover art" width="160" style="display:block;max-width:160px;height:auto;border-radius:8px;" />
                   ${imageCaption ? `<div style="color:#6b7280;font-size:12px;margin-top:6px;">${escapeHtml(imageCaption)}</div>` : ""}
                 </div>`
              : ""
          }
          <table role="presentation" cellspacing="0" cellpadding="0" style="width:100%;border-collapse:collapse;">
            ${rowHtml}
          </table>
          ${
            note
              ? `<div style="margin-top:20px;">
                   <div style="font-size:12px;letter-spacing:0.06em;text-transform:uppercase;color:#6b7280;margin-bottom:8px;">Note</div>
                   <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:12px;white-space:pre-wrap;line-height:1.5;">${escapeHtml(note)}</div>
                 </div>`
              : ""
          }
          <div style="margin-top:20px;">
            <a href="${LEADERBOARD_URL}" style="display:inline-block;background:#111827;color:#ffffff;padding:10px 16px;border-radius:8px;text-decoration:none;">Open the leaderboard</a>
          </div>
          <div style="margin-top:12px;color:#6b7280;font-size:12px;">
            Sign in as an admin to approve or remove cover art from the ⋮ menu on the card.
          </div>
        </div>
      </div>
    </div>
  `;
}

async function send({ subject, text, html }) {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.FEEDBACK_EMAIL_TO;

  if (!apiKey || !to) {
    console.error(
      "Playlist moderation email not configured — RESEND_API_KEY:",
      !!apiKey,
      "FEEDBACK_EMAIL_TO:",
      !!to,
    );
    return;
  }

  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({ from: FROM, to, subject, text, html });
    if (error) console.error("Resend error sending moderation email:", error);
  } catch (error) {
    console.error("Failed to send moderation email:", error.message);
  }
}

/**
 * A visitor pressed the report flag on a playlist.
 * @param {Object} params
 * @param {Object} params.playlist - The reported playlist record.
 * @param {string} params.reasonLabel - Human-readable reason chosen in the dialog.
 * @param {number} params.reportCount - Running total of reports on this playlist.
 */
export async function notifyPlaylistReported({
  playlist,
  reasonLabel,
  note,
  reportCount,
  reporter,
}) {
  const subject = `🚩 Playlist reported (${reportCount}x) — ${playlist.title}`;

  await send({
    subject,
    text: [
      `Reason: ${reasonLabel}`,
      `Reports on this playlist so far: ${reportCount}`,
      `Reported by: ${reporter}`,
      "",
      `Title: ${playlist.title}`,
      `URL: ${playlist.url}`,
      `Cover art: ${playlist.thumbnailUrl || "none"}`,
      `Playlist ID: ${playlist.id}`,
      `Leaderboard: ${LEADERBOARD_URL}`,
      "",
      "Note:",
      note || "(none)",
    ].join("\n"),
    html: buildHtml({
      emoji: "🚩",
      headline: "Playlist reported",
      subheading: `${reasonLabel} — ${reportCount} report(s) total`,
      imageUrl: playlist.thumbnailUrl,
      imageCaption: "Cover art currently stored for this playlist",
      rows: [
        ["Title", `<strong>${escapeHtml(playlist.title)}</strong>`],
        [
          "Playlist URL",
          `<a href="${escapeHtml(playlist.url)}" style="color:#2563eb;">${escapeHtml(playlist.url)}</a>`,
        ],
        ["Playlist ID", `<code>${escapeHtml(playlist.id)}</code>`],
        ["Reported by", escapeHtml(reporter)],
      ],
      note,
    }),
  });
}

const MODERATION_EVENTS = {
  "image-rejected": {
    emoji: "🔞",
    headline: "Cover art blocked",
    subject: (title) => `🔞 Cover art blocked — ${title}`,
    summary:
      "Automated image moderation flagged this cover art. The playlist is live but the art is hidden until you approve it.",
  },
  "image-pending": {
    emoji: "🕵️",
    headline: "Cover art needs review",
    subject: (title) => `🕵️ Cover art needs review — ${title}`,
    summary:
      "Image moderation could not return a verdict, so the art is being withheld rather than published unchecked.",
  },
  "text-rejected": {
    emoji: "🛑",
    headline: "Submission rejected",
    subject: (title) => `🛑 Playlist submission rejected — ${title}`,
    summary:
      "Title or description tripped moderation. The submission was silently discarded.",
  },
};

/**
 * An automated moderation decision was made on a submission or metadata refresh.
 * @param {Object} params
 * @param {"image-rejected"|"image-pending"|"text-rejected"} params.event - Which decision fired.
 * @param {Object} params.playlist - The playlist record involved.
 * @param {string} params.detail - Why: flagged categories, score, or failure mode.
 * @param {string} params.source - Where it happened, e.g. "new submission" or "metadata refresh".
 */
export async function notifyPlaylistModeration({
  event,
  playlist,
  detail,
  source,
  imageUrl,
}) {
  const config = MODERATION_EVENTS[event];
  if (!config) return;

  await send({
    subject: config.subject(playlist.title),
    text: [
      config.summary,
      "",
      `Trigger: ${source}`,
      `Detail: ${detail || "n/a"}`,
      "",
      `Title: ${playlist.title}`,
      `URL: ${playlist.url}`,
      `Cover art: ${imageUrl || "none"}`,
      `Playlist ID: ${playlist.id}`,
      `Leaderboard: ${LEADERBOARD_URL}`,
    ].join("\n"),
    html: buildHtml({
      emoji: config.emoji,
      headline: config.headline,
      subheading: config.summary,
      imageUrl,
      imageCaption: "Art in question — withheld from the public page",
      rows: [
        ["Title", `<strong>${escapeHtml(playlist.title)}</strong>`],
        [
          "Playlist URL",
          `<a href="${escapeHtml(playlist.url)}" style="color:#2563eb;">${escapeHtml(playlist.url)}</a>`,
        ],
        ["Playlist ID", `<code>${escapeHtml(playlist.id)}</code>`],
        ["Trigger", escapeHtml(source)],
        ["Detail", escapeHtml(detail || "n/a")],
      ],
    }),
  });
}
