/*
 * Changelog content store for /changelog. Each markdown file in
 * content/changelog/ is one entry, named by its date (2026-09-14.md) with a
 * title in its frontmatter. The file name is the entry's anchor on the page and
 * its image folder under public/changelog/. Drafts wait in
 * content/changelog/drafts/, which is never read.
 *
 * Bodies render through the article renderer, so the image rules, figure
 * captions and build checks are the same as articles. next.config.js reads the
 * newest file name on its own for the "What's new" dot, so keep the date-first
 * naming. The writing guide is docs/agents/changelog.md.
 *
 * Server-only: import this from getStaticProps, never from a component.
 */
import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";

import { renderArticleMarkdown } from "./articles.js";

const CHANGELOG_DIR = path.join(process.cwd(), "content", "changelog");
const FRONTMATTER_PATTERN = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;
// A second entry on the same day takes a suffix: 2026-09-14-2.md.
const ENTRY_NAME_PATTERN = /^(\d{4}-\d{2}-\d{2})(?:-[a-z0-9]+)*$/;
const FRONTMATTER_FIELDS = new Set(["title"]);

/**
 * Every changelog entry, newest first, with its body rendered to HTML.
 *
 * @returns {{slug: string, date: string, title: string, html: string}[]}
 */
export function getChangelogEntries() {
  return fs
    .readdirSync(CHANGELOG_DIR, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
    .map((entry) => parseEntryFile(entry.name))
    .sort((a, b) => b.slug.localeCompare(a.slug));
}

// Mistakes fail the build with the file name, like articles do.
function parseEntryFile(fileName) {
  const sourcePath = `content/changelog/${fileName}`;
  const fail = (problem) => {
    throw new Error(`${sourcePath}: ${problem}`);
  };

  const slug = fileName.replace(/\.md$/, "");
  const nameMatch = ENTRY_NAME_PATTERN.exec(slug);
  if (!nameMatch || Number.isNaN(Date.parse(nameMatch[1]))) {
    fail("file name must start with the entry date, e.g. 2026-09-14.md");
  }

  const match = FRONTMATTER_PATTERN.exec(fs.readFileSync(path.join(CHANGELOG_DIR, fileName), "utf8"));
  if (!match) fail("missing --- frontmatter block");

  const data = yaml.load(match[1]) ?? {};
  const unknownFields = Object.keys(data).filter(
    (key) => !FRONTMATTER_FIELDS.has(key),
  );
  if (unknownFields.length > 0) {
    fail(`unknown frontmatter field ${unknownFields.join(", ")}`);
  }

  const title = typeof data.title === "string" ? data.title.trim() : "";
  if (!title) fail("title is required");

  const { html } = renderArticleMarkdown(match[2], {
    articleTitle: title,
    sourcePath,
  });

  return { slug, date: nameMatch[1], title, html };
}
