# Sanity Related Articles Workflow

Created: 2026-03-10

Purpose: quick notes for future agents updating related-article categories for Strength Journeys pages.

## Studio Location

- Sanity Studio repo: `/home/schuller/hacking/strength-journeys-sanity-studio`
- Project ID: `czypnl5j`
- Dataset: `production`

## Important Rule

Sanity tagging alone is not enough.

The page in this repo must query the same category title via:

- [src/lib/sanity-io.js](/home/schuller/hacking/strengthjourneys/src/lib/sanity-io.js)
- page-level `fetchRelatedArticles("...")` usage

If the page still points at a generic category like `"Strength Standards"`, new Sanity tags will not show up.

## Typical Flow

1. Find the page’s current related-article category string.
   Example:
   - [src/pages/200-300-400-500-strength-club-calculator.js](/home/schuller/hacking/strengthjourneys/src/pages/200-300-400-500-strength-club-calculator.js)
   - [src/pages/how-strong-am-i.js](/home/schuller/hacking/strengthjourneys/src/pages/how-strong-am-i.js)

2. In the Sanity Studio repo, inspect categories and published posts.
   Commands:
   ```bash
   npx sanity documents query '*[_type == "category"]{_id,title}'
   npx sanity documents query '*[_type == "post" && defined(publishedAt)] | order(publishedAt desc){_id,title,"slug":slug.current,categories[]->{_id,title}}'
   ```

3. Create a dedicated category if needed.
   Example JSON:
   ```json
   {
     "_id": "category-how-strong-am-i",
     "_type": "category",
     "title": "How Strong Am I?",
     "description": "Articles related to strength standards, strength levels, and figuring out how strong you are."
   }
   ```
   Create it with:
   ```bash
   npx sanity documents create /tmp/category-how-strong-am-i.json --missing
   ```

4. Tag only the best-fit published posts.
   Keep the category tight. For calculator pages, 4 related posts is usually enough.

5. If needed, retag to enforce an exact set.
   Strategy:
   - fetch each document with `npx sanity documents get <id>`
   - remove only the target category refs being managed
   - preserve unrelated existing category refs
   - append the desired category refs
   - upsert back with `npx sanity documents create <file> --replace`

6. Update the app repo page to use the dedicated category title, then commit/push to both `main` and `stable` if the page exists on both branches.

## Auth / Permissions Note

Sanity writes depend on the user’s existing login under `~/.config/sanity`.

In Codex, writes may require escalated permissions because the CLI touches that config path.

## Queries That Help

Show one category’s current post set:

```bash
npx sanity documents query '*[_type == "post" && "How Strong Am I?" in categories[]->title] | order(publishedAt desc){title,"slug":slug.current}'
```

Show whether a category exists:

```bash
npx sanity documents query '*[_type == "category" && title == "How Strong Am I?"]{_id,title,description}'
```

## Recent Examples

- `200/300/400/500 Strength Club`
- `How Strong Am I?`

Both now have dedicated Sanity categories and matching page-side category strings in this repo.
