import { Resend } from "resend";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/pages/api/auth/[...nextauth]";

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "8mb",
    },
  },
};

function escapeHtml(text = "") {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function isSafeHttpUrl(url) {
  if (typeof url !== "string") return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function validateImageDataUrl(value) {
  if (typeof value !== "string") return null;
  const match = value.match(/^data:image\/(png|jpeg);base64,([A-Za-z0-9+/=\s]+)$/i);
  if (!match) return null;

  const mimeSubtype = match[1].toLowerCase();
  const base64 = match[2].replace(/\s+/g, "");
  if (!base64) return null;

  const approxBytes = Math.floor((base64.length * 3) / 4);
  if (approxBytes > 5 * 1024 * 1024) {
    return { error: "Image too large (max 5MB)" };
  }

  return {
    mimeType: mimeSubtype === "jpeg" ? "image/jpeg" : "image/png",
    base64,
    dataUrl: `data:image/${mimeSubtype};base64,${base64}`,
  };
}

function buildTextEmail({ name, title, subtitle, canonicalUrl, feature, metadata }) {
  return [
    `Thanks for using Strength Journeys, ${name || "lifter"}!`,
    "",
    `Here is your ${feature === "year_recap" ? "Strength Unwrapped card" : "share card"}:`,
    title || "Strength Journeys share",
    subtitle || "",
    "",
    canonicalUrl ? `View it on Strength Journeys: ${canonicalUrl}` : "",
    "Explore more tools: https://www.strengthjourneys.xyz/",
    "Strength Year in Review: https://www.strengthjourneys.xyz/strength-year-in-review",
    "",
    metadata?.slideId ? `Slide: ${metadata.slideId}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function buildHtmlEmail({ name, title, subtitle, canonicalUrl, imageDataUrl, feature, metadata }) {
  const safeName = escapeHtml(name || "lifter");
  const safeTitle = escapeHtml(title || "Strength Journeys share");
  const safeSubtitle = escapeHtml(subtitle || "");
  const safeCanonicalUrl = isSafeHttpUrl(canonicalUrl) ? canonicalUrl : "https://www.strengthjourneys.xyz/";
  const safeFeatureLabel = escapeHtml(feature === "year_recap" ? "Strength Unwrapped" : "Strength Journeys");
  const safeSlideId = metadata?.slideId ? escapeHtml(String(metadata.slideId)) : "";

  return `
    <div style="background:#f3f4f6;padding:24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#111827;">
      <div style="max-width:680px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:16px;overflow:hidden;">
        <div style="background:linear-gradient(135deg,#111827,#1f2937);padding:24px;color:#ffffff;">
          <div style="font-size:12px;letter-spacing:0.08em;text-transform:uppercase;opacity:0.8;">Strength Journeys</div>
          <div style="font-size:28px;line-height:1.1;font-weight:800;letter-spacing:-0.02em;margin-top:8px;">
            Your ${safeFeatureLabel} card is ready
          </div>
          <div style="font-size:15px;line-height:1.4;opacity:0.9;margin-top:10px;">
            Thanks for training with us, ${safeName}. Here’s your shareable card.
          </div>
        </div>

        <div style="padding:20px;">
          <div style="border:1px solid #e5e7eb;border-radius:14px;padding:12px;background:#f9fafb;">
            <img
              src="${imageDataUrl}"
              alt="${safeTitle}"
              style="display:block;width:100%;max-width:360px;height:auto;margin:0 auto;border-radius:12px;border:1px solid #e5e7eb;background:#ffffff;"
            />
          </div>

          <div style="margin-top:16px;">
            <div style="font-size:20px;font-weight:700;line-height:1.2;">${safeTitle}</div>
            ${
              safeSubtitle
                ? `<div style="margin-top:6px;font-size:14px;color:#6b7280;line-height:1.4;">${safeSubtitle}</div>`
                : ""
            }
            ${
              safeSlideId
                ? `<div style="margin-top:10px;font-size:12px;color:#6b7280;">Slide: ${safeSlideId}</div>`
                : ""
            }
          </div>

          <div style="margin-top:20px;">
            <a
              href="${safeCanonicalUrl}"
              style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;padding:12px 16px;border-radius:10px;font-weight:600;margin-right:8px;"
            >
              View on Strength Journeys
            </a>
            <a
              href="https://www.strengthjourneys.xyz/"
              style="display:inline-block;background:#ffffff;color:#111827;text-decoration:none;padding:12px 16px;border-radius:10px;font-weight:600;border:1px solid #d1d5db;"
            >
              Explore More Tools
            </a>
          </div>

          <div style="margin-top:18px;font-size:13px;line-height:1.5;color:#6b7280;">
            Appreciate you using the site and putting in the work. This email was sent because you chose “Email me this” while signed in.
          </div>
        </div>
      </div>
    </div>
  `;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error("Email share env var missing: RESEND_API_KEY");
    return res.status(503).json({ error: "Email sharing is not configured" });
  }

  const session = await getServerSession(req, res, authOptions);
  const recipientEmail = session?.user?.email;

  if (!recipientEmail) {
    return res.status(401).json({ error: "You must be signed in to use email sharing" });
  }

  const {
    feature,
    title,
    subtitle,
    canonicalUrl,
    imageDataUrl,
    metadata,
  } = req.body || {};

  if (feature !== "year_recap") {
    return res.status(400).json({ error: "Unsupported feature for email sharing" });
  }

  if (!title || typeof title !== "string" || title.length > 120) {
    return res.status(400).json({ error: "Invalid title" });
  }

  if (subtitle && (typeof subtitle !== "string" || subtitle.length > 160)) {
    return res.status(400).json({ error: "Invalid subtitle" });
  }

  const validatedImage = validateImageDataUrl(imageDataUrl);
  if (!validatedImage) {
    return res.status(400).json({ error: "Invalid image payload" });
  }
  if (validatedImage.error) {
    return res.status(400).json({ error: validatedImage.error });
  }

  const resend = new Resend(apiKey);
  const safeCanonicalUrl = isSafeHttpUrl(canonicalUrl)
    ? canonicalUrl
    : "https://www.strengthjourneys.xyz/strength-year-in-review";

  const subject = `${title} • Your Strength Journeys card`;

  try {
    const payload = {
      from: "Strength Journeys <feedback@updates.strengthjourneys.xyz>",
      to: recipientEmail,
      subject,
      text: buildTextEmail({
        name: session?.user?.name,
        title,
        subtitle,
        canonicalUrl: safeCanonicalUrl,
        feature,
        metadata,
      }),
      html: buildHtmlEmail({
        name: session?.user?.name,
        title,
        subtitle,
        canonicalUrl: safeCanonicalUrl,
        imageDataUrl: validatedImage.dataUrl,
        feature,
        metadata,
      }),
    };

    const { data, error } = await resend.emails.send(payload);

    if (error) {
      console.error("Resend email share error:", error);
      return res.status(500).json({ error: "Failed to send email" });
    }

    console.log("Email share sent:", data?.id, "feature:", feature);
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("Email share handler error:", error);
    return res.status(500).json({ error: "Failed to send email" });
  }
}
