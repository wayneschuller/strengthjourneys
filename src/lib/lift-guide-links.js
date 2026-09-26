/**
 * Remark plugin that hyperlinks the first mention of each lift that has a
 * progress guide in assistant answers: every curated lift in the registry,
 * plus the lifter's own logged lifts, which get a guide page of their own.
 *
 * We used to ask the model to emit these links itself. It did so unreliably —
 * measured at roughly a 50% violation rate, either repeating a lift's link or
 * linking one lift in a list and leaving the rest as plain text. Doing it over
 * the parsed markdown instead is exact, costs no tokens, and works the same
 * whichever model is behind the chat.
 *
 * Matching is deliberately conservative. Names come from the registry's
 * liftType and synonyms, but a single-word name only matches when it is an
 * acronym (RDL), because "Press" or "Row" alone is usually part of something
 * else. The Big Four keep hand-tuned patterns: "Bench" and "Press" alone only
 * match as a label or in a lifting phrase, since "bench" is usually the
 * furniture, and "squat" is skipped when it names a rack or a variation we
 * have no guide for. Under-linking is much cheaper than
 * sending a reader to the wrong guide.
 *
 * Every lift's mentions claim their text even after its one link is used, so
 * a second "front squat" never has its "squat" linked to the back squat.
 */

import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import {
  CURATED_LIFTS,
  getCuratedLift,
  getLiftGuidePath,
} from "@/lib/lifts/lift-registry";

// Variations with no guide of their own, which would otherwise read as the
// Big Four lift they end with ("goblet squat", "trap bar deadlift").
const NOT_THE_BARBELL_LIFT =
  "(?<!\\b(?:dumbbell|kettlebell|smith(?: machine)?|machine|landmine|cable)[\\s-])";

const BIG_FOUR_PATTERNS = {
  "Back Squat": new RegExp(
    `\\bback squats?\\b|${NOT_THE_BARBELL_LIFT}(?<!\\b(?:goblet|split|hack|zercher|jump|air|bodyweight|sissy|pistol|belt|cossack|leg)[\\s-])\\bsquats?\\b(?!\\s+(?:rack|stand|cage|bar))`,
    "gi",
  ),
  "Bench Press": new RegExp(
    `${NOT_THE_BARBELL_LIFT}(?<!\\bdecline[\\s-])\\bbench press(?:es)?\\b`,
    "gi",
  ),
  Deadlift: new RegExp(
    `${NOT_THE_BARBELL_LIFT}(?<!\\b(?:stiff[\\s-]legg?e?d?|trap[\\s-]bar|hex[\\s-]bar|single[\\s-]leg|snatch[\\s-]grip)[\\s-])\\bdeadlifts?\\b`,
    "gi",
  ),
  "Strict Press": new RegExp(
    `\\bstrict press(?:es)?\\b|${NOT_THE_BARBELL_LIFT}(?<!\\bseated[\\s-])\\boverhead press(?:es)?\\b|\\bOHP\\b`,
    "gi",
  ),
};

// Bare "Bench" and "Press" usually mean furniture or part of another lift, so
// they only count where the name is clearly the lift: a label at the start of
// a line ("Bench: 136 for one"), the whole of a bold or table-cell label, or a
// phrase no piece of equipment is in ("your bench", "bench PR"). The whole-node
// labels are only tried when the walker says the text is a whole label.
const LABEL_PATTERNS = {
  "Bench Press": [
    /(?<![^\n])Bench(?=\s*:)/g,
    /(?<=\b(?:[Yy]our|[Mm]y|[Oo]n) )bench\b(?!\s+(?:is|was|that|pad|height))/g,
    /\bbench(?=\s+(?:PRs?|1RMs?|e1RMs?|max(?:es)?|numbers?|sessions?|days?|volume|singles?|doubles?|triples?|work|strength|progress|standards?)\b)/gi,
  ],
  "Strict Press": [
    /(?<![^\n])Press(?=\s*:)/g,
    /(?<=\b(?:[Yy]our|[Mm]y) )press\b(?!\s+(?:the|it|down|up|through|on))/g,
  ],
};
const WHOLE_LABEL_PATTERNS = {
  "Bench Press": [/^\s*Bench(?=\s*:?\s*$)/gi],
  "Strict Press": [/^\s*Press(?=\s*:?\s*$)/gi],
};
// Parents whose single text child is a label: **Bench:**, a table cell.
const LABEL_PARENT_TYPES = new Set(["strong", "emphasis", "tableCell"]);

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Patterns for a lift's names: multi-word names in any case, allowing
 * "close grip" or "close-grip" and a plural; single-word names only as a
 * case-sensitive acronym.
 */
function buildPatterns(names) {
  const phrases = [];
  const acronyms = [];

  for (const name of names) {
    const words = String(name)
      .trim()
      .split(/[\s-]+/)
      .filter(Boolean);
    if (words.length > 1) {
      phrases.push(words.map(escapeRegExp).join("[\\s-]+"));
    } else if (/^[A-Z]{2,5}$/.test(words[0] ?? "")) {
      acronyms.push(escapeRegExp(words[0]));
    }
  }

  const patterns = [];
  if (phrases.length > 0) {
    patterns.push(new RegExp(`\\b(?:${phrases.join("|")})(?:es|s)?\\b`, "gi"));
  }
  if (acronyms.length > 0) {
    patterns.push(new RegExp(`\\b(?:${acronyms.join("|")})s?\\b`, "g"));
  }
  return patterns;
}

const CURATED_LINKS = CURATED_LIFTS.filter((lift) => lift.slug).map((lift) => ({
  href: `/progress-guide/${lift.slug}`,
  patterns: BIG_FOUR_PATTERNS[lift.liftType]
    ? [
        BIG_FOUR_PATTERNS[lift.liftType],
        ...(LABEL_PATTERNS[lift.liftType] ?? []),
      ]
    : buildPatterns([
        lift.liftType,
        ...(Array.isArray(lift.synonyms) ? lift.synonyms : []),
      ]),
  wholeLabelPatterns: WHOLE_LABEL_PATTERNS[lift.liftType] ?? [],
}));

/**
 * The curated lifts plus any logged lift the registry does not know, each of
 * which has an uncurated guide page of its own.
 */
function getLiftLinks(liftTypes) {
  if (!Array.isArray(liftTypes) || liftTypes.length === 0) return CURATED_LINKS;

  const logged = [];
  for (const entry of liftTypes) {
    const liftType = typeof entry === "string" ? entry : entry?.liftType;
    if (!liftType || getCuratedLift(liftType)) continue;
    const patterns = buildPatterns([liftType]);
    const href = getLiftGuidePath(liftType);
    if (patterns.length > 0 && href) logged.push({ href, patterns });
  }
  return logged.length > 0 ? [...CURATED_LINKS, ...logged] : CURATED_LINKS;
}

// Never linkify inside these: existing links, code, headings, or image alts.
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

function findEarliestMatch(value, from, links, isWholeLabel) {
  let best = null;

  for (const link of links) {
    const patterns =
      isWholeLabel && link.wholeLabelPatterns?.length
        ? [...link.patterns, ...link.wholeLabelPatterns]
        : link.patterns;
    for (const pattern of patterns) {
      pattern.lastIndex = from;
      const match = pattern.exec(value);
      if (!match) continue;

      // Earliest wins; on a tie prefer the longer name ("Back Squat" over "Squat").
      if (
        !best ||
        match.index < best.index ||
        (match.index === best.index && match[0].length > best.text.length)
      ) {
        best = { link, index: match.index, text: match[0] };
      }
    }
  }

  return best;
}

/**
 * Finds each lift's first mention in one text node, in order, consuming it from
 * `remaining` so a lift is only ever linked once per message. Mentions of a
 * lift already linked are still claimed, so they are never read as a shorter
 * name inside them.
 */
function collectMatches(value, links, remaining, isWholeLabel = false) {
  const matches = [];
  let cursor = 0;

  while (cursor < value.length && remaining.size > 0) {
    const hit = findEarliestMatch(value, cursor, links, isWholeLabel);
    if (!hit) break;

    const end = hit.index + hit.text.length;
    if (remaining.has(hit.link.href)) {
      matches.push({ link: hit.link, start: hit.index, end, text: hit.text });
      remaining.delete(hit.link.href);
    }
    cursor = Math.max(end, cursor + 1);
  }

  return matches;
}

/** Rewrites a text node into text/link/text nodes. Used by the remark plugin. */
function linkifyTextNode(node, links, remaining, isWholeLabel) {
  const matches = collectMatches(node.value, links, remaining, isWholeLabel);
  if (matches.length === 0) return null;

  const replacement = [];
  let cursor = 0;

  for (const match of matches) {
    if (match.start > cursor) {
      replacement.push({
        type: "text",
        value: node.value.slice(cursor, match.start),
      });
    }
    replacement.push({
      type: "link",
      url: match.link.href,
      children: [{ type: "text", value: match.text }],
    });
    cursor = match.end;
  }

  if (cursor < node.value.length) {
    replacement.push({ type: "text", value: node.value.slice(cursor) });
  }

  return replacement;
}

/**
 * Drops any lift the message already links itself. Without this a
 * model-generated link would not consume the lift and we would add a second
 * link for it - the exact duplication this module exists to prevent.
 */
function excludeAlreadyLinked(node, remaining) {
  if (node.type === "link" && typeof node.url === "string") {
    remaining.delete(node.url);
  }

  if (!Array.isArray(node.children)) return;
  for (const child of node.children) excludeAlreadyLinked(child, remaining);
}

function walk(node, links, remaining, linkify = linkifyTextNode) {
  if (!Array.isArray(node.children)) return;

  for (let index = 0; index < node.children.length; index += 1) {
    if (remaining.size === 0) return;

    const child = node.children[index];
    if (SKIPPED_NODE_TYPES.has(child.type)) continue;

    if (child.type !== "text") {
      walk(child, links, remaining, linkify);
      continue;
    }

    const isWholeLabel =
      node.children.length === 1 && LABEL_PARENT_TYPES.has(node.type);
    const replacement = linkify(child, links, remaining, isWholeLabel);
    if (replacement) {
      node.children.splice(index, 1, ...replacement);
      index += replacement.length - 1;
    }
  }
}

/**
 * Remark plugin. Each message is linked independently, once per lift.
 * Options: `liftTypes`, the lifter's logged lifts (names or liftTypes rows).
 */
export function remarkLiftGuideLinks({ liftTypes } = {}) {
  const links = getLiftLinks(liftTypes);
  return (tree) => {
    const remaining = new Set(links.map((link) => link.href));
    excludeAlreadyLinked(tree, remaining);
    walk(tree, links, remaining);
  };
}

/**
 * Returns `markdown` with the same links the renderer would add, for the
 * "Download chat" export.
 *
 * Rather than re-serialising the tree (which would reformat the user's whole
 * transcript), this parses to find match positions and splices the link syntax
 * into the original string, so every other byte is preserved exactly.
 */
export function linkifyLiftGuideMarkdown(markdown, { liftTypes } = {}) {
  if (typeof markdown !== "string" || !markdown.trim()) return markdown;

  const tree = unified().use(remarkParse).use(remarkGfm).parse(markdown);
  const links = getLiftLinks(liftTypes);
  const remaining = new Set(links.map((link) => link.href));
  excludeAlreadyLinked(tree, remaining);

  const edits = [];

  walk(tree, links, remaining, (node, _links, stillRemaining, isWholeLabel) => {
    const start = node.position?.start?.offset;
    const end = node.position?.end?.offset;
    if (typeof start !== "number" || typeof end !== "number") return null;

    // A node's value diverges from its source text wherever markdown escapes
    // or character references were resolved ("\\*squat\\*" -> "*squat*"), so
    // offsets within the value cannot be trusted. Locate each match in the
    // source slice instead, advancing a cursor to keep matches in order. A
    // match whose own text was escaped simply will not be found, and is
    // skipped rather than spliced into the wrong place.
    const source = markdown.slice(start, end);
    let cursor = 0;

    for (const match of collectMatches(
      node.value,
      links,
      stillRemaining,
      isWholeLabel,
    )) {
      const found = source.indexOf(match.text, cursor);
      if (found === -1) continue;

      edits.push({
        start: start + found,
        end: start + found + match.text.length,
        text: match.text,
        href: match.link.href,
      });
      cursor = found + match.text.length;
    }

    return null;
  });

  // Apply back to front so earlier offsets stay valid.
  return edits
    .sort((a, b) => b.start - a.start)
    .reduce(
      (text, edit) =>
        `${text.slice(0, edit.start)}[${edit.text}](${edit.href})${text.slice(edit.end)}`,
      markdown,
    );
}
