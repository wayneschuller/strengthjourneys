/**
 * Remark plugin that italicises double-quoted passages in assistant answers,
 * so a lifter's own words quoted back from their set notes ("moved great,
 * better than 155") stand apart from the coach's prose.
 *
 * Done over the parsed markdown rather than asked of the model, for the same
 * reason as the lift guide links: it is exact, costs no tokens, and works the
 * same whichever model is behind the chat.
 *
 * Matching is conservative so inch marks never trip it: an opening quote must
 * start the text or follow whitespace or an opening bracket, a closing quote
 * must not be followed by a letter or digit, and the quoted text cannot start
 * or end with a space or cross a line. Straight and curly quotes both count.
 */

const QUOTE_PATTERN =
  /(?<=^|[\s([{])(["“])(?![\s"”])[^"“”\n]{1,400}?(?<!\s)["”](?![\p{L}\p{N}])/gu;

// Never italicise inside these: emphasis already, links, code, headings.
const SKIPPED_NODE_TYPES = new Set([
  "emphasis",
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

/** Splits one text node into text/emphasis/text nodes, or returns null. */
function italiciseTextNode(node) {
  const replacement = [];
  let cursor = 0;

  for (const match of node.value.matchAll(QUOTE_PATTERN)) {
    if (match.index > cursor) {
      replacement.push({
        type: "text",
        value: node.value.slice(cursor, match.index),
      });
    }
    replacement.push({
      type: "emphasis",
      children: [{ type: "text", value: match[0] }],
    });
    cursor = match.index + match[0].length;
  }

  if (replacement.length === 0) return null;
  if (cursor < node.value.length) {
    replacement.push({ type: "text", value: node.value.slice(cursor) });
  }
  return replacement;
}

function walk(node) {
  if (!Array.isArray(node.children)) return;

  for (let index = 0; index < node.children.length; index += 1) {
    const child = node.children[index];
    if (SKIPPED_NODE_TYPES.has(child.type)) continue;

    if (child.type !== "text") {
      walk(child);
      continue;
    }

    const replacement = italiciseTextNode(child);
    if (replacement) {
      node.children.splice(index, 1, ...replacement);
      index += replacement.length - 1;
    }
  }
}

/**
 * Remark plugin. Runs before the lift guide links so a lift named inside a
 * quote still gets its link, inside the italics.
 */
export function remarkItalicQuotes() {
  return (tree) => walk(tree);
}
