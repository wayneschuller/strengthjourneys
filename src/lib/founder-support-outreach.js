/**
 * Turns noisy onboarding events into one founder outcome notification and one
 * delayed, reply-first support note to the user. Resend owns the delay so this
 * flow does not need a cron job or a queue worker.
 *
 * BY DESIGN, the founder receives two messages per user outcome:
 *   1. A structured `[SJ]` notification, sent immediately, carrying the KV
 *      context (entry page, CTA, scope timeline, when the user note will land).
 *   2. A bcc of the user-facing note itself, arriving whenever that note is
 *      actually delivered, so the exact wording the user saw can be observed
 *      and tracked as a real conversation.
 * Two purposeful messages replace the previous behaviour, where a single
 * successful onboarding could fan out into five separate founder emails about
 * intermediate steps. See `DEFAULT_DISABLED_EVENTS` in "@/lib/founder-
 * notifications" for the legacy event emails this superseded.
 */

import { Resend } from "resend";

import { kv } from "@/lib/kv";
import { isLeaderboardAdminEmail } from "@/lib/playlist-security";
import { mergeUserRecord, readUserRecord } from "@/lib/user-kv-keys";

const FROM_EMAIL = "Strength Journeys <feedback@updates.strengthjourneys.xyz>";
const MIN_DELAY_HOURS = 24;
const DELAY_WINDOW_HOURS = 49;
const SUPPORT_LOCK_SECONDS = 30;
const FOUNDER_EMAIL_HISTORY_LIMIT = 25;

function normalizeEmail(email) {
  return typeof email === "string" ? email.trim().toLowerCase() : "";
}

// The per-user KV record is keyed on the raw provider email, so this module must
// go through the shared helpers in "@/lib/user-kv-keys" rather than building a
// key from the normalized address. Reading a normalized key here would silently
// miss `supportOutreachEligibleAt` for any mixed-case address and disable the
// whole flow for those users, with nothing logged.
//
// Everything below that is *not* a KV record key stays normalized on purpose:
// one lock and one idempotency key per human, whatever casing they signed in
// with, so two casings cannot race or double-send.
function getLockKey(email) {
  return `sj:support-outreach-lock:${normalizeEmail(email)}`;
}

/**
 * Opt-out hook, intentionally left without a writer for now.
 *
 * The current practice is a single personal email to each new user, which then
 * becomes a hand-managed reply thread — closer to correspondence than to a
 * mailing list, so there is no list to leave. Nothing sets
 * `emailPreferences.founderSupportUnsubscribedAt` yet; the check exists so the
 * suppression point is already in the right place.
 *
 * If this ever grows into recurring or bulk sending, it stops being
 * correspondence and needs real list infrastructure: a writer for this field,
 * an unsubscribe link in `buildUserEmail`, and a `List-Unsubscribe` header on
 * the Resend payload.
 */
function hasFounderSupportOptOut(record) {
  return Boolean(record.emailPreferences?.founderSupportUnsubscribedAt);
}

function appendFounderEmailHistory(record, entry) {
  const history = Array.isArray(record.founderEmailHistory)
    ? record.founderEmailHistory
    : [];
  return [...history, entry].slice(-FOUNDER_EMAIL_HISTORY_LIMIT);
}

function markFounderEmailCancelled(record, resendEmailId, cancelledAt) {
  const history = Array.isArray(record.founderEmailHistory)
    ? record.founderEmailHistory
    : [];

  return history.map((entry) =>
    entry.resendEmailId === resendEmailId
      ? { ...entry, status: "cancelled", cancelledAt }
      : entry,
  );
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

function isWhitespace(character) {
  return character === " " || character === "\t" || character === "\n"
    || character === "\r";
}

function getFirstWord(value) {
  const trimmed = value.trim();
  for (let index = 0; index < trimmed.length; index += 1) {
    if (isWhitespace(trimmed[index])) return trimmed.slice(0, index);
  }
  return trimmed;
}

// Punctuation that legitimately appears inside a given name.
const NAME_PUNCTUATION = "'’-";
// ASCII characters that never do.
const NON_NAME_ASCII = "0123456789!\"#$%&()*+,./:;<=>?@[\\]^_`{|}~";
// Non-ASCII blocks that hold symbols and punctuation rather than letters, so a
// display name like "🔥Wayne" or "「Bob」" still falls back to "Hi there,".
// Everything outside these ranges is allowed through, which keeps Cyrillic
// (U+0400+), Arabic (U+0600+), CJK ideographs (U+4E00+) and Hangul (U+AC00+)
// working for a personalised greeting.
const NON_NAME_CODE_POINT_RANGES = [
  [0x2000, 0x2bff], // punctuation, currency, arrows, math, misc symbols, dingbats
  [0x3000, 0x303f], // CJK symbols and punctuation
  [0xfe00, 0xfe0f], // variation selectors
  [0x1f000, 0x1faff], // emoji and pictographs
];

function isNonNameCodePoint(codePoint) {
  return NON_NAME_CODE_POINT_RANGES.some(
    ([start, end]) => codePoint >= start && codePoint <= end,
  );
}

/**
 * Guards what can be interpolated into "Hi <name>,". This is a plausibility
 * check, not sanitisation — the value is HTML-escaped before it reaches the
 * email either way. The aim is simply to fall back to "Hi there," when a
 * provider display name is clearly not a first name.
 */
function isPlausibleFirstName(candidate) {
  if (candidate.length === 0 || candidate.length > 40) return false;

  for (const character of candidate) {
    if (NAME_PUNCTUATION.includes(character)) continue;
    const codePoint = character.codePointAt(0);
    // Control characters and the space range.
    if (codePoint <= 0x20 || codePoint === 0x7f) return false;
    if (NON_NAME_ASCII.includes(character)) return false;
    if (isNonNameCodePoint(codePoint)) return false;
  }
  return true;
}

function getFirstName(user) {
  const explicitFirstName =
    typeof user?.firstName === "string" ? user.firstName.trim() : "";
  const nameFirstWord =
    typeof user?.name === "string" ? getFirstWord(user.name) : "";
  const candidate = explicitFirstName || nameFirstWord;

  return isPlausibleFirstName(candidate) ? candidate : null;
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

const LINK_STYLE = "color:#1155cc";
const URL_SCHEME = "https://";
// Trailing characters that belong to the sentence rather than to the link, so
// "see https://example.com/x." does not pull the full stop into the href.
const URL_TRAILING_PUNCTUATION = ".,;:!?)]}\"'";

/**
 * Splits a line into plain-text and URL runs by scanning for the scheme and
 * walking to the next whitespace. Deliberately no regex: the boundary rules
 * here are "stop at whitespace, then give back trailing punctuation", which is
 * clearer and easier to verify written out than encoded in a pattern.
 */
function splitLineOnUrls(line) {
  const segments = [];
  let emittedTo = 0; // end of the text already pushed into `segments`
  let searchFrom = 0;

  while (searchFrom < line.length) {
    const start = line.indexOf(URL_SCHEME, searchFrom);
    if (start === -1) break;

    let end = start;
    while (end < line.length && !isWhitespace(line[end])) end += 1;
    while (end > start && URL_TRAILING_PUNCTUATION.includes(line[end - 1])) {
      end -= 1;
    }

    if (end <= start + URL_SCHEME.length) {
      // A bare scheme with no host after it. Keep it as ordinary text and
      // carry on scanning the rest of the line.
      searchFrom = start + URL_SCHEME.length;
      continue;
    }

    if (start > emittedTo) {
      segments.push({ type: "text", value: line.slice(emittedTo, start) });
    }
    segments.push({ type: "url", value: line.slice(start, end) });
    emittedTo = end;
    searchFrom = end;
  }

  if (emittedTo < line.length) {
    segments.push({ type: "text", value: line.slice(emittedTo) });
  }
  return segments;
}

function linkBrandMentions(escapedText) {
  return escapedText.replaceAll(
    "Strength Journeys",
    `<a href="https://www.strengthjourneys.xyz/" style="${LINK_STYLE}">Strength Journeys</a>`,
  );
}

function formatEmailLine(line) {
  // URLs are located in the raw line and each segment is escaped on its own.
  // Escaping first would fold characters like & into entities (&amp;) and blur
  // the boundary between a link and the punctuation that follows it. It also
  // keeps the brand-linking pass off the inside of an href.
  return splitLineOnUrls(line)
    .map((segment) => {
      const escaped = escapeEmailHtml(segment.value);
      return segment.type === "url"
        ? `<a href="${escaped}" style="${LINK_STYLE}">${escaped}</a>`
        : linkBrandMentions(escaped);
    })
    .join("");
}

/**
 * Groups lines into paragraphs, treating any run of blank lines as the break.
 * The message bodies are arrays joined on "\n" with "" entries as spacers, so
 * grouping non-blank runs is exactly the intent — and unlike a split on two or
 * more newlines it cannot emit an empty paragraph.
 */
function splitParagraphs(text) {
  const paragraphs = [];
  let current = [];

  for (const line of text.split("\n")) {
    if (line.trim().length === 0) {
      if (current.length > 0) paragraphs.push(current);
      current = [];
      continue;
    }
    current.push(line);
  }
  if (current.length > 0) paragraphs.push(current);

  return paragraphs;
}

function buildUserEmailHtml(text) {
  const paragraphs = splitParagraphs(text).map((lines) => {
    const body = lines.map(formatEmailLine).join("<br>");
    return `<p style="margin:0 0 16px">${body}</p>`;
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
    // Raw provider address, used only to resolve the KV record key.
    recordEmail: user.email,
    resend: new Resend(apiKey),
    // Normalized address, used for the lock, the `to:` header and Resend
    // idempotency keys.
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
    const { record, writeKey } = await readUserRecord(context.recordEmail);
    if (
      !writeKey ||
      !record.supportOutreachEligibleAt ||
      hasFounderSupportOptOut(record) ||
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
    const pendingFields = {
      firstMissingDriveScopeAt: stalledRecord.firstMissingDriveScopeAt,
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
      await mergeUserRecord(writeKey, {
        ...pendingFields,
        supportStalledFounderEmailId: founderEmailId,
      });
    }

    if (!record.supportStalledUserEmailId) {
      const userEmailId = await scheduleUserNote({
        context,
        user,
        outcome: "stalled",
        scheduledAt,
      });
      // Append onto the freshest history so the founder email ID written a
      // moment ago (and anything a concurrent request added) survives.
      await mergeUserRecord(writeKey, (latest) => ({
        ...pendingFields,
        founderEmailHistory: appendFounderEmailHistory(latest, {
          category: "founder_support",
          outcome: "stalled",
          recordedAt: new Date().toISOString(),
          resendEmailId: userEmailId,
          scheduledAt,
          status: "scheduled",
        }),
        supportStalledUserEmailId: userEmailId,
      }));
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
    const { record, writeKey } = await readUserRecord(context.recordEmail);
    if (
      !writeKey ||
      !record.supportOutreachEligibleAt ||
      hasFounderSupportOptOut(record) ||
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
    let founderEmailHistory = Array.isArray(record.founderEmailHistory)
      ? record.founderEmailHistory
      : [];

    if (
      !pendingEmailHasLikelySent &&
      stalledUserEmailCancelled &&
      record.supportStalledUserEmailId
    ) {
      founderEmailHistory = markFounderEmailCancelled(
        record,
        record.supportStalledUserEmailId,
        nowIso,
      );
    }

    if (!pendingEmailHasLikelySent && stalledUserEmailCancelled) {
      userEmailId = await scheduleUserNote({
        context,
        user,
        outcome,
        scheduledAt,
      });
      founderEmailHistory = appendFounderEmailHistory(
        { founderEmailHistory },
        {
          category: "founder_support",
          outcome,
          recordedAt: nowIso,
          resendEmailId: userEmailId,
          scheduledAt,
          status: "scheduled",
        },
      );
    }

    // `founderEmailHistory` is derived from the snapshot above, which is safe
    // because the outreach lock excludes the only other writer of that field.
    const authoredFields = {
      ...(hadMissingScope && !record.driveScopeRecoveredAt
        ? { driveScopeRecoveredAt: nowIso }
        : {}),
      founderEmailHistory,
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
      record: { ...record, ...authoredFields },
      scheduledAt,
    });
    // Write only the fields authored here: the sign-in callback may have
    // bumped counters or scope timestamps while these emails were in flight.
    await mergeUserRecord(writeKey, authoredFields);
  } finally {
    await releaseLock(context.userEmail);
  }
}
