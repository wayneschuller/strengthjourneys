/**
 * Renders registry copy written in the inline format from
 * lib/inline-markdown.js: **bold** and [links](/path). Site paths use Next
 * links; anything absolute opens in a new tab.
 */

import { Fragment } from "react";
import Link from "next/link";

import { parseInlineMarkdown } from "@/lib/inline-markdown";

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
