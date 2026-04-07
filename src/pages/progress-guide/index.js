import Head from "next/head";
import Link from "next/link";
import { NextSeo } from "next-seo";
import { TrendingUp } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";

import {
  PageContainer,
  PageHeader,
  PageHeaderDescription,
  PageHeaderHeading,
} from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { LiftSvg } from "@/components/year-recap/lift-svg";
import { useLiftColors } from "@/hooks/use-lift-colors";
import { bigFourLiftInsightData } from "@/lib/big-four-insight-data";

const CANONICAL_URL = "https://www.strengthjourneys.xyz/progress-guide";

const LIFT_CARDS = bigFourLiftInsightData.map((lift) => ({
  liftType: lift.liftType,
  slug: lift.slug,
  tagline: lift.hubDescription,
}));

export default function ProgressGuideHub() {
  const { getColor } = useLiftColors();
  const prefersReducedMotion = useReducedMotion();

  const title = "Lift Insights and Progress Tracking";
  const description =
    "Technique videos, expert coaching resources, and full personal progress tracking for the big four barbell lifts. Sign in to see your E1RM charts, rep PRs, tonnage, and lift tier progression.";
  const keywords =
    "barbell progress tracker, barbell training guide, squat guide, bench press guide, deadlift guide, strict press guide, lift PR tracker, E1RM progress";

  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        name: title,
        description,
        url: CANONICAL_URL,
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "Home",
            item: "https://www.strengthjourneys.xyz",
          },
          {
            "@type": "ListItem",
            position: 2,
            name: "Lift Insights and Progress Tracking",
            item: CANONICAL_URL,
          },
        ],
      },
    ],
  };

  return (
    <>
      <Head>
        <script type="application/ld+json">
          {JSON.stringify(structuredData)}
        </script>
      </Head>
      <NextSeo
        title={title}
        description={description}
        canonical={CANONICAL_URL}
        openGraph={{
          url: CANONICAL_URL,
          title,
          description,
          type: "website",
          site_name: "Strength Journeys",
        }}
        additionalMetaTags={[{ name: "keywords", content: keywords }]}
      />
      <PageContainer>
        <PageHeader>
          <PageHeaderHeading icon={TrendingUp}>
            Lift Insights and Progress Tracking
          </PageHeaderHeading>
          <PageHeaderDescription>
            Everything for each of the big four barbell lifts in one place:
            curated technique videos, expert coaching resources, and full
            personal progress tracking. Pick a lift to get started.
          </PageHeaderDescription>
        </PageHeader>

        <section className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          {LIFT_CARDS.map((card, index) => {
            const liftColor = getColor(card.liftType);
            return (
              <motion.div
                key={card.slug}
                initial={prefersReducedMotion ? false : { opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  type: "spring",
                  stiffness: 260,
                  damping: 24,
                  delay: prefersReducedMotion ? 0 : index * 0.08,
                }}
              >
                <Link href={`/progress-guide/${card.slug}`} className="block">
                  <Card className="group h-full overflow-hidden transition-shadow hover:shadow-lg">
                    <div
                      className="flex flex-col items-center gap-4 px-6 py-8"
                      style={{
                        background: `linear-gradient(to bottom, ${liftColor}15, transparent)`,
                      }}
                    >
                      <LiftSvg
                        liftType={card.liftType}
                        size="lg"
                        className="transition-transform group-hover:scale-105"
                      />
                      <div className="text-center">
                        <h2 className="text-2xl font-bold">{card.liftType}</h2>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {card.tagline}
                        </p>
                      </div>
                    </div>
                  </Card>
                </Link>
              </motion.div>
            );
          })}
        </section>
      </PageContainer>
    </>
  );
}
