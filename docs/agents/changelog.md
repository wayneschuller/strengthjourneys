# Changelog Workflow

Read this when writing or publishing a "What's new" entry, or when changing the
`/changelog` page, its nav dot, or the feature request card. The changelog is
markdown in the repo, rendered at build time by `src/lib/changelog.js` through
the same renderer as articles.

It moved here from Canny in September 2026, and all 49 Canny entries (July
2024 to September 2026) came across with their images. Canny's public page
and RSS feed showed only the newest ten; the rest came from its paged
`/api/changelog/getEntries` endpoint, and the raw export is kept in
`strengthjourneys-private/canny-changelog-export-2026-09-26.json`. Strength Journeys no longer
uses Canny for anything: the changelog is here and feature requests come in
through our own card (see below). Do not add Canny links back.

---

## Where things live

```
content/changelog/<date>.md             one entry, e.g. 2026-09-14.md
content/changelog/drafts/<date>.md      drafts, never built
public/changelog/<date>/image-N.webp    that entry's images

src/lib/changelog.js                    reads, validates and renders entries
src/pages/changelog.js                  the page: cards, date tiles, folding
src/components/ui-shell/whats-new.js    the "What's new" dot and its hooks
src/components/feedback/feature-request-card.js   the request form at the bottom
next.config.js                          bakes the newest entry date into the build
```

The file name is the entry's date, its anchor (`/changelog#2026-09-14`) and
its image folder. A second entry on the same day takes a suffix:
`2026-09-14-2.md`. Keep the date first: `next.config.js` and the sitemap read
the newest file name, not the frontmatter.

## Writing an entry

### Frontmatter

```yaml
---
title: "A drawing for every lift, and a Lift Explorer directory"
---
```

`title` is the only field. Name the headline feature, since the page already
shows the date in its own tile. The build fails, naming the file, if the title
is missing, a field is unknown, or an image is missing.

### Body

The same markdown rules as articles (see `docs/agents/articles.md`), with one
difference: the entry title is an H2, so section headings inside an entry are
`###`. Never use `#` or `##`.

**The `###` headings do double duty.** Once an entry is older than the newest
three it folds down, and its folded card shows those headings joined with
` · ` as a summary, cut off after two lines. So give every entry `###`
sections, and make the headings short, specific feature names ("Streaks
Leaderboard", not "Other stuff") with the most important first. An entry with
no `###` headings folds to its title alone.

A paragraph that is only an image becomes a figure, with the image title as
its caption:

```md
![Lift Explorer tiles](/changelog/2026-09-14/image-2.webp "The Lift Explorer, now a page of tiles")
```

### Images

Screenshots are most of a changelog, so downscale each one to WebP, at most
1600px wide, quality 90 so text stays sharp:

```bash
node -e 'require("sharp")(process.argv[1]).resize({ width: 1600, withoutEnlargement: true }).webp({ quality: 90 }).toFile(process.argv[2])' input.png public/changelog/<date>/image-1.webp
```

The Canny migration came out around 65 KB per image this way.

### Publishing

1. Put the file in `content/changelog/` with the date it goes out
2. Put its images in `public/changelog/<date>/`
3. Commit both; the entry and the dot go live with that deploy

## How the page works

- **One page, no per-entry pages.** Every entry renders on `/changelog`,
  newest first, each in its own card. Separate entry pages would be thin
  duplicates of this one; an entry is shared by its anchor instead.
- **Date tile.** Each card header leads with a calendar tile (month, large
  day, year), with the title beside it. Dates are formatted in UTC so the
  static render and hydration agree.
- **Folding.** The newest `OPEN_ENTRY_COUNT` (3, top of
  `src/pages/changelog.js`) entries render in full. Older ones are native
  `<details>` cards showing the date, title and the `###` summary, and expand
  in place. The body stays in the HTML for search, and its lazy images do not
  load until opened. It is a fixed count rather than an age so a quiet month
  never leaves the page with nothing open.
- **Anchors open folded entries.** `useOpenLinkedEntry` in the page opens and
  scrolls to a folded entry when the URL hash names it, on load and on
  `hashchange`.
- **Pagination** was considered and deliberately left out: people read a
  changelog from the top, and pages would break entry anchors. Revisit
  (perhaps a page per year) only past roughly 50 entries; the page data was
  45 KB at ten and 132 KB at fifty, once the full Canny history came across.
- **SEO.** `/changelog` is indexed, and `next-sitemap.config.js` gives it the
  newest entry's date as `lastmod`.

## The "What's new" dot

- `next.config.js` reads the newest file name in `content/changelog/` and
  exposes it as `NEXT_PUBLIC_CHANGELOG_LATEST`, so the check needs no request.
- The browser keeps the newest date it has seen in localStorage under
  `LOCAL_STORAGE_KEYS.CHANGELOG_SEEN` (`SJ_changelogSeen`). The dot is due
  while that is older than the build's newest date, **or when there is no key
  at all**: a browser that has never opened `/changelog` has something to see.
  Only opening `/changelog` writes the key.
- When it appears depends on who is looking (Wayne's call, Sep 26 2026):
  - stored date older than the newest entry: pinging dot straight away
  - no key, signed in: a returning lifter from before the dot, so pinging dot
    straight away
  - no key, signed out: most likely a first visit, so first-time visitors get
    time to take in the landing. No dot for 10 seconds, then a still dot, then
    the ping 10 seconds after that. The timers restart on a full page load.
  - no key while the session is still loading: nothing until it is known
  `useChangelogDot()` returns `null`, `"still"` or `"ping"`; the delays are
  `FIRST_VISIT_SHOW_DELAY_MS` and `FIRST_VISIT_PING_DELAY_MS` in
  `whats-new.js`.
- The dot waits until the client has read storage (`useIsClient`), so it never
  flashes on during the server render for lifters who are up to date.
- Opening `/changelog` marks everything seen, and every dot on the page clears
  at once.
- It is a red dot, pinging unless `ping={false}` (`motion-safe`, so
  reduced-motion users always get a still dot). On a text label it sits on the top-right corner of the words
  "What's New" (`corner`), so it clearly belongs to the changelog; on an icon
  it sits on the icon's corner (`floating`).
- It appears on the desktop "What's New" link (only visible from 1800px wide),
  in the mobile bar beside the home link (a Megaphone icon next to the house
  below sm, the words "What's New" next to the wordmark from sm to lg), on
  the "What's New" item that leads the mobile menu, and on the signed-in avatar
  and its "What's New" menu item. The Menu button itself carries no dot, so the
  bar never shows two. Signed-out desktop visitors between lg and 1800px have
  no dot surface; the footer "What's new" link still works.
- In dev, restart `npm run dev` to see the dot for a new entry, since
  `next.config.js` reads the date once at startup.

## Feature requests

The card at the bottom of `/changelog` (anchor `#feature-request`, also linked
from the footer as "Request a feature") replaced Canny's public board. It posts
to `/api/feedback` with `sentiment: "request"` and
`triggerLabel: "changelog-feature-request"`, and the API labels those emails
"💡 feature request" rather than thumbs up or down. The lifter can include
their email for a reply. There is no public board and no voting; requests
arrive in Wayne's inbox like other feedback.
