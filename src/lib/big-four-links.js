/**
 * Remark plugin that hyperlinks the first mention of each Big Four lift in
 * assistant answers.
 *
 * We used to ask the model to emit these links itself. It did so unreliably —
 * measured at roughly a 50% violation rate, either repeating a lift's link or
 * linking one lift in a list and leaving the rest as plain text. Doing it over
 * the parsed markdown instead is exact, costs no tokens, and works the same
 * whichever model is behind the chat.
 *
 * Matching is deliberately conservative: it only fires on unambiguous names of
 * the lift itself. "Bench" alone is not matched because it is usually the
 * furniture ("a flat bench that doesn't wobble"), and "squat" is skipped when
 * it is naming a rack. Under-linking is much cheaper than sending a reader to
 * a progress guide from a sentence about equipment.
 */

import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";

const BIG_FOUR = [
  {
    id: "squat",
    href: "/progress-guide/squat",
    // Not "squat rack" / "squat stand" / "squat cage" - that is equipment.
    pattern: /\bback squats?\b|\bsquats?\b(?!\s+(?:rack|stand|cage|bar))/i,
  },
  {
    id: "bench-press",
    href: "/progress-guide/bench-press",
    pattern: /\bbench press(?:es)?\b/i,
  },
  {
    id: "deadlift",
    href: "/progress-guide/deadlift",
    pattern: /\bdeadlifts?\b/i,
  },
  {
    id: "strict-press",
    href: "/progress-guide/strict-press",
    pattern: /\bstrict press(?:es)?\b|\boverhead press(?:es)?\b|\bOHP\b/i,
  },
];

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

function findEarliestMatch(value, remaining) {
  let best = null;

  for (const lift of remaining) {
    const match = lift.pattern.exec(value);
    if (!match) continue;

    // Earliest wins; on a tie prefer the longer name ("Back Squat" over "Squat").
    if (
      !best ||
      match.index < best.index ||
      (match.index === best.index && match[0].length > best.text.length)
    ) {
      best = { lift, index: match.index, text: match[0] };
    }
  }

  return best;
}

/**
 * Finds each lift's first mention in one text node, in order, consuming it from
 * `remaining` so a lift is only ever linked once per message.
 */
function collectMatches(value, remaining) {
  const matches = [];
  let offset = 0;
  let rest = value;

  while (rest && remaining.length > 0) {
    const hit = findEarliestMatch(rest, remaining);
    if (!hit) break;

    matches.push({
      lift: hit.lift,
      start: offset + hit.index,
      end: offset + hit.index + hit.text.length,
      text: hit.text,
    });

    offset += hit.index + hit.text.length;
    rest = rest.slice(hit.index + hit.text.length);
    remaining.splice(remaining.indexOf(hit.lift), 1);
  }

  return matches;
}

/** Rewrites a text node into text/link/text nodes. Used by the remark plugin. */
function linkifyTextNode(node, remaining) {
  const matches = collectMatches(node.value, remaining);
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
      url: match.lift.href,
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
    const linked = remaining.findIndex((lift) => lift.href === node.url);
    if (linked !== -1) remaining.splice(linked, 1);
  }

  if (!Array.isArray(node.children)) return;
  for (const child of node.children) excludeAlreadyLinked(child, remaining);
}

function walk(node, remaining, linkify = linkifyTextNode) {
  if (!Array.isArray(node.children)) return;

  for (let index = 0; index < node.children.length; index += 1) {
    if (remaining.length === 0) return;

    const child = node.children[index];
    if (SKIPPED_NODE_TYPES.has(child.type)) continue;

    if (child.type !== "text") {
      walk(child, remaining, linkify);
      continue;
    }

    const replacement = linkify(child, remaining);
    if (replacement) {
      node.children.splice(index, 1, ...replacement);
      index += replacement.length - 1;
    }
  }
}

/** Remark plugin. Each message is linked independently, once per lift. */
export function remarkBigFourLinks() {
  return (tree) => {
    const remaining = [...BIG_FOUR];
    excludeAlreadyLinked(tree, remaining);
    walk(tree, remaining);
  };
}

export const BIG_FOUR_REMARK_PLUGINS = [remarkBigFourLinks];

/**
 * Returns `markdown` with the same links the renderer would add, for the
 * "Download chat" export.
 *
 * Rather than re-serialising the tree (which would reformat the user's whole
 * transcript), this parses to find match positions and splices the link syntax
 * into the original string, so every other byte is preserved exactly.
 */
export function linkifyBigFourMarkdown(markdown) {
  if (typeof markdown !== "string" || !markdown.trim()) return markdown;

  const tree = unified().use(remarkParse).use(remarkGfm).parse(markdown);
  const remaining = [...BIG_FOUR];
  excludeAlreadyLinked(tree, remaining);

  const edits = [];

  walk(tree, remaining, (node, stillRemaining) => {
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

    for (const match of collectMatches(node.value, stillRemaining)) {
      const found = source.indexOf(match.text, cursor);
      if (found === -1) continue;

      edits.push({
        start: start + found,
        end: start + found + match.text.length,
        text: match.text,
        href: match.lift.href,
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
