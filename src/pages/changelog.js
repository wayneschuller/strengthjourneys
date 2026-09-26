/*
 * What's new (/changelog): every changelog entry in full, newest first, from
 * the markdown files in content/changelog/ rendered at build by
 * src/lib/changelog.js. One page rather than a page per entry, so there is no
 * thin duplicate content; an entry is shared by its anchor, /changelog#2026-09-14.
 * Opening the page clears the nav's "What's new" dot.
 */
import Head from "next/head";
import { Sparkles } from "lucide-react";

import {
  PageContainer,
  PageHeader,
  PageHeaderHeading,
  PageHeaderDescription,
} from "@/components/page-header";
import { formatArticleDate, PROSE_THEME_STYLE } from "@/components/article-cards";
import { FeatureRequestCard } from "@/components/feedback";
import { useMarkChangelogSeen } from "@/components/ui-shell/whats-new";

import { getChangelogEntries } from "@/lib/changelog";

const SITE_NAME = "Strength Journeys";
const CANONICAL_URL = "https://www.strengthjourneys.xyz/changelog";
const OG_IMAGE_URL = "https://www.strengthjourneys.xyz/202409-og-image.png";
const PAGE_TITLE = "What's New in Strength Journeys";
const DESCRIPTION =
  "New features and improvements in Strength Journeys, the free barbell strength tracker built on your own Google Sheet.";

// UTC, like formatArticleDate, so the static render and hydration agree.
const monthFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  timeZone: "UTC",
});

export async function getStaticProps() {
  return { props: { entries: getChangelogEntries() } };
}

export default function ChangelogPage({ entries }) {
  useMarkChangelogSeen();
  const fullTitle = `${PAGE_TITLE} | ${SITE_NAME}`;

  return (
    <PageContainer>
      <Head>
        <title>{fullTitle}</title>
        <meta name="description" content={DESCRIPTION} />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href={CANONICAL_URL} />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content={SITE_NAME} />
        <meta property="og:url" content={CANONICAL_URL} />
        <meta property="og:title" content={fullTitle} />
        <meta property="og:description" content={DESCRIPTION} />
        <meta property="og:image" content={OG_IMAGE_URL} />
      </Head>

      <PageHeader>
        <PageHeaderHeading icon={Sparkles}>{PAGE_TITLE}</PageHeaderHeading>
        <PageHeaderDescription>
          What has landed lately, newest first.
        </PageHeaderDescription>
      </PageHeader>

      <div className="mx-auto max-w-3xl space-y-10 pb-16 md:space-y-14">
        {/* Each entry is its own card so a long run of screenshots never
            blurs into the next release. */}
        {entries.map((entry) => (
          <article
            key={entry.slug}
            id={entry.slug}
            className="bg-card scroll-mt-24 overflow-hidden rounded-2xl border shadow-sm"
          >
            <header className="bg-muted/50 flex items-center gap-4 border-b px-5 py-6 md:gap-6 md:px-10 md:py-8">
              <EntryDateTile date={entry.date} />
              <h2 className="min-w-0 text-2xl leading-tight font-bold tracking-tight text-balance md:text-4xl">
                <a href={`#${entry.slug}`} className="hover:underline">
                  {entry.title}
                </a>
              </h2>
            </header>
            {/* Built from the repo's own markdown at build time; raw HTML in the
                source is dropped by the renderer, so this is not user input. */}
            <div
              className="prose prose-lg prose-headings:tracking-tight prose-headings:text-balance prose-h3:mt-10 prose-h3:text-2xl prose-h3:font-bold prose-a:decoration-2 prose-a:underline-offset-4 prose-a:transition-colors prose-li:marker:text-muted-foreground max-w-none px-5 py-6 md:px-10 md:py-8 md:[&_figure]:mx-0"
              style={PROSE_THEME_STYLE}
              dangerouslySetInnerHTML={{ __html: entry.html }}
            />
          </article>
        ))}

        <FeatureRequestCard id="feature-request" page="/changelog" />
      </div>
    </PageContainer>
  );
}

// Calendar-style date block that leads each entry, so the date is the first
// thing the eye lands on when scanning down the page.
function EntryDateTile({ date }) {
  const day = new Date(date);

  return (
    <time
      dateTime={date}
      aria-label={formatArticleDate(date)}
      className="bg-background flex w-16 shrink-0 flex-col items-center overflow-hidden rounded-xl border shadow-sm md:w-20"
    >
      <span className="bg-primary text-primary-foreground w-full py-0.5 text-center text-xs font-semibold md:text-sm">
        {monthFormatter.format(day)}
      </span>
      <span className="pt-1 text-3xl leading-none font-black tracking-tight tabular-nums md:text-4xl">
        {day.getUTCDate()}
      </span>
      <span className="text-muted-foreground pt-1 pb-1.5 text-xs font-medium tabular-nums">
        {day.getUTCFullYear()}
      </span>
    </time>
  );
}
