/**
 * Renders lift registry copy written with two inline marks, **bold** and
 * [link text](/path), and nothing else, so a stray asterisk in copy stays an
 * asterisk and authors never need to escape. Site paths use Next links;
 * anything absolute opens in a new tab.
 */

import { Fragment } from "react";
import Link from "next/link";

const TOKEN = /\*\*(.+?)\*\*|\[([^\]]+)\]\(([^)\s]+)\)/g;
const LINK_CLASS =
  "text-blue-600 underline visited:text-purple-600 hover:text-blue-800";

export function InlineMarkdown({ text }) {
  return parseInlineMarkdown(text).map((part, i) => {
    if (part.type === "bold") return <strong key={i}>{part.text}</strong>;
    if (part.type !== "link") return <Fragment key={i}>{part.text}</Fragment>;
    if (/^https?:\/\//.test(part.href)) {
      return (
        <a
          key={i}
          href={part.href}
          target="_blank"
          rel="noopener noreferrer"
          className={LINK_CLASS}
        >
          {part.text}
        </a>
      );
    }
    return (
      <Link key={i} href={part.href} prefetch={false} className={LINK_CLASS}>
        {part.text}
      </Link>
    );
  });
}

/** The copy with its marks removed, for meta tags and JSON-LD. */
export function inlineMarkdownToText(source) {
  return parseInlineMarkdown(source)
    .map((part) => part.text)
    .join("");
}

/** Split copy into text, bold and link parts. */
function parseInlineMarkdown(source) {
  // Anything but a string (a missing answer, an old segment array) renders
  // nothing rather than "[object Object]".
  const input = typeof source === "string" ? source : "";
  const parts = [];
  let last = 0;
  for (const match of input.matchAll(TOKEN)) {
    if (match.index > last) {
      parts.push({ type: "text", text: input.slice(last, match.index) });
    }
    if (match[1] !== undefined) {
      parts.push({ type: "bold", text: match[1] });
    } else {
      parts.push({ type: "link", text: match[2], href: match[3] });
    }
    last = match.index + match[0].length;
  }
  if (last < input.length) parts.push({ type: "text", text: input.slice(last) });
  return parts;
}
