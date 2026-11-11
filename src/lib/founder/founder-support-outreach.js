/**
 * Turns noisy onboarding events into one founder notification and one delayed,
 * reply-first note to the lifter. Resend owns the delay so this flow needs no
 * cron job and no queue worker.
 *
 * ONE note goes to the lifter, whatever happens during setup. An earlier design
 * had a separate "you seem to have stopped at the Drive step" note, which meant
 * committing to that wording at sign-in, days before the outcome was known, and
 * then reaching back to cancel it if the person carried on. When a restricted
 * API key silently broke every cancel, lifters who were fully set up received a
 * note telling them setup had failed. Nothing is scheduled in advance that can
 * become untrue, so there is nothing to cancel and no queue to police.
 *
 * The single note works for a reader with a sheet and for one without: it names
 * the log page and the import page, and says the history ends up in a Google
 * Sheet they own that the app never reads beyond. For anyone who skipped the
 * Drive permission, that is the invitation to grant it, offered as something
 * worth having rather than as a failure to correct.
 *
 * The founder gets `[SJ]` notifications immediately, as things happen, plus a
 * bcc of the note itself when it lands. See `DEFAULT_DISABLED_EVENTS` in
 * "@/lib/founder/founder-notifications" for the legacy per-step emails this superseded.
 */

import { Resend } from "resend";

import { kv } from "@/lib/kv";
import { isLeaderboardAdminEmail } from "@/lib/playlists/playlist-security";
import { mergeUserRecord, readUserRecord } from "@/lib/user-kv-keys";

const FROM_EMAIL = "Strength Journeys <feedback@updates.strengthjourneys.xyz>";
// The note to the lifter is a question from a person, so it comes from one. A
// brand name in the inbox reads as an app notification, and the manual version
// of this note, sent from Wayne's own Gmail, drew replies where the branded one
// drew none. Any address on the verified sending domain works, and replies go
// to `replyTo`, so this mailbox never needs to exist.
const USER_NOTE_FROM_EMAIL =
  "Wayne Schuller <wayne@updates.strengthjourneys.xyz>";
// The note lands the morning after the day the lifter signed in, US time, so
// "yesterday" in the note is true. The old rule was "24 to 72 hours later" at
// whatever minute that fell on, which put over a third of notes in an inbox
// overnight, under the morning pile. Most lifters are in the US, so a Central
// morning is a sensible morning for nearly all of them. Even a sign-in just
// before midnight has a night in between, so it never reads like a receipt.
const SEND_TIME_ZONE = "America/Chicago";
const SEND_WINDOW_START_MINUTES = 8 * 60 + 30;
const SEND_WINDOW_MINUTES = 120;
const SUPPORT_LOCK_SECONDS = 30;
// How close to the "signed in without the Drive scope" notification a recovery
// has to be before the follow-up is not worth a second email. Most recoveries
// that happen at all happen inside a minute, so this mostly catches someone
// tapping through the consent screen twice.
const QUICK_RECOVERY_MS = 5 * 60 * 1000;
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

function hashEmail(email) {
  let hash = 0;
  for (const character of normalizeEmail(email)) {
    hash = (hash * 31 + character.codePointAt(0)) >>> 0;
  }
  return hash;
}

// The wall-clock date and time in `timeZone` at `date`, as numbers.
function getZonedParts(date, timeZone) {
  const parts = {};
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
  });
  for (const { type, value } of formatter.formatToParts(date)) {
    parts[type] = Number(value);
  }
  return parts;
}

// Minutes `timeZone` is ahead of UTC at `date` (negative for the Americas).
function getOffsetMinutes(date, timeZone) {
  const wall = getZonedParts(date, timeZone);
  const wallAsUtc = Date.UTC(
    wall.year,
    wall.month - 1,
    wall.day,
    wall.hour,
    wall.minute,
  );
  const instant = Math.floor(date.getTime() / 60000) * 60000;
  return Math.round((wallAsUtc - instant) / 60000);
}

// The instant a wall clock in `timeZone` reads `minutesIntoDay` on the given
// date. Day overflow is fine: Date.UTC rolls day 32 into the next month.
function getZonedInstant({ year, month, day }, minutesIntoDay, timeZone) {
  const wallAsUtc = Date.UTC(year, month - 1, day, 0, minutesIntoDay);
  const firstGuess =
    wallAsUtc - getOffsetMinutes(new Date(wallAsUtc), timeZone) * 60000;
  // Read the offset again at the answer, so a date on the far side of a
  // daylight saving switch uses that side's offset.
  return new Date(
    wallAsUtc - getOffsetMinutes(new Date(firstGuess), timeZone) * 60000,
  );
}

/**
 * The send-window slot on the calendar day after `now`, in `SEND_TIME_ZONE`.
 * Each lifter gets a fixed minute inside the window from a hash of their
 * address, so notes do not all leave on the same tick and a retry lands on the
 * same slot.
 */
function getScheduledAt(email, now = new Date()) {
  const minutesIntoDay =
    SEND_WINDOW_START_MINUTES + (hashEmail(email) % SEND_WINDOW_MINUTES);
  const today = getZonedParts(now, SEND_TIME_ZONE);
  return getZonedInstant(
    { ...today, day: today.day + 1 },
    minutesIntoDay,
    SEND_TIME_ZONE,
  ).toISOString();
}

function isWhitespace(character) {
  return (
    character === " " ||
    character === "\t" ||
    character === "\n" ||
    character === "\r"
  );
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
const NON_NAME_ASCII = '0123456789!"#$%&()*+,./:;<=>?@[\\]^_`{|}~';
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
 * check, not sanitisation. The note is plain text, so nothing is rendered
 * from the name. The aim is simply to fall back to "Hi there," when a
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

/**
 * The one note a new lifter receives, the morning after signing in.
 *
 * Its only job is to earn a reply. The longer version (about 250 words, an
 * import and logging tour, HTML with links) drew 0 replies from about 75 sends
 * between Aug and Nov 2026, and Gmail filed roughly 40% of the copies Wayne
 * received under Promotions. Wayne's manual notes, short and personal, had
 * drawn 5 to 8%. Onboarding belongs in the app, not here.
 *
 * Plain text, no HTML part, so it reads as a person writing. The only links
 * are the signature: the site, and Wayne's Instagram as a point of connection.
 *
 * The question offers help rather than asking the lifter to judge the app,
 * and "one thing" caps the effort so a reply feels finishable.
 *
 * Keep it short. If it grows past a few lines it is a tour again.
 */
function buildUserEmail(user) {
  return {
    subject: "Quick question about Strength Journeys",
    text: [
      getGreeting(user),
      "",
      "Wayne here. I build Strength Journeys on my own, from my garage gym.",
      "",
      "Thanks for signing in yesterday. What's one thing I could improve for you?",
      "",
      "Even a one line reply helps. I read every one.",
      "",
      "Thanks,",
      "Wayne",
      "https://www.strengthjourneys.xyz/",
      "https://www.instagram.com/wayneschuller/",
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
 * Deliberately not relative ("2 hours ago"). The note to the lifter is composed
 * now and handed to Resend for delivery up to a day and a half later, so any
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
  log_lift_gallery: "the log's lift gallery",
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
// in a body that gets skimmed. The plain name reads first and the path follows
// in brackets, so the sentence scans and the exact URL is still there to act on.
function describeEntry(record) {
  const label = describeCta(record.firstSignInCta);
  const page = record.firstSignInPage || null;
  if (label) return page ? `${label} [${page}]` : label;
  return page ? `[${page}]` : null;
}

// Stated as what happened, not as a verdict on it. "awaiting_scope" is a
// lifter who signed in and did not grant drive.file, which by implication means
// no sheet was bootstrapped for them. They still have a working dashboard, the
// demo log and the import preview, so there is nothing here to call a failure.
const FOUNDER_SUBJECT_OUTCOMES = {
  smooth: "is set up",
  recovered: "is set up, Drive granted on a later try",
  awaiting_scope: "signed in without the Drive scope",
};

const FOUNDER_SUMMARIES = {
  smooth: "New lifter. Granted Drive on the first ask and finished setup.",
  recovered:
    "New lifter. Did not grant Drive on the first ask, granted it later and finished setup.",
  awaiting_scope:
    "New lifter. Signed in without the drive.file scope, so no sheet was bootstrapped. The dashboard, the demo log and the import preview all still work for them.",
};

/**
 * The founder-facing `[SJ]` notification, sent immediately as each thing
 * happens. A lifter who signs in without the scope and later grants it produces
 * two of these, which is the story worth telling: they arrived, then they came
 * back and finished.
 *
 * `userNoteSubject` is passed only once the note to the lifter is actually
 * scheduled, so this message never announces a send that did not happen.
 */
function buildFounderEmail(
  user,
  outcome,
  record,
  scheduledAt = null,
  userNoteSubject = null,
) {
  const name = getFounderName(user);
  const identity =
    user?.email && name !== user.email ? `${name} (${user.email})` : name;
  const entry = describeEntry(record);
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

  // Said as of now, because this goes out as it happens. "Not granted at this
  // sign-in" is a fact; "still not granted" would be a verdict on someone who
  // may well grant it an hour from now.
  const scopeLine = record.firstMissingDriveScopeAt
    ? record.driveScopeRecoveredAt
      ? `Drive scope not granted at first, ${scopeGap ? `granted ${scopeGap} later` : `granted ${formatStamp(record.driveScopeRecoveredAt)}`}.`
      : "Drive scope not granted at this sign-in."
    : "Drive scope granted on the first ask.";

  return {
    // The full address rides in the subject so a search for someone's email
    // finds the notification as well as the thread it started.
    subject: `[SJ] ${identity} ${FOUNDER_SUBJECT_OUTCOMES[outcome]}${
      entry ? `, from ${entry}` : ""
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
  if (process.env.NEXT_PUBLIC_STRENGTH_JOURNEYS_ENV === "development")
    return null;
  if (
    process.env.ENABLE_AUTOMATED_FOUNDER_OUTREACH?.trim().toLowerCase() ===
    "false"
  ) {
    return null;
  }
  if (userEmail === founderEmail || isLeaderboardAdminEmail(userEmail))
    return null;

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
    throw new Error(
      error?.message || "Resend did not return a scheduled email ID",
    );
  }
  return data.id;
}

async function sendEmail(resend, payload, idempotencyKey) {
  const { error } = await resend.emails.send(payload, { idempotencyKey });
  if (error) throw new Error(error.message || "Resend failed to send email");
}

async function scheduleUserNote({ context, user, scheduledAt }) {
  const message = buildUserEmail(user);
  return scheduleEmail(
    context.resend,
    {
      bcc: context.founderEmail,
      from: USER_NOTE_FROM_EMAIL,
      to: context.userEmail,
      replyTo: context.founderEmail,
      subject: message.subject,
      text: message.text,
      scheduledAt,
    },
    // One note per lifter, so the key carries no outcome. Two racing events
    // cannot produce two notes even if both get past the lock.
    `founder-support/user/${context.userEmail}`,
  );
}

async function sendFounderOutcome({
  context,
  user,
  outcome,
  record,
  scheduledAt = null,
  userNoteSubject = null,
}) {
  const message = buildFounderEmail(
    user,
    outcome,
    record,
    scheduledAt,
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

/**
 * Schedules the one note to the lifter, if it is not already on its way.
 *
 * Returns the subject the lifter will receive, or null when nothing was
 * scheduled here, so the founder notification only mentions a send that is
 * really happening.
 */
async function ensureUserNoteScheduled({
  context,
  user,
  record,
  writeKey,
  now,
}) {
  if (record.supportUserNoteEmailId) return null;

  const scheduledAt = getScheduledAt(context.userEmail, now);
  const message = buildUserEmail(user);
  const emailId = await scheduleUserNote({ context, user, scheduledAt });

  // Append onto the freshest history so anything a concurrent request added
  // survives. The outreach lock excludes the only other writer of this field,
  // but the read happened before the network call above.
  await mergeUserRecord(writeKey, (latest) => ({
    founderEmailHistory: appendFounderEmailHistory(latest, {
      category: "founder_support",
      recordedAt: now.toISOString(),
      resendEmailId: emailId,
      scheduledAt,
      status: "scheduled",
    }),
    supportUserNoteEmailId: emailId,
    supportUserNoteScheduledFor: scheduledAt,
  }));

  return { scheduledAt, subject: message.subject };
}

/**
 * A new lifter signed in without granting drive.file, so no sheet was
 * bootstrapped for them.
 *
 * Both the founder notification and the note to the lifter happen here and now.
 * Nothing is held back waiting to see whether they come good, because the note
 * says the same thing either way and the notification is a statement about this
 * moment rather than a verdict on how it ends.
 */
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
      record.supportSignInNotifiedAt
    ) {
      return;
    }

    const now = new Date();
    const nowIso = now.toISOString();
    const authoredFields = {
      firstMissingDriveScopeAt: record.firstMissingDriveScopeAt || nowIso,
      supportSignInNotifiedAt: nowIso,
    };

    const note = await ensureUserNoteScheduled({
      context,
      user,
      record,
      writeKey,
      now,
    });

    await sendFounderOutcome({
      context,
      user,
      outcome: "awaiting_scope",
      record: { ...record, ...authoredFields },
      scheduledAt: note?.scheduledAt ?? record.supportUserNoteScheduledFor,
      userNoteSubject: note?.subject ?? null,
    });
    await mergeUserRecord(writeKey, authoredFields);
  } finally {
    await releaseLock(context.userEmail);
  }
}

/**
 * A new lifter finished setup and has a sheet.
 *
 * `supportOutcomeAt` closes the record: this is the last notification either of
 * them gets from this flow.
 */
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
    const outcome = hadMissingScope ? "recovered" : "smooth";

    // Someone who grants the scope a minute after skipping it would otherwise
    // produce two notifications about the same minute of their life. The first
    // has already been sent, so the second is the one held back. The outcome is
    // still written to the record, so a later scan of KV sees the real ending
    // even though no email was sent about it.
    const signInNotifiedMs = record.supportSignInNotifiedAt
      ? new Date(record.supportSignInNotifiedAt).getTime()
      : null;
    const isQuickRecovery =
      Number.isFinite(signInNotifiedMs) &&
      now.getTime() - signInNotifiedMs < QUICK_RECOVERY_MS;

    const note = await ensureUserNoteScheduled({
      context,
      user,
      record,
      writeKey,
      now,
    });
    const scheduledAt = note?.scheduledAt ?? record.supportUserNoteScheduledFor;

    const authoredFields = {
      ...(hadMissingScope && !record.driveScopeRecoveredAt
        ? { driveScopeRecoveredAt: nowIso }
        : {}),
      supportOutcome: outcome,
      supportOutcomeAt: nowIso,
      supportOutcomeNotifiedAt: isQuickRecovery ? null : nowIso,
      supportUserNoteScheduledFor: scheduledAt || null,
    };

    if (!isQuickRecovery) {
      await sendFounderOutcome({
        context,
        user,
        outcome,
        record: { ...record, ...authoredFields },
        scheduledAt,
        userNoteSubject: note?.subject ?? null,
      });
    }
    // Write only the fields authored here: the sign-in callback may have
    // bumped counters or scope timestamps while these emails were in flight.
    await mergeUserRecord(writeKey, authoredFields);
  } finally {
    await releaseLock(context.userEmail);
  }
}
