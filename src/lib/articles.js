/*
 * Article content store. Each article is a markdown file in content/articles/
 * (the filename is the slug) with YAML frontmatter, and is rendered to HTML at
 * build time, so no markdown, CMS or renderer code ships to the browser.
 *
 * Server-only: import this from getStaticProps, getStaticPaths or
 * getServerSideProps, never from a component. Drafts live in
 * content/articles/drafts/ and are never read. The writing guide, including
 * the frontmatter fields and image conventions, is docs/agents/articles.md.
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
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const OWN_SITE_PATTERN = /^https?:\/\/(www\.)?strengthjourneys\.xyz(\/|$)/i;
export const FEATURED_CATEGORY_TITLE = "Featured Articles";

// Parsed once per production build, where dozens of pages ask for related
// articles. Dev re-reads every time so an edited file shows on refresh.
let cachedArticles = null;

/**
 * Published articles, newest first, as JSON-safe summaries (no body).
 * An article is published once its publishedAt has passed at build time.
 */
export function getPublishedArticles() {
  const now = Date.now();
  return loadAllArticles()
    .filter((article) => Date.parse(article.publishedAt) <= now)
    .map(toSummary);
}

/**
 * One published article with its body rendered to HTML, or null.
 *
 * @param {string} slug
 * @returns {Object|null} Summary fields plus html and wordCount.
 */
export function getArticleBySlug(slug) {
  const summary = getPublishedArticles().find((article) => article.slug === slug);
  if (!summary) return null;

  const article = loadAllArticles().find((entry) => entry.slug === slug);
  assertPublicFileExists(summary.cover, article.fileName, "cover");
  const { html, wordCount } = renderArticleMarkdown(article.body, {
    articleTitle: summary.title,
    fileName: article.fileName,
  });

  return { ...summary, html, wordCount };
}

/**
 * Published articles tagged with a category, newest first. Kept async and
 * named as it was under Sanity so the tool pages' getStaticProps read the same.
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

function loadAllArticles() {
  if (cachedArticles && process.env.NODE_ENV === "production") {
    return cachedArticles;
  }

  const articles = fs
    .readdirSync(ARTICLES_DIR, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
    .map((entry) => parseArticleFile(entry.name))
    .sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));

  cachedArticles = articles;
  return articles;
}

// Frontmatter mistakes fail the build with the file name, rather than shipping
// an article with a missing date or a broken card.
function parseArticleFile(fileName) {
  const raw = fs.readFileSync(path.join(ARTICLES_DIR, fileName), "utf8");
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(raw);
  if (!match) {
    throw new Error(`content/articles/${fileName}: missing --- frontmatter block`);
  }

  const data = yaml.load(match[1]) ?? {};
  const slug = fileName.replace(/\.md$/, "");
  const fail = (problem) => {
    throw new Error(`content/articles/${fileName}: ${problem}`);
  };

  if (!SLUG_PATTERN.test(slug)) fail("file name must be a lowercase-hyphenated slug");
  if (typeof data.title !== "string" || !data.title.trim()) fail("title is required");
  if (data.categories !== undefined && !Array.isArray(data.categories)) {
    fail("categories must be a list");
  }
  if (typeof data.cover !== "string" || !data.cover.startsWith("/")) {
    fail("cover is required, as a path under public/, e.g. /articles/<slug>/cover.jpg");
  }

  const publishedAt = toIsoDate(data.publishedAt, "publishedAt", fail);

  return {
    fileName,
    slug,
    title: data.title.trim(),
    description: typeof data.description === "string" ? data.description.trim() : null,
    publishedAt,
    updatedAt: data.updatedAt ? toIsoDate(data.updatedAt, "updatedAt", fail) : publishedAt,
    featured: data.featured === true,
    categories: (data.categories ?? []).map(String),
    cover: data.cover,
    coverAlt: typeof data.coverAlt === "string" ? data.coverAlt.trim() : null,
    coverFocus: typeof data.coverFocus === "string" ? data.coverFocus.trim() : null,
    body: match[2],
  };
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
        node.properties.className = ["decoration-primary/40", "hover:decoration-primary"];
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
    throw new Error(`content/articles/${fileName}: image ${src} must be a local path under public/`);
  }
  assertPublicFileExists(src, fileName, "image");
  const { width, height } = imageSize(fs.readFileSync(path.join(PUBLIC_DIR, src)));

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
