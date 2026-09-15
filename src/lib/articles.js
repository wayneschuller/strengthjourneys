/*
 * Article content store. Every markdown file in content/articles/ is a
 * published article (the filename is the slug) with YAML frontmatter. Drafts
 * wait in content/articles/drafts/, which is never read: publishing is moving
 * the file up a folder, and it goes live with the deploy that carries it.
 * Bodies render to HTML at build time, so no markdown or renderer code ships to
 * the browser.
 *
 * Server-only: import this from getStaticProps or getStaticPaths, never from a
 * component. next-sitemap.config.js also imports it in plain Node after the
 * build, so its own imports stay on node_modules (no @/ alias). The
 * writing guide, including the frontmatter fields and image conventions, is
 * docs/agents/articles.md.
 */
import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";
import { imageSize } from "image-size";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import rehypeStringify from "rehype-stringify";

const ARTICLES_DIR = path.join(process.cwd(), "content", "articles");
const PUBLIC_DIR = path.join(process.cwd(), "public");
const FRONTMATTER_PATTERN = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const COVER_PATTERN = /^\/.+\.(jpe?g|png)$/i;
const OWN_SITE_PATTERN = /^https?:\/\/(www\.)?strengthjourneys\.xyz(\/|$)/i;
export const FEATURED_CATEGORY_TITLE = "Featured Articles";

const FRONTMATTER_FIELDS = new Set([
  "title",
  "description",
  "publishedAt",
  "updatedAt",
  "featured",
  "categories",
  "cover",
  "coverFocus",
  "coverAlt",
]);

// Every category an article may carry. Tool pages ask for one of these by exact
// title (the table in docs/agents/articles.md says which page shows which), and
// the article page ranks its "more articles" row by shared categories, which is
// all Home Dashboard and Health do. A category outside this list fails the build, so a
// typo cannot quietly hide an article from the page it was written for.
const ARTICLE_CATEGORIES = new Set([
  "How Strong Am I?",
  "Strength Calculator",
  "One Rep Max Calculator",
  "1000lb Club",
  "200/300/400/500 Strength Club",
  "Strength Milestones",
  "Strength Visualizer",
  "Tonnage Metrics",
  "Personal Record Analyzer",
  "Warm Ups",
  "Gym Timer",
  "AI Lifting Assistant",
  "Gym Music",
  "Home Dashboard",
  "Health",
  "Back Squat",
  "Bench Press",
  "Deadlift",
  "Strict Press",
]);

// Parsed once per production build process, where dozens of pages ask for
// related articles. Dev re-reads every time so an edited file shows on refresh.
let cachedArticles = null;

/**
 * Every article, newest first, as JSON-safe summaries (no body).
 */
export function getPublishedArticles() {
  return loadAllArticles().map(toSummary);
}

/**
 * One article with its body rendered to HTML, or null.
 *
 * @param {string} slug
 * @returns {Object|null} Summary fields plus html and wordCount.
 */
export function getArticleBySlug(slug) {
  const article = loadAllArticles().find((entry) => entry.slug === slug);
  if (!article) return null;

  const { html, wordCount } = renderArticleMarkdown(article.body, {
    articleTitle: article.title,
    fileName: article.fileName,
  });

  return { ...toSummary(article), html, wordCount };
}

/**
 * Articles tagged with a category, newest first. Kept async and named as it
 * was under Sanity so the tool pages' getStaticProps read the same.
 *
 * @param {string} category - Category title, or "Featured Articles".
 */
export async function fetchRelatedArticles(category) {
  return getPublishedArticles().filter((article) =>
    category === FEATURED_CATEGORY_TITLE
      ? article.featured
      : article.categories.includes(category),
  );
}

const ARTICLE_LIBRARY_PAGE_SIZE = 12;

/**
 * One page of the article library, shared by /articles and /articles/page/N.
 * Featured articles lead page 1 only, so the numbered pages run through the
 * regular articles alone.
 *
 * @param {number} page - 1-based page number.
 * @returns {{featuredArticles: Object[], articles: Object[], startIndex: number, totalPages: number}}
 */
export function getArticleLibraryPage(page) {
  const allArticles = getPublishedArticles();
  const regularArticles = allArticles.filter((article) => !article.featured);
  const startIndex = (page - 1) * ARTICLE_LIBRARY_PAGE_SIZE;

  return {
    featuredArticles:
      page === 1 ? allArticles.filter((article) => article.featured) : [],
    articles: regularArticles.slice(
      startIndex,
      startIndex + ARTICLE_LIBRARY_PAGE_SIZE,
    ),
    startIndex,
    totalPages: Math.max(
      1,
      Math.ceil(regularArticles.length / ARTICLE_LIBRARY_PAGE_SIZE),
    ),
  };
}

function loadAllArticles() {
  if (cachedArticles && process.env.NODE_ENV === "production") {
    return cachedArticles;
  }

  const articles = fs
    .readdirSync(ARTICLES_DIR, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
    .map((entry) => parseArticleFile(entry.name))
    // Slug breaks date ties so the order never depends on the filesystem.
    .sort(
      (a, b) =>
        Date.parse(b.publishedAt) - Date.parse(a.publishedAt) ||
        a.slug.localeCompare(b.slug),
    );

  cachedArticles = articles;
  return articles;
}

// Frontmatter mistakes fail the build with the file name, rather than shipping
// an article with a missing date, a broken card or a silently ignored field.
function parseArticleFile(fileName) {
  const raw = fs.readFileSync(path.join(ARTICLES_DIR, fileName), "utf8");
  const fail = (problem) => {
    throw new Error(`content/articles/${fileName}: ${problem}`);
  };

  const match = FRONTMATTER_PATTERN.exec(raw);
  if (!match) fail("missing --- frontmatter block");

  const slug = fileName.replace(/\.md$/, "");
  if (!SLUG_PATTERN.test(slug))
    fail("file name must be a lowercase-hyphenated slug");

  const data = yaml.load(match[1]) ?? {};
  const unknownFields = Object.keys(data).filter(
    (key) => !FRONTMATTER_FIELDS.has(key),
  );
  if (unknownFields.length > 0) {
    fail(`unknown frontmatter field ${unknownFields.join(", ")}`);
  }

  const title = readText(data, "title", fail);
  if (!title) fail("title is required");

  const cover = readText(data, "cover", fail);
  if (!cover || !COVER_PATTERN.test(cover)) {
    fail(
      "cover is required, as a JPEG or PNG under public/, e.g. /articles/<slug>/cover.jpg",
    );
  }
  assertPublicFileExists(cover, fileName, "cover");

  if (data.featured !== undefined && typeof data.featured !== "boolean") {
    fail("featured must be true or false");
  }

  const categories = data.categories ?? [];
  if (!Array.isArray(categories)) fail("categories must be a list");
  const unknownCategories = categories.filter(
    (title) => !ARTICLE_CATEGORIES.has(title),
  );
  if (unknownCategories.length > 0) {
    fail(
      `unknown category ${unknownCategories.join(", ")} (add new ones to ARTICLE_CATEGORIES in src/lib/articles.js)`,
    );
  }

  const publishedAt = toIsoDate(data.publishedAt, "publishedAt", fail);

  return {
    fileName,
    slug,
    title,
    description: readText(data, "description", fail),
    publishedAt,
    updatedAt: data.updatedAt
      ? toIsoDate(data.updatedAt, "updatedAt", fail)
      : publishedAt,
    featured: data.featured === true,
    categories,
    cover,
    coverAlt: readText(data, "coverAlt", fail),
    coverFocus: readText(data, "coverFocus", fail),
    body: match[2],
  };
}

// An optional text field, trimmed, with blank treated as absent.
function readText(data, field, fail) {
  const value = data[field];
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") fail(`${field} must be text`);
  return value.trim() || null;
}

// YAML turns an unquoted date into a Date, while a quoted one stays a string;
// either way the pages get the same ISO string.
function toIsoDate(value, field, fail) {
  const date = value instanceof Date ? value : new Date(value);
  if (value === undefined || value === null || Number.isNaN(date.getTime())) {
    fail(`${field} is required and must be a date`);
  }
  return date.toISOString();
}

function toSummary({ body, fileName, ...summary }) {
  return summary;
}

function assertPublicFileExists(publicPath, fileName, label) {
  if (!fs.existsSync(path.join(PUBLIC_DIR, publicPath))) {
    throw new Error(
      `content/articles/${fileName}: ${label} ${publicPath} not found under public/`,
    );
  }
}

function renderArticleMarkdown(markdown, { articleTitle, fileName }) {
  const file = unified()
    .use(remarkParse)
    .use(remarkGfm)
    // Raw HTML in the markdown is dropped: articles are plain markdown only.
    .use(remarkRehype)
    .use(rehypeArticleElements, { articleTitle, fileName })
    .use(rehypeStringify)
    .processSync(markdown);

  return { html: String(file), wordCount: file.data.wordCount ?? 0 };
}

/*
 * Shapes the generated HTML to match the article page's design:
 * - a paragraph holding only an image (optionally wrapped in a link) becomes a
 *   <figure>, with the image's markdown title as its <figcaption>
 * - images get real width/height from the file, so nothing shifts on load
 * - links off the site open in a new tab
 * - blockquotes become pull quotes
 * The Tailwind classes here are picked up by the class scanner like any other
 * source file.
 */
function rehypeArticleElements({ articleTitle, fileName }) {
  return (tree, file) => {
    let wordCount = 0;

    walk(tree, (node, index, parent) => {
      if (node.type === "text") {
        wordCount += node.value.split(/\s+/).filter(Boolean).length;
        return;
      }
      if (node.type !== "element") return;

      if (node.tagName === "p" && parent) {
        const figure = buildFigure(node, { articleTitle, fileName });
        if (figure) parent.children[index] = figure;
        return;
      }

      if (node.tagName === "a" && !node.properties.dataFigureLink) {
        decorateLink(node);
        node.properties.className = [
          "decoration-primary/40",
          "hover:decoration-primary",
        ];
        return;
      }

      if (node.tagName === "blockquote") {
        node.properties.className = [
          "not-prose",
          "border-primary",
          "bg-muted/50",
          "my-10",
          "rounded-r-xl",
          "border-l-4",
          "px-6",
          "py-5",
          "text-xl",
          "leading-relaxed",
          "font-medium",
          "text-pretty",
          "md:text-2xl",
          // Not an arbitrary [&>p+p] variant: a ">" inside the class attribute
          // is valid HTML but leaks into naive text extraction by crawlers.
          "space-y-4",
        ];
      }
    });

    file.data.wordCount = wordCount;
  };
}

function buildFigure(paragraph, { articleTitle, fileName }) {
  const content = paragraph.children.filter(
    (child) => !(child.type === "text" && !child.value.trim()),
  );
  if (content.length !== 1 || content[0].type !== "element") return null;

  let link = null;
  let image = content[0];
  if (image.tagName === "a") {
    const linked = image.children.filter(
      (child) => !(child.type === "text" && !child.value.trim()),
    );
    if (linked.length !== 1 || linked[0].tagName !== "img") return null;
    link = image;
    image = linked[0];
  }
  if (image.tagName !== "img") return null;

  const src = String(image.properties.src ?? "");
  const caption = String(image.properties.title ?? "").trim();
  const alt = String(image.properties.alt ?? "").trim();

  if (!src.startsWith("/")) {
    throw new Error(
      `content/articles/${fileName}: image ${src} must be a local path under public/`,
    );
  }
  assertPublicFileExists(src, fileName, "image");
  const { width, height } = imageSize(
    fs.readFileSync(path.join(PUBLIC_DIR, src)),
  );

  const img = {
    type: "element",
    tagName: "img",
    properties: {
      src,
      alt: alt || caption || articleTitle || "Article image",
      width,
      height,
      loading: "lazy",
      decoding: "async",
      className: [
        "mx-auto",
        "h-auto",
        "max-h-[80vh]",
        "w-auto",
        "max-w-full",
        "rounded-xl",
        "border",
        "shadow-sm",
      ],
    },
    children: [],
  };

  let media = img;
  if (link) {
    decorateLink(link);
    media = {
      type: "element",
      tagName: "a",
      properties: {
        ...link.properties,
        dataFigureLink: true,
        className: ["block", "transition-opacity", "hover:opacity-90"],
        ariaLabel: caption || alt || "Open image link",
      },
      children: [img],
    };
  }

  const children = [media];
  if (caption) {
    children.push({
      type: "element",
      tagName: "figcaption",
      properties: {
        className: [
          "text-muted-foreground",
          "mx-auto",
          "mt-3",
          "max-w-2xl",
          "text-center",
          "text-sm",
          "text-pretty",
        ],
      },
      children: [{ type: "text", value: caption }],
    });
  }

  return {
    type: "element",
    tagName: "figure",
    properties: { className: ["not-prose", "my-10", "md:-mx-6"] },
    children,
  };
}

function decorateLink(node) {
  const href = String(node.properties.href ?? "");
  if (/^https?:\/\//i.test(href) && !OWN_SITE_PATTERN.test(href)) {
    node.properties.target = "_blank";
    node.properties.rel = ["noopener", "noreferrer"];
  }
}

// Depth-first walk that lets the visitor swap a node for another in its parent.
function walk(node, visit, index = null, parent = null) {
  visit(node, index, parent);
  const current = parent && index !== null ? parent.children[index] : node;
  if (!current.children) return;
  for (let i = 0; i < current.children.length; i += 1) {
    walk(current.children[i], visit, i, current);
  }
}
