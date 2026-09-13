# Sanity CMS Workflow

Read this when browsing, writing, or editing articles in Sanity. Moved out of
AGENTS.md so it only loads when needed.

- Blog content lives in the sibling repo `/home/schuller/hacking/strength-journeys-sanity-studio`, not in this app repo
- The front-end reads Sanity content via `src/lib/sanity-io.js`
- Verified studio target: project `czypnl5j`, dataset `production`
- For browsing or writing articles, prefer running Sanity CLI commands from the sibling studio repo because that environment may already have authenticated local access even when this app repo only has public read config
- A quick read-access check that worked from the studio repo was:

```
npx sanity documents query '*[_type == "post"][0...3]{_id,title,publishedAt}'
```

- If an agent needs to create or edit content programmatically, do it from the sibling studio repo first and treat the app repo as the rendering client unless the user explicitly wants front-end integration changes too
- Be careful with `npx sanity documents create ... --replace`: it behaves like a full document replace, not a patch. Any field omitted from the payload can be dropped
- When replacing an existing post, explicitly preserve metadata fields unless the user asked to remove them:
  - `mainImage`
  - `categories`
  - `publishedAt`
  - `author`
  - `slug`
- Before replacing an existing article, fetch the current document first:

```
npx sanity documents get <document-id>
```

- If a replace accidentally drops metadata like the feature image, recover the prior value from Sanity History API rather than guessing. This worked with the local CLI auth token in `~/.config/sanity/config.json`
- Useful recovery flow for an existing document:
  1. Get recent revision IDs:

```
TOKEN=$(node -pe "JSON.parse(require('fs').readFileSync(process.env.HOME+'/.config/sanity/config.json','utf8')).authToken")
curl -sS -H "Authorization: Bearer $TOKEN" \
  "https://czypnl5j.api.sanity.io/v2025-02-19/data/history/production/transactions/<document-id>?reverse=true&limit=10&excludeContent=true"
```

  2. Fetch the prior document revision:

```
curl -sS -H "Authorization: Bearer $TOKEN" \
  "https://czypnl5j.api.sanity.io/v2025-02-19/data/history/production/documents/<document-id>?revision=<revision-id>"
```

- For rewrite jobs, prefer preserving the original feature image and existing categories unless the user explicitly asks for a new image or taxonomy change
- If the user asks to publish or schedule a post, set `publishedAt` explicitly in the payload. Do not assume the previous date should be kept
