# Changelog Workflow

Read this when writing or publishing a "What's new" entry. The changelog is
markdown in the repo, shown in full at `/changelog` and rendered at build time
by `src/lib/changelog.js` through the same renderer as articles.

It moved here from Canny in September 2026, and the ten Canny entries (March
to September 2026) came across with their images. Strength Journeys no longer
uses Canny at all: feature requests come in through the card at the bottom of
`/changelog` (`src/components/feedback/feature-request-card.js`), which emails
them through `/api/feedback` flagged as a feature request.

---

## Where things live

```
content/changelog/<date>.md             one entry, e.g. 2026-09-14.md
content/changelog/drafts/<date>.md      drafts, never built
public/changelog/<date>/image-N.webp    that entry's images
```

The file name is the entry's date, its anchor (`/changelog#2026-09-14`) and
its image folder. A second entry on the same day takes a suffix:
`2026-09-14-2.md`. Keep the date first: `next.config.js` reads the newest file
name to drive the nav's "What's new" dot.

## Frontmatter

```yaml
---
title: "A drawing for every lift, and a Lift Explorer directory"
---
```

`title` is the only field. Name the headline feature, since the page already
shows the date. The build fails, naming the file, if the title is missing, a
field is unknown, or an image is missing.

## Body markdown

The same rules as articles (see `docs/agents/articles.md`), with one
difference: the entry title is an H2, so section headings inside an entry are
`###`. Never use `#` or `##`.

A paragraph that is only an image becomes a figure, with the image title as
its caption:

```md
![Lift Explorer tiles](/changelog/2026-09-14/image-2.webp "The Lift Explorer, now a page of tiles")
```

## Images

Screenshots are most of a changelog, so downscale each one to WebP, at most
1600px wide, quality 90 so text stays sharp:

```bash
node -e 'require("sharp")(process.argv[1]).resize({ width: 1600, withoutEnlargement: true }).webp({ quality: 90 }).toFile(process.argv[2])' input.png public/changelog/<date>/image-1.webp
```

The Canny migration came out around 65 KB per image this way.

## Publishing

1. Put the file in `content/changelog/` with the date it goes out
2. Put its images in `public/changelog/<date>/`
3. Commit both; the entry and the dot go live with that deploy

Anyone who has visited before sees the dot until they open `/changelog`.
First-time visitors are marked up to date, so the dot only ever means "new
since you were here". In dev, restart `npm run dev` to see the dot for a new
entry, since `next.config.js` reads the date once at startup.
