# Articles Workflow

Read this when writing, editing, or publishing an article. Articles are
markdown files in the repo, rendered to HTML at build time by
`src/lib/articles.js`. Wayne writes them with Claude, so this is the whole
editorial system: there is no CMS.

They moved here from Sanity in September 2026. The Sanity dataset (project
`czypnl5j`) is left untouched as a backup. Do not read from or write to it.

---

## Where things live

```
content/articles/<slug>.md          one published article; the filename is the URL slug
content/articles/drafts/<slug>.md   drafts and idea stubs, never built
public/articles/<slug>/cover.jpg    the cover image (required)
public/articles/<slug>/image-N.webp inline images
```

The page is `/articles/<slug>`. **Never rename a published file** without adding
a permanent redirect in `next.config.js`, because the slug is the indexed URL.

## Frontmatter

```yaml
---
title: "What Is a Good Bench Press? (By Age, Weight & Experience)"
description: "One or two sentences for cards, the article standfirst and meta description."
publishedAt: "2026-03-29T09:00:00.000Z"
updatedAt: "2026-03-29T09:00:00.000Z"
featured: true
categories:
  - "Bench Press"
  - "Strength Calculator"
cover: "/articles/what-is-a-good-bench-press-by-age-weight-and-experience/cover.jpg"
coverFocus: "50% 30%"
coverAlt: "A lifter locking out a heavy bench press"
---
```

| Field | Required | What it does |
| --- | --- | --- |
| `title` | yes | H1, page title, cards, JSON-LD headline |
| `description` | recommended | Meta description, standfirst under the H1, card text. Keep it under ~200 characters |
| `publishedAt` | yes | Publish date shown on the article and its cards. Set it when you publish |
| `updatedAt` | no | `dateModified` in JSON-LD and `lastmod` in the sitemap. Defaults to `publishedAt` |
| `featured` | no | `true` puts it in the photo bento on `/articles` and makes it eligible for the homepage reading rail (newest two) |
| `categories` | no | Exact titles drive the related-article blocks on tool pages (see below) |
| `cover` | yes | Path under `public/`. Also used as `og:image`, so it must be a JPEG or PNG |
| `coverFocus` | no | CSS `object-position` keeping the subject in frame when cards crop the cover |
| `coverAlt` | no | Alt text for the cover. Defaults to a title-based alt |

Quote date strings. The build fails, naming the file, if `title`,
`publishedAt` or `cover` is missing, a referenced image does not exist, a field
is not one of those above, or a category is not a known one.

Dates and SEO: bump `updatedAt` for a substantive content change, not a typo.
Do not move an existing article's `publishedAt` unless Wayne asks.

## Body markdown

Plain markdown with GitHub extensions (tables, strikethrough, autolinks):

- `##` and `###` headings. The page supplies the H1 from `title`, so never use `#`
- Lists, **bold**, *italic*, and links. Links off the site open in a new tab
  automatically. Link to our own pages with full `https://www.strengthjourneys.xyz/...`
  URLs or root paths
- `>` blockquotes render as large pull quotes
- A paragraph that is only an image becomes a figure. The image title becomes
  the caption, and wrapping it in a link makes the figure clickable:

```md
![Alt text for screen readers](/articles/<slug>/image-1.webp "Caption shown under the image")

[![Alt text](/articles/<slug>/image-2.webp "Caption")](https://www.strengthjourneys.xyz/calculator)
```

Raw HTML is dropped by the renderer, so do not use it. A line that starts with
a number and a full stop but is not a list needs escaping: `1\. Lifting For Life`.

## Images

Every image ships in every deployment, and Deployment Storage is a tight Vercel
Hobby meter, so downscale before committing:

- Cover: JPEG, at most 2000px wide, quality ~82 (roughly 150-500 KB)
- Inline: WebP, at most 1600px wide, quality ~82 (90 for screenshots with text)

`sharp` is already in `node_modules` (it comes with Next):

```
node -e 'require("sharp")(process.argv[1]).resize({ width: 2000, withoutEnlargement: true }).jpeg({ quality: 82, mozjpeg: true }).toFile(process.argv[2])' input.png public/articles/<slug>/cover.jpg
node -e 'require("sharp")(process.argv[1]).resize({ width: 1600, withoutEnlargement: true }).webp({ quality: 82 }).toFile(process.argv[2])' input.png public/articles/<slug>/image-1.webp
```

Inline images get their width and height from the file at build time, so
nothing shifts on load.

## Categories and related articles

Tool pages show articles whose `categories` include the category they ask for:

| Category | Shown on |
| --- | --- |
| `How Strong Am I?` | `/how-strong-am-i` |
| `Strength Calculator` | `/strength-levels`, `/how-strong-is-a-gorilla` |
| `One Rep Max Calculator` | `/calculator`, `/calculator/*` |
| `1000lb Club` | `/1000lb-club-calculator` |
| `200/300/400/500 Strength Club` | `/200-300-400-500-strength-club-calculator` |
| `Strength Milestones` | `/plate-milestones` |
| `Strength Visualizer` | `/visualizer` |
| `Tonnage Metrics` | `/tonnage` |
| `Personal Record Analyzer` | `/lift-explorer` |
| `Warm Ups` | `/warm-up-sets-calculator` |
| `Gym Timer` | `/timer` |
| `AI Lifting Assistant` | `/ai-lifting-assistant` |
| `Gym Music` | `/gym-playlist-leaderboard` |
| Lift names (`Back Squat`, `Bench Press`, `Deadlift`, `Strict Press`) | `/progress-guide/<lift>` |

`/strength-levels/<lift>` pages use `relatedArticlesCategory` from their page
config. The article page's own "more articles" row ranks by shared categories,
which is all `Home Dashboard` does.

The known categories are `ARTICLE_CATEGORIES` in `src/lib/articles.js`, and any
other category fails the build. Add a new one there first.

## Drafts and publishing

Every file directly in `content/articles/` is live from the deploy that carries
it; there is no scheduling, so publish an article only when you mean to deploy
it. Drafts and idea stubs sit in `content/articles/drafts/` and are never read by
the build, so they need no `publishedAt`, `cover` or `updatedAt`. Leave the
empty idea stubs alone; Wayne keeps them as placeholders.

To publish a draft:

1. Move it to `content/articles/<slug>.md`
2. Put its images in `public/articles/<slug>/` (a draft's own images, if any,
   sit in `content/articles/drafts/<slug>/`)
3. Fill in `publishedAt` (today), `cover` and `description`
4. Add the article to the Articles list in `public/llms.txt`
5. Commit and push. It goes live with the next deploy

Preview with the dev server: edits show on a page refresh.
