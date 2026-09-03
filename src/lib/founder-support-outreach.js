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

/**
 * Every recipient of these notes is a brand new lifter: outreach eligibility
 * requires an empty KV record at first sign-in, so nobody established ever
 * lands here. That means the middle of each message can do what the intro
 * dashboard does and name the two doors out of an empty log, rather than
 * assuming the reader already found them.
 *
 * The two doors, in the order the first-week dashboard offers them:
 *   1. Log a session. The big four each have their own block on /log.
 *   2. Bring an existing history in from another app and merge it.
 * There are two notes, not three: "smooth" and "recovered" share one, because
 * both readers finish with a sheet. The "stalled" reader has no sheet yet, so
 * their version of door 2 is the signed-out import preview, which is a real
 * destination rather than a consolation for declining Drive.
 *
 * Keep this short. The note is meant to earn a reply, not to be a tour.
 */
function buildUserEmail(user, outcome) {
  const sharedOpening = [
    getGreeting(user),
    "",
    "Thanks for signing into Strength Journeys recently.",
    "",
    "I'm Wayne, the person building it. I'm a garage gym lifter who started in CrossFit, but these days I mainly train the big four lifts, hopefully for the rest of my life.",
    "",
  ];
  // Only for readers who already have a sheet, so both doors are open to them.
  const signedInPathways = [
    "Two ways in from here, whichever suits you. To start logging, the big four lifts each have their own block on the log page: https://www.strengthjourneys.xyz/log",
    "",
    "Or if you already have training history in Hevy, Strong, StrongLifts, Wodify, BTWB or a spreadsheet, you can bring that file in and merge it into your sheet: https://www.strengthjourneys.xyz/import",
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
        "It looks like setup may have stopped at the Google Drive permission step. Strength Journeys can only access the one lifting Sheet it creates for you. It cannot see anything else in your Drive.",
        "",
        "You can also try the whole thing without signing in. Drop in an export from Hevy, Strong, StrongLifts, Wodify, BTWB or a spreadsheet, and your lifting history gets charted in your browser: https://www.strengthjourneys.xyz/import",
        "",
        "If you like what you see there, that same history can be saved into a Google Sheet you own whenever you are ready.",
        "",
        "Was it mainly a privacy concern, or did the Google setup simply not work?",
        ...sharedClosing,
      ].join("\n"),
    };
  }

  // "smooth" and "recovered" both end the same way: a sheet exists and both
  // doors are open, so they get the same note. Someone who missed the Drive
  // scope and then granted it has already solved that problem, and asking them
  // to relive it would spend the one question we get on friction they are past.
  // The outcomes still diverge everywhere else, including the [SJ] founder
  // notification and the Resend idempotency key.
  return {
    subject: "Quick question about Strength Journeys",
    text: [
      ...sharedOpening,
      ...signedInPathways,
      "What were you hoping Strength Journeys would help you see or do?",
      ...sharedClosing,
    ].join("\n"),
  };
}

// Wayne reads these, so they are in his time, not the server's. AEST and AEDT
// are picked up from the zone rather than hard-coded, so the daylight saving
// switch needs no attention here.
const FOUNDER_TIME_ZONE = "Australia/Melbourne";

/**
 * Absolute and readable.
 *
 * Deliberately not relative ("2 hours ago"). The "stalled" notification is
 * composed now and handed to Resend for delivery 24 to 72 hours later, so any
 * phrase measured against composition time would be wrong by the time it is
 * read. A gap between two timestamps that are both in the message is safe,
 * which is what `formatGap` is for.
 */
function formatStamp(isoString) {
  if (!isoString) return null;
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return null;

  return date.toLocaleString("en-AU", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: FOUNDER_TIME_ZONE,
    timeZoneName: "short",
  });
}

function formatGap(fromIso, toIso) {
  const from = new Date(fromIso).getTime();
  const to = new Date(toIso).getTime();
  if (!Number.isFinite(from) || !Number.isFinite(to) || to < from) return null;

  const minutes = Math.round((to - from) / 60000);
  if (minutes < 1) return "under a minute";
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"}`;

  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours} hour${hours === 1 ? "" : "s"}`;

  const days = Math.round(hours / 24);
  return `${days} days`;
}

/**
 * Plain-English names for the sign-in CTA slugs, so a subject line reads like a
 * sentence instead of like a log field. Keep in step with the `cta` props on
 * GoogleSignInButton and friends; an unmapped slug degrades to its own words
 * rather than disappearing, which is noisy enough to notice and fix.
 */
const SIGN_IN_SOURCE_LABELS = {
  "1000lb_club_preview_save": "the 1000lb Club calculator",
  ai_assistant: "the AI lifting assistant",
  demo_banner: "the demo mode banner",
  demo_toast: "a demo mode toast",
  getting_started_card: "the Getting Started card",
  hero: "the home page hero",
  how_strong_am_i: "the How Strong Am I page",
  import_overview: "the import walkthrough",
  lift_page_card: "a Big Four lift card",
  milestone: "a Long Game milestone",
  nav_avatar: "the nav avatar menu",
  preview_banner: "the preview banner",
  sentence: "a Long Game prompt",
  sheet_scope_repair: "the Drive scope repair panel",
  sign_in_invite: "the sign-in invite card",
  strength_levels_page: "a Strength Levels page",
  theme_chooser: "the theme chooser",
  today: "the Long Game today marker",
  week_in_iron_read_only_cta: "the Week in Iron card",
  year_recap_card: "the See Your Year card",
};

function describeCta(cta) {
  if (!cta) return null;
  return SIGN_IN_SOURCE_LABELS[cta] || cta.replaceAll("_", " ");
}

// Where they came in. The Drive decline rate varies a lot by CTA, so this is
// the one fact worth carrying up into the subject line rather than leaving it
// in a body that gets skimmed.
function describeEntry(record) {
  const label = describeCta(record.firstSignInCta);
  const page = record.firstSignInPage || null;
  if (label && page) return `${label} (${page})`;
  return label || page || null;
}

const FOUNDER_SUBJECT_OUTCOMES = {
  smooth: "is set up",
  recovered: "is set up after a Drive retry",
  stalled: "stopped at the Google Drive step",
};

const FOUNDER_SUMMARIES = {
  smooth: "New lifter. Granted Drive on the first ask and finished setup.",
  recovered:
    "New lifter. Missed the Drive scope at first, then granted it and finished setup.",
  stalled:
    "New lifter. Never granted the Drive scope, so no sheet was created for them.",
};

/**
 * The founder-facing `[SJ]` notification.
 *
 * `userNoteSubject` is the subject of the note the lifter will actually
 * receive, which is not always the note for `outcome`: when a stalled note has
 * already gone out, or a cancel failed and it is still queued, the stalled
 * wording is what lands. Callers pass what is really scheduled so this message
 * never claims a send that is not happening.
 *
 * `nudge` is a whole sentence written by the caller, not a flag. Anything that
 * needs doing by hand is said in the body in plain words with the thing to do
 * in it. It stays out of the subject line on purpose: a shouted prefix that
 * does not say what to do is worse than a calm sentence that does.
 */
function buildFounderEmail(
  user,
  outcome,
  record,
  scheduledAt = null,
  nudge = null,
  userNoteSubject = null,
) {
  const name = getFounderName(user);
  const identity =
    user?.email && name !== user.email ? `${name} <${user.email}>` : name;
  const entry = describeEntry(record);
  const subjectSource =
    describeCta(record.firstSignInCta) || record.firstSignInPage;
  const scopeGap =
    record.firstMissingDriveScopeAt && record.driveScopeRecoveredAt
      ? formatGap(record.firstMissingDriveScopeAt, record.driveScopeRecoveredAt)
      : null;

  const arrivedLine = record.firstSignInAt
    ? `Arrived ${formatStamp(record.firstSignInAt)}${entry ? ` from ${entry}` : ""}.`
    : entry
      ? `Arrived from ${entry}.`
      : null;

  // A second sign-in is the strongest early signal there is, so it gets its
  // own sentence rather than being folded into the arrival line.
  const returnLabel = describeCta(record.lastSignInCta);
  const signInLine =
    record.signInCount > 1
      ? `Signed in ${record.signInCount === 2 ? "twice" : `${record.signInCount} times`}${
          record.lastSignInAt
            ? `, most recently ${formatStamp(record.lastSignInAt)}${returnLabel ? ` from ${returnLabel}` : ""}`
            : ""
        }.`
      : record.signInCount
        ? "Signed in once, no return visit yet."
        : null;

  const sheetLine = record.provisionedSheetId
    ? `Sheet created for them${record.provisioningMethod ? ` (${record.provisioningMethod})` : ""}.`
    : "No sheet created for them yet.";

  const scopeLine = record.firstMissingDriveScopeAt
    ? record.driveScopeRecoveredAt
      ? `Drive scope missed at first, ${scopeGap ? `granted ${scopeGap} later` : `granted ${formatStamp(record.driveScopeRecoveredAt)}`}.`
      : "Drive scope missed at first and still not granted."
    : "Drive scope granted on the first ask.";

  return {
    subject: `[SJ] ${name} ${FOUNDER_SUBJECT_OUTCOMES[outcome]}${
      subjectSource ? `, from ${subjectSource}` : ""
    }`,
    text: [
      identity,
      FOUNDER_SUMMARIES[outcome],
      "",
      arrivedLine,
      signInLine,
      sheetLine,
      scopeLine,
      "",
      userNoteSubject && scheduledAt
        ? `Their note "${userNoteSubject}" is scheduled for ${formatStamp(scheduledAt)}. You are bcc'd on it and their replies come to you.`
        : scheduledAt
          ? `A note to them is scheduled for ${formatStamp(scheduledAt)}.`
          : null,
      outcome === "stalled"
        ? "Everything above was true when this was queued, a day or two before it reached you. They may have signed in again since."
        : null,
      nudge ? `\n${nudge}` : null,
    ]
      .filter((line) => line !== null)
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim(),
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
  const message = buildFounderEmail(
    user,
    "stalled",
    record,
    scheduledAt,
    null,
    buildUserEmail(user, "stalled").subject,
  );
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

async function sendFounderOutcome({
  context,
  user,
  outcome,
  record,
  scheduledAt,
  nudge = null,
  userNoteSubject = null,
}) {
  const message = buildFounderEmail(
    user,
    outcome,
    record,
    scheduledAt,
    nudge,
    userNoteSubject,
  );
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

    // Both calls are attempted even if the first fails, so a cancellable
    // founder email isn't left behind just because the user email cancel
    // errored (and vice versa).
    let stalledUserEmailCancelled = true;
    let stalledFounderEmailCancelled = true;
    if (!pendingEmailHasLikelySent) {
      stalledUserEmailCancelled = await cancelScheduledEmail(
        context.resend,
        record.supportStalledUserEmailId,
      );
      stalledFounderEmailCancelled = await cancelScheduledEmail(
        context.resend,
        record.supportStalledFounderEmailId,
      );
    }

    // A cancel that was actually attempted and came back with an error is
    // different from one skipped because the stalled email had likely
    // already gone out: here Resend still holds a live, wrongly-worded
    // "stalled" send, and treating that as resolved would tell the founder
    // everything is fine while the user is still about to get the wrong
    // email. This guards against a real incident: a send-only-restricted
    // Resend API key silently failed every cancel call, and the outcome was
    // finalized (with the only pointers to the stale email discarded)
    // regardless.
    const cancelFailed =
      !pendingEmailHasLikelySent &&
      (!stalledUserEmailCancelled || !stalledFounderEmailCancelled);

    const outcome = hadMissingScope ? "recovered" : "smooth";
    const scheduledAt = pendingEmailHasLikelySent
      ? record.supportUserOutreachScheduledFor
      : getScheduledAt(context.userEmail, now);
    let userEmailId = record.supportStalledUserEmailId || null;
    // Which note the lifter actually ends up receiving. It starts as whatever
    // is already queued (the stalled note, if there is one) and only becomes
    // this outcome's note once that note is genuinely scheduled below, so the
    // founder notification never announces a send that did not happen.
    let landingNoteOutcome = record.supportStalledUserEmailId
      ? "stalled"
      : null;
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
      landingNoteOutcome = outcome;
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
      supportUserOutreachSentOrScheduledAt:
        record.supportUserOutreachSentOrScheduledAt || nowIso,
      ...(cancelFailed
        ? // Deliberately leave supportOutcome/supportOutcomeAt and the
          // supportStalled*EmailId pointers untouched: the next sign-in or
          // activation event should retry the cancel rather than treating
          // this as resolved, and the stale IDs must survive so they stay
          // discoverable (in the founder warning email and in KV) until a
          // cancel actually succeeds.
          { supportPendingOutcome: outcome }
        : {
            supportOutcome: outcome,
            supportOutcomeAt: nowIso,
            supportPendingOutcome: null,
            supportStalledFounderEmailId: null,
            supportStalledUserEmailId: null,
            supportUserEmailId: userEmailId,
            supportUserOutreachScheduledFor: scheduledAt,
          }),
    };

    // Written as the sentence it will be read as, with the ids needed to act on
    // it. The old version led with "WARNING" and then made the reader work out
    // what had gone wrong and what to do about it.
    const stuckEmailIds = [
      stalledUserEmailCancelled ? null : record.supportStalledUserEmailId,
      stalledFounderEmailCancelled ? null : record.supportStalledFounderEmailId,
    ].filter(Boolean);
    const nudge = cancelFailed
      ? `Worth two minutes when you get a chance. The stalled note could not be cancelled, so ${getFirstName(user) || "they"} may still receive "${buildUserEmail(user, "stalled").subject}" around ${formatStamp(record.supportUserOutreachScheduledFor) || "its original time"}, which now reads wrong. Cancel ${stuckEmailIds.join(" and ") || "it"} in the Resend dashboard.`
      : null;

    await sendFounderOutcome({
      context,
      user,
      outcome,
      record: { ...record, ...authoredFields },
      scheduledAt,
      nudge,
      userNoteSubject: landingNoteOutcome
        ? buildUserEmail(user, landingNoteOutcome).subject
        : null,
    });
    // Write only the fields authored here: the sign-in callback may have
    // bumped counters or scope timestamps while these emails were in flight.
    await mergeUserRecord(writeKey, authoredFields);
  } finally {
    await releaseLock(context.userEmail);
  }
}
