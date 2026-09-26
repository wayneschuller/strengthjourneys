/*
 * What's new (/changelog): every changelog entry, newest first, from the
 * markdown files in content/changelog/ rendered at build by
 * src/lib/changelog.js. The newest few show in full and older ones fold to
 * their date, title and section headings. One page rather than a page per
 * entry, so there is no thin duplicate content; an entry is shared by its
 * anchor, /changelog#2026-09-14, which opens it if folded. Opening the page
 * clears the nav's "What's new" dot, and it ends with the feature request
 * card. The full picture is in docs/agents/changelog.md.
 */
import Head from "next/head";
import { useEffect } from "react";
import { ChevronDown, Megaphone } from "lucide-react";

import {
  PageContainer,
  PageHeader,
  PageHeaderHeading,
  PageHeaderDescription,
} from "@/components/page-header";
import { formatArticleDate, PROSE_THEME_STYLE } from "@/components/article-cards";
import { FeatureRequestCard } from "@/components/feedback";
import { useMarkChangelogSeen } from "@/components/ui-shell/whats-new";
import { cn } from "@/lib/utils";

import { getChangelogEntries } from "@/lib/changelog";

const SITE_NAME = "Strength Journeys";
const CANONICAL_URL = "https://www.strengthjourneys.xyz/changelog";
const OG_IMAGE_URL = "https://www.strengthjourneys.xyz/202409-og-image.png";
const PAGE_TITLE = "What's New in Strength Journeys";
const DESCRIPTION =
  "New features and improvements in Strength Journeys, the free barbell strength tracker built on your own Google Sheet.";

// Entries shown in full; older ones start folded. A count rather than an age,
// so a quiet month never leaves the page with nothing open.
const OPEN_ENTRY_COUNT = 3;

const ENTRY_CARD_CLASS =
  "bg-card scroll-mt-24 overflow-hidden rounded-2xl border shadow-sm";
const ENTRY_HEADER_CLASS =
  "bg-muted/50 flex items-center gap-4 px-5 py-6 md:gap-6 md:px-10 md:py-8";
const ENTRY_TITLE_CLASS =
  "min-w-0 text-2xl leading-tight font-bold tracking-tight text-balance md:text-4xl";

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
  useOpenLinkedEntry();
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
        <PageHeaderHeading icon={Megaphone}>{PAGE_TITLE}</PageHeaderHeading>
        <PageHeaderDescription>
          What has landed lately, newest first.
        </PageHeaderDescription>
      </PageHeader>

      <div className="mx-auto max-w-3xl space-y-10 pb-16 md:space-y-14">
        {/* Each entry is its own card so a long run of screenshots never
            blurs into the next release. The newest few stay open; older ones
            fold down to their date, title and section list. */}
        {entries.map((entry, index) =>
          index < OPEN_ENTRY_COUNT ? (
            <article key={entry.slug} id={entry.slug} className={ENTRY_CARD_CLASS}>
              <header className={cn(ENTRY_HEADER_CLASS, "border-b")}>
                <EntryDateTile date={entry.date} />
                <h2 className={ENTRY_TITLE_CLASS}>
                  <a href={`#${entry.slug}`} className="hover:underline">
                    {entry.title}
                  </a>
                </h2>
              </header>
              <EntryBody html={entry.html} />
            </article>
          ) : (
            <article key={entry.slug} id={entry.slug} className={ENTRY_CARD_CLASS}>
              {/* Native details: no JS to open, and the body stays in the HTML
                  for search while its lazy images wait until it is opened. */}
              <details className="group">
                <summary
                  className={cn(
                    ENTRY_HEADER_CLASS,
                    "hover:bg-muted cursor-pointer list-none transition-colors group-open:border-b [&::-webkit-details-marker]:hidden",
                  )}
                >
                  <EntryDateTile date={entry.date} />
                  <div className="min-w-0 flex-1">
                    <h2 className={ENTRY_TITLE_CLASS}>{entry.title}</h2>
                    {entry.sections.length > 0 && (
                      <p className="text-muted-foreground mt-2 line-clamp-2 text-sm text-pretty group-open:hidden md:text-base">
                        {entry.sections.join(" · ")}
                      </p>
                    )}
                  </div>
                  <ChevronDown
                    aria-hidden="true"
                    className="text-muted-foreground size-6 shrink-0 transition-transform group-open:rotate-180"
                  />
                </summary>
                <EntryBody html={entry.html} />
              </details>
            </article>
          ),
        )}

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
      <span className="text-foreground/70 pt-1 pb-1.5 text-sm leading-none font-bold tabular-nums md:text-lg">
        {day.getUTCFullYear()}
      </span>
    </time>
  );
}

// Built from the repo's own markdown at build time; raw HTML in the source is
// dropped by the renderer, so this is not user input.
function EntryBody({ html }) {
  return (
    <div
      className="prose prose-lg prose-headings:tracking-tight prose-headings:text-balance prose-h3:mt-10 prose-h3:text-2xl prose-h3:font-bold prose-a:decoration-2 prose-a:underline-offset-4 prose-a:transition-colors prose-li:marker:text-muted-foreground max-w-none px-5 py-6 md:px-10 md:py-8 md:[&_figure]:mx-0"
      style={PROSE_THEME_STYLE}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

// A shared link like /changelog#2026-04-07 should land on that entry open,
// even though it starts folded.
function useOpenLinkedEntry() {
  useEffect(() => {
    function openTarget() {
      const id = decodeURIComponent(window.location.hash.slice(1));
      const details = id && document.getElementById(id)?.querySelector("details");
      if (!details || details.open) return;
      details.open = true;
      details.closest("article")?.scrollIntoView();
    }
    openTarget();
    window.addEventListener("hashchange", openTarget);
    return () => window.removeEventListener("hashchange", openTarget);
  }, []);
}
