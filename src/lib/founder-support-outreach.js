/**
 * Turns noisy onboarding events into one founder outcome notification and one
 * delayed, reply-first support note to the user. Resend owns the delay so this
 * flow does not need a cron job or a queue worker.
 */

import { Resend } from "resend";

import { kv } from "@/lib/kv";
import { isLeaderboardAdminEmail } from "@/lib/playlist-security";

const FROM_EMAIL = "Strength Journeys <feedback@updates.strengthjourneys.xyz>";
const MIN_DELAY_HOURS = 24;
const DELAY_WINDOW_HOURS = 49;
const SUPPORT_LOCK_SECONDS = 30;

function normalizeEmail(email) {
  return typeof email === "string" ? email.trim().toLowerCase() : "";
}

function getUserKey(email) {
  return `sj:user:${normalizeEmail(email)}`;
}

function getLockKey(email) {
  return `sj:support-outreach-lock:${normalizeEmail(email)}`;
}

function getDelayMs(email) {
  let hash = 0;
  for (const character of normalizeEmail(email)) {
    hash = (hash * 31 + character.codePointAt(0)) >>> 0;
  }

  const hours = MIN_DELAY_HOURS + (hash % DELAY_WINDOW_HOURS);
  const minutes = (hash >>> 8) % 60;
  return (hours * 60 + minutes) * 60 * 1000;
}

function getScheduledAt(email, now = new Date()) {
  return new Date(now.getTime() + getDelayMs(email)).toISOString();
}

function getFirstName(user) {
  const explicitFirstName =
    typeof user?.firstName === "string" ? user.firstName.trim() : "";
  const nameFirstWord =
    typeof user?.name === "string" ? user.name.trim().split(/\s+/)[0] : "";
  const candidate = explicitFirstName || nameFirstWord;

  return /^[\p{L}\p{M}'’-]{1,40}$/u.test(candidate) ? candidate : null;
}

function getGreeting(user) {
  const firstName = getFirstName(user);
  return firstName ? `Hi ${firstName},` : "Hi there,";
}

function getFounderName(user) {
  return user?.name || user?.email || "Unknown user";
}

function escapeEmailHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatEmailLine(line) {
  return escapeEmailHtml(line)
    .replace(
      /https:\/\/[^\s]+/g,
      (url) => `<a href="${url}" style="color:#1155cc">${url}</a>`,
    )
    .replaceAll(
      "Strength Journeys",
      '<a href="https://www.strengthjourneys.xyz/" style="color:#1155cc">Strength Journeys</a>',
    );
}

function buildUserEmailHtml(text) {
  const paragraphs = text.split(/\n{2,}/).map((paragraph) => {
    const lines = paragraph.split("\n").map(formatEmailLine).join("<br>");
    return `<p style="margin:0 0 16px">${lines}</p>`;
  });

  return `<div style="font-family:Arial,sans-serif;font-size:16px;line-height:1.5;color:#111">${paragraphs.join("")}</div>`;
}

function buildUserEmail(user, outcome) {
  const sharedOpening = [
    getGreeting(user),
    "",
    "Thanks for signing into Strength Journeys recently.",
    "",
    "I'm Wayne, the person building it. I'm a garage gym lifter who started in CrossFit, but these days I mainly train the big four lifts — hopefully for the rest of my life.",
    "",
  ];
  const sharedClosing = [
    "",
    "Even a quick sentence helps a lot.",
    "",
    "Thanks again for checking it out,",
    "Wayne",
    "https://www.instagram.com/wayneschuller/",
  ];

  if (outcome === "stalled") {
    return {
      subject: "Did Google Drive stop you?",
      text: [
        ...sharedOpening,
        "It looks like setup may have stopped at the Google Drive permission step. Strength Journeys can only access the lifting Sheet it creates for you — it cannot access anything else in your Drive.",
        "",
        "If you'd rather not connect Drive, you can also explore your exported lifting data entirely in your browser: https://www.strengthjourneys.xyz/import",
        "",
        "Was it mainly a privacy concern, or did the Google setup simply not work?",
        ...sharedClosing,
      ].join("\n"),
    };
  }

  const question =
    outcome === "recovered"
      ? "The Google connection step can be the awkward part. Did anything there feel unclear or untrustworthy?"
      : "What were you hoping Strength Journeys would help you see or do?";

  return {
    subject: "Quick question about Strength Journeys",
    text: [...sharedOpening, question, ...sharedClosing].join("\n"),
  };
}

function buildFounderEmail(user, outcome, record, scheduledAt = null) {
  const name = getFounderName(user);
  const labels = {
    smooth: "Smooth onboarding",
    recovered: "Drive scope recovered",
    stalled: "Drive scope still missing",
  };
  const descriptions = {
    smooth: "granted the required Drive scope and completed activation smoothly.",
    recovered:
      "initially missed the required Drive scope, then granted it and continued setup.",
    stalled:
      "has not recovered from the missing Drive scope by the time this delayed check was sent.",
  };

  return {
    subject: `[SJ] ${labels[outcome]} — ${name}`,
    text: [
      `${name} (${user.email}) ${descriptions[outcome]}`,
      record.firstSignInPage
        ? `First sign-in page: ${record.firstSignInPage}`
        : null,
      record.firstSignInCta ? `First sign-in CTA: ${record.firstSignInCta}` : null,
      record.firstMissingDriveScopeAt
        ? `First missing scope: ${record.firstMissingDriveScopeAt}`
        : null,
      record.driveScopeRecoveredAt
        ? `Scope recovered: ${record.driveScopeRecoveredAt}`
        : null,
      scheduledAt ? `User support email scheduled for: ${scheduledAt}` : null,
    ]
      .filter(Boolean)
      .join("\n"),
  };
}

function getResendContext(user) {
  const apiKey = process.env.RESEND_API_KEY;
  const founderEmail = normalizeEmail(process.env.FEEDBACK_EMAIL_TO);
  const userEmail = normalizeEmail(user?.email);

  if (!apiKey || !founderEmail || !userEmail) return null;
  if (process.env.NEXT_PUBLIC_STRENGTH_JOURNEYS_ENV === "development") return null;
  if (
    process.env.ENABLE_AUTOMATED_FOUNDER_OUTREACH?.trim().toLowerCase() ===
    "false"
  ) {
    return null;
  }
  if (userEmail === founderEmail || isLeaderboardAdminEmail(userEmail)) return null;

  return {
    founderEmail,
    resend: new Resend(apiKey),
    userEmail,
  };
}

async function acquireLock(email) {
  const result = await kv.set(getLockKey(email), Date.now(), {
    ex: SUPPORT_LOCK_SECONDS,
    nx: true,
  });
  return result !== null;
}

async function releaseLock(email) {
  await kv.del(getLockKey(email));
}

async function scheduleEmail(resend, payload, idempotencyKey) {
  const { data, error } = await resend.emails.send(payload, { idempotencyKey });
  if (error || !data?.id) {
    throw new Error(error?.message || "Resend did not return a scheduled email ID");
  }
  return data.id;
}

async function sendEmail(resend, payload, idempotencyKey) {
  const { error } = await resend.emails.send(payload, { idempotencyKey });
  if (error) throw new Error(error.message || "Resend failed to send email");
}

async function cancelScheduledEmail(resend, emailId) {
  if (!emailId) return true;
  const { error } = await resend.emails.cancel(emailId);
  if (error) {
    console.error("[founder-support] scheduled email cancellation failed:", error);
    return false;
  }
  return true;
}

async function scheduleUserNote({ context, user, outcome, scheduledAt }) {
  const message = buildUserEmail(user, outcome);
  return scheduleEmail(
    context.resend,
    {
      bcc: context.founderEmail,
      from: FROM_EMAIL,
      to: context.userEmail,
      replyTo: context.founderEmail,
      subject: message.subject,
      html: buildUserEmailHtml(message.text),
      text: message.text,
      scheduledAt,
    },
    `founder-support/user/${outcome}/${context.userEmail}`,
  );
}

async function scheduleStalledFounderNote({ context, user, record, scheduledAt }) {
  const message = buildFounderEmail(user, "stalled", record, scheduledAt);
  return scheduleEmail(
    context.resend,
    {
      from: FROM_EMAIL,
      to: context.founderEmail,
      subject: message.subject,
      text: message.text,
      scheduledAt,
    },
    `founder-support/founder/stalled/${context.userEmail}`,
  );
}

async function sendFounderOutcome({ context, user, outcome, record, scheduledAt }) {
  const message = buildFounderEmail(user, outcome, record, scheduledAt);
  await sendEmail(
    context.resend,
    {
      from: FROM_EMAIL,
      to: context.founderEmail,
      subject: message.subject,
      text: message.text,
    },
    `founder-support/founder/${outcome}/${context.userEmail}`,
  );
}

export async function handleSupportSignIn(user, meta = {}) {
  if (meta.hasRequiredDriveScope !== false) return;

  const context = getResendContext(user);
  if (!context || !(await acquireLock(context.userEmail))) return;

  try {
    const kvKey = getUserKey(context.userEmail);
    const record = (await kv.get(kvKey)) || {};
    if (
      !record.supportOutreachEligibleAt ||
      record.supportOutcomeAt ||
      record.supportStalledUserEmailId ||
      record.supportUserOutreachSentOrScheduledAt
    ) {
      return;
    }

    const scheduledAt = getScheduledAt(context.userEmail);
    const stalledRecord = {
      ...record,
      firstMissingDriveScopeAt:
        record.firstMissingDriveScopeAt || new Date().toISOString(),
    };
    let nextRecord = {
      ...stalledRecord,
      supportPendingOutcome: "stalled",
      supportUserOutreachScheduledFor: scheduledAt,
    };

    if (!record.supportStalledFounderEmailId) {
      const founderEmailId = await scheduleStalledFounderNote({
        context,
        user,
        record: stalledRecord,
        scheduledAt,
      });
      nextRecord = {
        ...nextRecord,
        supportStalledFounderEmailId: founderEmailId,
      };
      await kv.set(kvKey, nextRecord);
    }

    if (!record.supportStalledUserEmailId) {
      const userEmailId = await scheduleUserNote({
        context,
        user,
        outcome: "stalled",
        scheduledAt,
      });
      await kv.set(kvKey, {
        ...nextRecord,
        supportStalledUserEmailId: userEmailId,
      });
    }
  } finally {
    await releaseLock(context.userEmail);
  }
}

export async function handleSupportActivation(
  user,
  { requirePriorMissingScope = false } = {},
) {
  const context = getResendContext(user);
  if (!context || !(await acquireLock(context.userEmail))) return;

  try {
    const kvKey = getUserKey(context.userEmail);
    const record = (await kv.get(kvKey)) || {};
    if (
      !record.supportOutreachEligibleAt ||
      record.supportOutcomeAt ||
      (requirePriorMissingScope && !record.firstMissingDriveScopeAt)
    ) {
      return;
    }

    const now = new Date();
    const nowIso = now.toISOString();
    const hadMissingScope = Boolean(record.firstMissingDriveScopeAt);
    const pendingSendMs = record.supportUserOutreachScheduledFor
      ? new Date(record.supportUserOutreachScheduledFor).getTime()
      : null;
    const pendingEmailHasLikelySent =
      Number.isFinite(pendingSendMs) && pendingSendMs <= now.getTime();

    let stalledUserEmailCancelled = true;
    if (!pendingEmailHasLikelySent) {
      stalledUserEmailCancelled = await cancelScheduledEmail(
        context.resend,
        record.supportStalledUserEmailId,
      );
      await cancelScheduledEmail(context.resend, record.supportStalledFounderEmailId);
    }

    const outcome = hadMissingScope ? "recovered" : "smooth";
    const scheduledAt = pendingEmailHasLikelySent
      ? record.supportUserOutreachScheduledFor
      : getScheduledAt(context.userEmail, now);
    let userEmailId = record.supportStalledUserEmailId || null;

    if (!pendingEmailHasLikelySent && stalledUserEmailCancelled) {
      userEmailId = await scheduleUserNote({
        context,
        user,
        outcome,
        scheduledAt,
      });
    }

    const nextRecord = {
      ...record,
      ...(hadMissingScope && !record.driveScopeRecoveredAt
        ? { driveScopeRecoveredAt: nowIso }
        : {}),
      supportOutcome: outcome,
      supportOutcomeAt: nowIso,
      supportPendingOutcome: null,
      supportStalledFounderEmailId: null,
      supportStalledUserEmailId: null,
      supportUserEmailId: userEmailId,
      supportUserOutreachScheduledFor: scheduledAt,
      supportUserOutreachSentOrScheduledAt:
        record.supportUserOutreachSentOrScheduledAt || nowIso,
    };

    await sendFounderOutcome({
      context,
      user,
      outcome,
      record: nextRecord,
      scheduledAt,
    });
    await kv.set(kvKey, nextRecord);
  } finally {
    await releaseLock(context.userEmail);
  }
}
