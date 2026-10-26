/**
 * Remark plugins that dress up AI coach answers, all over the parsed markdown:
 *
 * - The lifter's own words quoted back from their notes are italicised.
 * - Sets (1@160kg, 3x5@100kg, 3x5, and the older 160×1) become chips.
 * - ==text== becomes a highlight, which the prompt reserves for real
 *   milestones.
 * - A date the lifter trained on ("October 12") links to that day in the log.
 * - The closing takeaway's "Takeaway:" label becomes one of a set of labels,
 *   so the card does not read the same at the end of every answer.
 *
 * Like the lift guide links, these are done here rather than asked of the
 * model wherever we can: exact, no tokens, and the same for every model. Only
 * the highlights need the model's help, because picking a milestone is
 * judgement. The takeaway card is a blockquote, styled in CSS.
 *
 * The classes they add are allowed through Streamdown's sanitiser by
 * CHAT_SANITIZE_SCHEMA and styled in globals.css (.sj-chat-*).
 */

import { defaultRehypePlugins } from "streamdown";

// Never format inside these: links, code, headings, or image alts.
const SKIPPED_NODE_TYPES = new Set([
  "link",
  "linkReference",
  "code",
  "inlineCode",
  "html",
  "definition",
  "heading",
  "image",
  "imageReference",
]);

/**
 * Runs `pattern` over every text node outside `skip`, replacing each match
 * with the node `build` returns for it (or leaving it when that is null).
 */
function replaceInText(tree, pattern, build, skip = SKIPPED_NODE_TYPES) {
  const visit = (node) => {
    if (!Array.isArray(node.children)) return;

    for (let index = 0; index < node.children.length; index += 1) {
      const child = node.children[index];
      if (skip.has(child.type)) continue;

      if (child.type !== "text") {
        visit(child);
        continue;
      }

      const replacement = [];
      let cursor = 0;
      for (const match of child.value.matchAll(pattern)) {
        const built = build(match);
        if (!built) continue;
        if (match.index > cursor) {
          replacement.push({
            type: "text",
            value: child.value.slice(cursor, match.index),
          });
        }
        replacement.push(built);
        cursor = match.index + match[0].length;
      }
      if (replacement.length === 0) continue;
      if (cursor < child.value.length) {
        replacement.push({ type: "text", value: child.value.slice(cursor) });
      }

      node.children.splice(index, 1, ...replacement);
      index += replacement.length - 1;
    }
  };
  visit(tree);
}

/** The plain text of a node and its children. */
function toString(node) {
  if (typeof node.value === "string") return node.value;
  return Array.isArray(node.children)
    ? node.children.map(toString).join("")
    : "";
}

/** A span with one class, which mdast-util-to-hast renders from `data`. */
function span(className, value) {
  return {
    type: "sjSpan",
    data: { hName: "span", hProperties: { className: [className] } },
    children: [{ type: "text", value }],
  };
}

// -----------------------------------------------------------------------------
// Quotes
// -----------------------------------------------------------------------------

// Conservative so inch marks never trip it: an opening quote must start the
// text or follow whitespace or an opening bracket, a closing quote must not be
// followed by a letter or digit, and the quoted text cannot start or end with
// a space or cross a line. Straight and curly quotes both count.
const QUOTE_PATTERN =
  /(?<=^|[\s([{])(["“])(?![\s"”])[^"“”\n]{1,400}?(?<!\s)["”](?![\p{L}\p{N}])/gu;

const QUOTE_SKIPPED_NODE_TYPES = new Set([...SKIPPED_NODE_TYPES, "emphasis"]);

export function remarkItalicQuotes() {
  return (tree) =>
    replaceInText(
      tree,
      QUOTE_PATTERN,
      (match) => ({
        type: "emphasis",
        data: { hProperties: { className: ["sj-chat-quote"] } },
        children: [{ type: "text", value: match[0] }],
      }),
      QUOTE_SKIPPED_NODE_TYPES,
    );
}

// -----------------------------------------------------------------------------
// Set chips
// -----------------------------------------------------------------------------

// Longest form first: 3x5@100kg, 1@160kg, then the older weight×reps (160×1,
// only with the real times sign, so "2x bodyweight" never matches) and bare
// sets×reps (3x5). Set and rep counts may be ranges (2-3x4@137.5kg). Digit
// counts are capped so a screen size never matches.
const SET =
  /(?:(?:\d{1,2}(?:-\d{1,2})?\s?[x×]\s?)?\d{1,3}(?:-\d{1,3})?\s?@\s?\d{1,4}(?:\.\d{1,2})?\s?(?:kg|lbs?)?|\d{1,4}(?:\.\d{1,2})?×\d{1,2}|\d{1,2}(?:-\d{1,2})?[x×]\d{1,2}(?:-\d{1,2})?)/;
const SET_PATTERN = new RegExp(
  String.raw`(?<![\p{L}\p{N}.@-])${SET.source}(?![\p{L}\p{N}@×-]|\.\d)`,
  "gu",
);
const WHOLE_SET_PATTERN = new RegExp(`^${SET.source}$`, "u");

/**
 * GFM reads a set with a decimal weight (1@162.5kg) as an email address and
 * links it. Turns those links back into text so they become chips instead.
 */
function unlinkSetsReadAsEmail(node) {
  if (!Array.isArray(node.children)) return;
  node.children = node.children.map((child) => {
    if (
      child.type === "link" &&
      child.url?.startsWith("mailto:") &&
      WHOLE_SET_PATTERN.test(toString(child))
    ) {
      return { type: "text", value: toString(child) };
    }
    unlinkSetsReadAsEmail(child);
    return child;
  });
}

export function remarkSetChips() {
  return (tree) => {
    unlinkSetsReadAsEmail(tree);
    replaceInText(tree, SET_PATTERN, (match) => span("sj-chat-set", match[0]));
  };
}

// -----------------------------------------------------------------------------
// Highlights
// -----------------------------------------------------------------------------

const HIGHLIGHT_PATTERN = /==(?![\s=])([^=\n]{1,200}?)(?<![\s=])==/g;

export function remarkHighlights() {
  return (tree) =>
    replaceInText(tree, HIGHLIGHT_PATTERN, (match) =>
      span("sj-chat-highlight", match[1]),
    );
}

// -----------------------------------------------------------------------------
// Session date links
// -----------------------------------------------------------------------------

const MONTHS = [
  "jan",
  "feb",
  "mar",
  "apr",
  "may",
  "jun",
  "jul",
  "aug",
  "sep",
  "oct",
  "nov",
  "dec",
];

// "October 12", "Oct 12", "Sept. 3rd", "October 12, 2021". The prompt asks for
// US-style dates with the year only for a previous year.
const DATE_PATTERN =
  /\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|June?|July?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\.? (\d{1,2})(?:st|nd|rd|th)?(?:,? (\d{4}))?(?![\p{L}\p{N}])/gu;

function pad(value) {
  return String(value).padStart(2, "0");
}

/**
 * The ISO date a written date means: its own year, or else the latest one
 * not after today, since the coach talks about training already done.
 */
function resolveDate(monthName, day, year, today) {
  const month = MONTHS.indexOf(monthName.slice(0, 3).toLowerCase()) + 1;
  if (month === 0 || day < 1 || day > 31) return null;
  if (year) return `${year}-${pad(month)}-${pad(day)}`;

  const thisYear = Number(today.slice(0, 4));
  const candidate = `${thisYear}-${pad(month)}-${pad(day)}`;
  return candidate <= today
    ? candidate
    : `${thisYear - 1}-${pad(month)}-${pad(day)}`;
}

/**
 * Links each date the lifter actually trained on to that day in /log.
 * Options: `sessionDates`, the logged ISO dates; `today`, the local ISO date.
 */
export function remarkSessionDateLinks({ sessionDates, today } = {}) {
  const dates = new Set(sessionDates ?? []);
  return (tree) => {
    if (dates.size === 0 || !today) return;
    replaceInText(tree, DATE_PATTERN, (match) => {
      const iso = resolveDate(match[1], Number(match[2]), match[3], today);
      if (!iso || !dates.has(iso)) return null;
      return {
        type: "link",
        url: iso === today ? "/log" : `/log?date=${iso}`,
        children: [{ type: "text", value: match[0] }],
      };
    });
  };
}

// -----------------------------------------------------------------------------
// Takeaway labels
// -----------------------------------------------------------------------------

// The prompt asks for a plain "Takeaway:" label; the reader sees one of these.
const TAKEAWAY_LABELS = [
  "The takeaway:",
  "Bottom line:",
  "Coach's note:",
  "What to remember:",
  "In short:",
  "The big picture:",
  "Where you stand:",
  "Carry this forward:",
  "From the coach:",
  "The short version:",
  "What this means:",
  "Worth holding onto:",
];

const TAKEAWAY_LABEL_PATTERN = /^\s*(?:the\s+)?takeaway\s*:?\s*$/i;

/**
 * Picks the label from everything written before the takeaway. The takeaway
 * comes last, so that text is settled by the time it streams in and the label
 * never flickers, while different answers still get different labels.
 */
function pickTakeawayLabel(seed) {
  let hash = 5381;
  for (let i = 0; i < seed.length; i += 1) {
    hash = ((hash << 5) + hash + seed.charCodeAt(i)) | 0;
  }
  hash = Math.imul(hash ^ (hash >>> 16), 0x45d9f3b);
  hash ^= hash >>> 16;
  return TAKEAWAY_LABELS[Math.abs(hash) % TAKEAWAY_LABELS.length];
}

export function remarkTakeawayLabels() {
  return (tree) => {
    tree.children.forEach((node, index) => {
      if (node.type !== "blockquote") return;
      const label = node.children[0]?.children?.[0];
      if (
        label?.type !== "strong" ||
        !TAKEAWAY_LABEL_PATTERN.test(toString(label))
      ) {
        return;
      }
      const seed = tree.children.slice(0, index).map(toString).join("\n");
      label.children = [{ type: "text", value: pickTakeawayLabel(seed) }];
    });
  };
}

// -----------------------------------------------------------------------------
// Sanitiser
// -----------------------------------------------------------------------------

const [sanitize, defaultSchema] = defaultRehypePlugins.sanitize;

const CHAT_SANITIZE_SCHEMA = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    span: [
      ...(defaultSchema.attributes?.span ?? []),
      ["className", "sj-chat-set", "sj-chat-highlight"],
    ],
    em: [
      ...(defaultSchema.attributes?.em ?? []),
      ["className", "sj-chat-quote"],
    ],
  },
};

/** Streamdown's own rehype plugins, with our classes allowed through. */
export const chatRehypePlugins = Object.values({
  ...defaultRehypePlugins,
  sanitize: [sanitize, CHAT_SANITIZE_SCHEMA],
});
