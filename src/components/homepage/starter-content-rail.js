/**
 * Reading rail for the signed-in lifter who has not linked a sheet yet.
 *
 * Editorial note: every link here points at our own pages, not straight out to
 * Starting Strength or Barbell Logic. The third-party coaching links already
 * live on the progress guides (see `big-four-insight-data.js`), so a reader who
 * wants Rippetoe still reaches him — one click later, from a page that can bring
 * them back. Sending a freshly signed-in user off-site before they have linked
 * anything is the one thing this surface must not do.
 *
 * The rail is deliberately lighter than the activation CTAs above it. It exists
 * so the no-sheet state has a reason to be revisited, not so it can compete with
 * the fork.
 */

import Link from "next/link";
import Image from "next/image";
import { ArrowRight, BicepsFlexed, Newspaper } from "lucide-react";
import { urlFor } from "@/lib/sanity-io.js";
import { Card, CardContent } from "@/components/ui/card";
import { gaEvent, GA_EVENT_TAGS } from "@/lib/analytics";

const articleDateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  year: "numeric",
});

function formatArticleDate(publishedAt) {
  if (!publishedAt) return null;
  const parsed = new Date(publishedAt);
  if (Number.isNaN(parsed.getTime())) return null;
  return articleDateFormatter.format(parsed);
}

/**
 * A single rail tile. Kept local so the article and evergreen tiles share one
 * shape — the rail reads as a row of equals rather than a hero plus filler.
 */
function RailCard({ href, eyebrow, title, description, thumbnail, icon: Icon, onClick }) {
  return (
    <Card className="group ring-ring h-full shadow-sm ring-0 transition hover:ring-1">
      <Link href={href} onClick={onClick} className="block h-full">
        <CardContent className="flex h-full gap-3 p-4">
          {thumbnail ? (
            <div className="relative hidden h-16 w-16 shrink-0 overflow-hidden rounded-md sm:block">
              <Image
                src={thumbnail}
                alt=""
                fill
                sizes="64px"
                className="object-cover transition-transform duration-300 group-hover:scale-110"
                aria-hidden
              />
            </div>
          ) : Icon ? (
            <div className="text-muted-foreground hidden h-16 w-16 shrink-0 items-center justify-center rounded-md border sm:flex">
              <Icon className="h-7 w-7" strokeWidth={1.5} />
            </div>
          ) : null}
          <div className="flex min-w-0 flex-col justify-center">
            <span className="text-muted-foreground blueprint:font-mono blueprint:tracking-wider blueprint:uppercase text-[11px]">
              {eyebrow}
            </span>
            <span className="line-clamp-2 text-sm leading-snug font-semibold">
              {title}
            </span>
            {description && (
              <span className="text-muted-foreground mt-0.5 line-clamp-2 text-xs leading-tight">
                {description}
              </span>
            )}
          </div>
        </CardContent>
      </Link>
    </Card>
  );
}

/**
 * Row of starting-out reading for signed-in lifters without a linked sheet.
 * Shows up to two featured Sanity articles alongside an evergreen strength
 * standards tile, then a quiet link into the full library.
 *
 * Degrades to the evergreen tile alone when the Sanity fetch returned nothing,
 * so a CMS outage cannot leave a heading with an empty row under it.
 *
 * @param {Object} props
 * @param {Array<{slug: string, title: string, description?: string, publishedAt?: string, mainImage?: Object}>} [props.articles=[]]
 *   Featured articles from the home page's getStaticProps.
 */
export function StarterContentRail({ articles = [] }) {
  const articleTiles = (articles || []).slice(0, 2).map((article) => {
    let thumbnail = null;
    if (article?.mainImage) {
      try {
        thumbnail = urlFor(article.mainImage)
          .width(160)
          .height(160)
          .fit("crop")
          .quality(75)
          .url();
      } catch {
        thumbnail = null; // A malformed image ref should not take out the rail
      }
    }

    return (
      <RailCard
        key={article.slug}
        href={`/articles/${article.slug}`}
        eyebrow={formatArticleDate(article.publishedAt) || "Article"}
        title={article.title}
        description={article.description}
        thumbnail={thumbnail}
        icon={Newspaper}
        onClick={() =>
          gaEvent(GA_EVENT_TAGS.HOME_WELCOME_ACTION, {
            action: "rail_article",
            destination: `/articles/${article.slug}`,
          })
        }
      />
    );
  });

  return (
    <section className="mt-10">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="text-lg font-semibold">Reading for the road in</h2>
        <Link
          href="/articles"
          onClick={() =>
            gaEvent(GA_EVENT_TAGS.HOME_WELCOME_ACTION, {
              action: "rail_library",
              destination: "/articles",
            })
          }
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs font-medium underline-offset-4 transition-colors hover:underline"
        >
          All articles
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
      <p className="text-muted-foreground mt-1 text-sm">
        Free to read, no sheet required.
      </p>
      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {articleTiles}
        {/* Evergreen anchor. "How strong is strong" is the question a new lifter
            actually has — far more useful than telling them to go find starting
            weights they have no way of knowing yet. */}
        <RailCard
          href="/strength-levels"
          eyebrow="Strength standards"
          title="How strong is strong?"
          description="What beginner, intermediate, advanced and elite actually mean for the Big Four at your bodyweight."
          icon={BicepsFlexed}
          onClick={() =>
            gaEvent(GA_EVENT_TAGS.HOME_WELCOME_ACTION, {
              action: "rail_standards",
              destination: "/strength-levels",
            })
          }
        />
      </div>
    </section>
  );
}
