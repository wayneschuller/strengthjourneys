/*
 * What's new (/changelog): every changelog entry in full, newest first, from
 * the markdown files in content/changelog/ rendered at build by
 * src/lib/changelog.js. One page rather than a page per entry, so there is no
 * thin duplicate content; an entry is shared by its anchor, /changelog#2026-09-14.
 * Opening the page clears the nav's "What's new" dot.
 */
import Head from "next/head";
import Link from "next/link";
import { ArrowUpRight, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  PageContainer,
  PageHeader,
  PageHeaderHeading,
  PageHeaderDescription,
} from "@/components/page-header";
import {
  formatArticleDate,
  PROSE_THEME_STYLE,
} from "@/components/article-cards";
import { useMarkChangelogSeen } from "@/components/ui-shell/whats-new";

import { getChangelogEntries } from "@/lib/changelog";

const SITE_NAME = "Strength Journeys";
const CANONICAL_URL = "https://www.strengthjourneys.xyz/changelog";
const OG_IMAGE_URL = "https://www.strengthjourneys.xyz/202409-og-image.png";
const PAGE_TITLE = "What's New in Strength Journeys";
const DESCRIPTION =
  "New features and improvements in Strength Journeys, the free barbell strength tracker built on your own Google Sheet.";
const FEATURE_REQUESTS_URL = "https://strengthjourneys.canny.io/feature-requests";

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
            <header className="bg-muted/50 border-b px-5 py-6 md:px-10 md:py-8">
              <time
                dateTime={entry.date}
                className="bg-background text-muted-foreground inline-flex rounded-full border px-3 py-1 text-sm font-medium"
              >
                {formatArticleDate(entry.date)}
              </time>
              <h2 className="mt-4 text-3xl leading-tight font-bold tracking-tight text-balance md:text-4xl">
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

        <div className="bg-muted/50 flex flex-col items-start gap-4 rounded-2xl border p-6 md:flex-row md:items-center md:justify-between">
          <p className="text-pretty">
            Got an idea for what comes next? Feature requests shape these
            updates.
          </p>
          <Button asChild variant="outline" className="shrink-0 rounded-full">
            <Link href={FEATURE_REQUESTS_URL} target="_blank" rel="noopener noreferrer">
              Request a feature
              <ArrowUpRight className="size-4" />
            </Link>
          </Button>
        </div>
      </div>
    </PageContainer>
  );
}
