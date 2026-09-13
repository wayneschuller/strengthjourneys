/**
 * The registry's one rich text format: plain strings with two inline marks,
 * **bold** and [link text](/path). Nothing else is markdown here, so a stray
 * asterisk in copy stays an asterisk and authors never need to escape.
 *
 * Kept dependency-free and outside React so scripts/validate-lifts.mjs can
 * check registry copy with the same parser the pages render with.
 */

const TOKEN = /\*\*(.+?)\*\*|\[([^\]]+)\]\(([^)\s]+)\)/g;

/**
 * Split copy into text, bold and link parts.
 * @param {string} source
 * @returns {Array<{type: "text"|"bold"|"link", text: string, href?: string}>}
 */
export function parseInlineMarkdown(source) {
  const parts = [];
  let last = 0;
  for (const match of String(source ?? "").matchAll(TOKEN)) {
    if (match.index > last) {
      parts.push({ type: "text", text: source.slice(last, match.index) });
    }
    if (match[1] !== undefined) {
      parts.push({ type: "bold", text: match[1] });
    } else {
      parts.push({ type: "link", text: match[2], href: match[3] });
    }
    last = match.index + match[0].length;
  }
  if (last < String(source ?? "").length) {
    parts.push({ type: "text", text: source.slice(last) });
  }
  return parts;
}

/** The copy with its marks removed, for meta tags and JSON-LD. */
export function inlineMarkdownToText(source) {
  return parseInlineMarkdown(source)
    .map((part) => part.text)
    .join("");
}
