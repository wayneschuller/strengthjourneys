import Head from "next/head";
import Link from "next/link";
import { useMemo } from "react";

import { NextSeo } from "next-seo";
import {
  ArrowDown,
  BookOpen,
  Dumbbell,
  Flame,
  Target,
  Zap,
} from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  PageContainer,
  PageHeader,
  PageHeaderDescription,
  PageHeaderHeading,
} from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { StandardsSlider } from "@/components/standards-slider";
import { LiftJourneyCard } from "@/components/visualizer/lift-journey-card";
import { MostRecentSessionCard } from "@/components/most-recent-session-card";
import { StrengthPotentialBarChart } from "@/components/visualizer/strength-potential-bar-chart";
import { LiftTypeRepPRsDisplay } from "@/components/analyzer/lift-type-prs-display";
import { useAthleteBio } from "@/hooks/use-athlete-biodata";
import { interpolateOlympicStandardKG } from "@/lib/olympic-lifting-standards-kg";

const CANONICAL_URL = "https://www.strengthjourneys.xyz/olympic-lift-insights";

const OLYMPIC_LIFTS = [
  {
    liftType: "Power Clean",
    navLabel: "Power Clean",
    sectionId: "power-clean",
    standardsLiftType: "Clean & Jerk",
    intro:
      "The power clean is the fastest way to teach forceful hip extension, fast elbows, and athletic bar speed without turning the page into a full Olympic lifting textbook.",
    cues: [
      "Push through the floor smoothly and keep the bar close from mid-shin to hip.",
      "Finish the pull with violent leg and hip extension before the elbows turn over.",
      "Catch high on the shoulders with fast elbows and a solid front rack.",
    ],
    videoUrl: "https://www.youtube.com/embed/mLoPwZx90SI",
  },
  {
    liftType: "Power Snatch",
    navLabel: "Power Snatch",
    sectionId: "power-snatch",
    standardsLiftType: "Snatch",
    intro:
      "The power snatch is less about muscling the bar and more about patience off the floor, a violent finish, and punching into a stable overhead catch.",
    cues: [
      "Stay over the bar off the floor and keep the bar close as it passes the knees.",
      "Finish tall through the hips before you pull under.",
      "Punch fast into a stable overhead catch and stand under control.",
    ],
    videoUrl: "https://www.youtube.com/embed/7Jn6uNdmbc0",
  },
];

const FAQ_ITEMS = [
  {
    question: "Why does Strength Journeys group power clean and power snatch on one page?",
    answer:
      "They belong together as the site's explosive barbell lifts. The Big Four pages stay focused on squat, bench, deadlift, and strict press, while this page gives the Olympic-lift variations their own editorial home without pretending they are the same kind of lift.",
  },
  {
    question: "Why use power clean and power snatch instead of the full lifts?",
    answer:
      "The power variations are easier for general strength athletes to recover from, teach aggressive extension and bar speed, and still reward good positions. They are often the best entry point if your goal is getting more explosive without specializing in weightlifting competition.",
  },
  {
    question: "Are these standards exact Kilgore power clean and power snatch tables?",
    answer:
      "No. Kilgore publishes Snatch and Clean & Jerk tables, not separate power clean and power snatch tables. This page uses those published Olympic-lift tables as the closest reference point for the power variations, which is more defensible than the earlier ratio-based placeholder model.",
  },
  {
    question: "What should I focus on first: load or technique?",
    answer:
      "Technique first. These lifts reward speed, timing, and precise bar paths. The page is designed to help you learn the cues, watch solid intro videos, and then use your own training history to see whether the movement is becoming more confident and repeatable over time.",
  },
];

function flattenAnswer(answer) {
  return typeof answer === "string" ? answer : "";
}

function OlympicLiftGuideCard({ lift }) {
  return (
    <Card>
      <CardHeader className="space-y-3">
        <CardTitle>{lift.liftType}</CardTitle>
        <CardDescription>{lift.intro}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-3">
          {lift.cues.map((cue) => (
            <div key={cue} className="flex items-start gap-3 text-sm">
              <Flame className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <p>{cue}</p>
            </div>
          ))}
        </div>
        <div className="aspect-video overflow-hidden rounded-xl border">
          <iframe
            src={lift.videoUrl}
            title={`${lift.liftType} intro video`}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            className="h-full w-full"
          ></iframe>
        </div>
      </CardContent>
    </Card>
  );
}

function OlympicStandardsCard({ lift, standards, isMetric }) {
  if (!standards) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{lift.liftType} Standards</CardTitle>
          <CardDescription>
            Connect age, sex, and bodyweight details to see standards here.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{lift.liftType} Standards</CardTitle>
        <CardDescription>
          Uses the published Kilgore {lift.standardsLiftType} standards as the
          benchmark reference for this power variation.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <StandardsSlider
          liftType={lift.liftType}
          standards={standards}
          isMetric={isMetric}
          hideRating
        />
      </CardContent>
    </Card>
  );
}

function OlympicTrackingSection({ liftType, sectionId }) {
  return (
    <section id={sectionId} className="space-y-5 scroll-mt-24">
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight">{liftType} Tracking</h2>
        <p className="max-w-3xl text-sm text-muted-foreground">
          These widgets pull from the same underlying log data as Lift Explorer,
          but keep the focus on one Olympic-lift pattern at a time so you can
          spot whether technique work is turning into repeatable numbers.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <LiftJourneyCard liftType={liftType} />
        <StrengthPotentialBarChart liftType={liftType} />
        <MostRecentSessionCard liftType={liftType} />
        <Card>
          <CardContent className="pt-6">
            <LiftTypeRepPRsDisplay liftType={liftType} compact />
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

function FaqSection() {
  return (
    <section id="faq" className="scroll-mt-24 space-y-4">
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight">Olympic Lift FAQ</h2>
        <p className="max-w-3xl text-sm text-muted-foreground">
          A few quick answers for lifters who want the power clean and power
          snatch without turning their whole program into weightlifting
          specialization.
        </p>
      </div>
      <div className="space-y-4">
        {FAQ_ITEMS.map((item) => (
          <article key={item.question} className="rounded-xl border p-5">
            <h3 className="text-base font-semibold">{item.question}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{item.answer}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

export default function OlympicLiftInsightsPage() {
  const { age, bodyWeight, isMetric, sex } = useAthleteBio();

  const olympicStandards = useMemo(() => {
    if (!age || !bodyWeight || !sex) return {};

    const bodyWeightKG = isMetric
      ? bodyWeight
      : Math.round(bodyWeight / 2.2046);

    return Object.fromEntries(
      OLYMPIC_LIFTS.map((lift) => {
        const standard = interpolateOlympicStandardKG(
          age,
          bodyWeightKG,
          sex,
          lift.standardsLiftType,
        );

        return [
          lift.liftType,
          !isMetric && standard
            ? {
                physicallyActive: Math.round(standard.physicallyActive * 2.2046),
                beginner: Math.round(standard.beginner * 2.2046),
                intermediate: Math.round(standard.intermediate * 2.2046),
                advanced: Math.round(standard.advanced * 2.2046),
                elite: Math.round(standard.elite * 2.2046),
              }
            : standard,
        ];
      }),
    );
  }, [age, bodyWeight, isMetric, sex]);

  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        name: "Olympic Lift Insights: Power Clean and Power Snatch",
        description:
          "Power clean and power snatch cues, intro videos, Kilgore Olympic-lift standards references, and tracking tools for your Olympic-lift variations.",
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
            name: "Olympic Lift Insights",
            item: CANONICAL_URL,
          },
        ],
      },
      {
        "@type": "FAQPage",
        mainEntity: FAQ_ITEMS.map((item) => ({
          "@type": "Question",
          name: item.question,
          acceptedAnswer: {
            "@type": "Answer",
            text: flattenAnswer(item.answer),
          },
        })),
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
        title="Olympic Lift Insights: Power Clean & Power Snatch"
        description="Power clean and power snatch cues, intro videos, Kilgore Olympic-lift standards references, and tracking tools for lifters who want more speed, power, and better barbell timing."
        canonical={CANONICAL_URL}
        openGraph={{
          url: CANONICAL_URL,
          title: "Olympic Lift Insights: Power Clean & Power Snatch",
          description:
            "Power clean and power snatch cues, intro videos, Kilgore Olympic-lift standards references, and tracking tools for lifters who want more speed, power, and better barbell timing.",
          type: "website",
          images: [
            {
              url: "https://www.strengthjourneys.xyz/202409-og-image.png",
              alt: "Strength Journeys Olympic Lift Insights",
            },
          ],
          site_name: "Strength Journeys",
        }}
      />

      <PageContainer>
        <PageHeader hideRecapBanner>
          <PageHeaderHeading icon={Zap}>
            Olympic Lift Insights: Power Clean & Power Snatch
          </PageHeaderHeading>
          <PageHeaderDescription>
            <p>
              Learn the core cues, see practical standards, watch intro videos,
              and track how your power clean and power snatch are evolving in
              the same log you already use for the rest of your barbell work.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Button asChild>
                <Link href="#standards">
                  See Olympic Lift Standards
                  <ArrowDown className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="#cues-and-videos">Watch Intro Videos</Link>
              </Button>
            </div>
            <nav
              aria-label="Olympic lift page sections"
              className="mt-5 flex flex-wrap gap-x-4 gap-y-2 border-y py-3 text-sm text-muted-foreground"
            >
              <Link href="#why-olympic-lifts" className="hover:text-foreground">
                Why These Lifts
              </Link>
              <Link href="#cues-and-videos" className="hover:text-foreground">
                Cues & Videos
              </Link>
              <Link href="#standards" className="hover:text-foreground">
                Standards
              </Link>
              <Link href="#power-clean" className="hover:text-foreground">
                Power Clean
              </Link>
              <Link href="#power-snatch" className="hover:text-foreground">
                Power Snatch
              </Link>
              <Link href="#faq" className="hover:text-foreground">
                FAQ
              </Link>
            </nav>
          </PageHeaderDescription>
        </PageHeader>

        <div className="space-y-10">
          <section id="why-olympic-lifts" className="scroll-mt-24">
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
              <Card className="xl:col-span-2">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Dumbbell className="h-5 w-5" />
                    Why power clean and power snatch belong here
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-sm text-muted-foreground">
                  <p>
                    The Big Four still carry the main identity of Strength
                    Journeys, but the Olympic-lift variations deserve a home of
                    their own because they solve a different problem. They teach
                    speed, timing, aggression, and bar path discipline in a way
                    the slower strength lifts do not.
                  </p>
                  <p>
                    This page is built for lifters who want an editorial guide
                    rather than a giant lift directory. Lift Explorer still
                    works for any lift in your log. This page is the curated
                    version: practical cues, reference standards, and a handful
                    of tracking tools focused on the two power variations that
                    fit most naturally into general strength training.
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BookOpen className="h-5 w-5" />
                    What this page does
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm text-muted-foreground">
                  <p>Start with plain-language cues and one good intro video per lift.</p>
                  <p>Use the standards section as a quick reality check on where your Olympic-lift variations are headed.</p>
                  <p>Then drop into your own progress charts, recent sessions, PRs, and lift potential to see whether technique work is sticking.</p>
                </CardContent>
              </Card>
            </div>
          </section>

          <section id="cues-and-videos" className="scroll-mt-24 space-y-4">
            <div className="space-y-2">
              <h2 className="text-2xl font-semibold tracking-tight">Basic Cues & Intro Videos</h2>
              <p className="max-w-3xl text-sm text-muted-foreground">
                These are intentionally short. Think of them as the cues you
                want in your head on the platform, not an attempt to replace a
                coach or a full technical manual.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
              {OLYMPIC_LIFTS.map((lift) => (
                <OlympicLiftGuideCard key={lift.liftType} lift={lift} />
              ))}
            </div>
          </section>

          <section id="standards" className="scroll-mt-24 space-y-4">
            <div className="space-y-2">
              <h2 className="text-2xl font-semibold tracking-tight">Olympic Lift Standards</h2>
              <p className="max-w-3xl text-sm text-muted-foreground">
                The published Kilgore source material exposes Snatch and Clean &
                Jerk tables, not separate power-variation tables. This page now
                uses those published Olympic-lift standards directly as the
                closest benchmark reference for Power Clean and Power Snatch,
                so your comparison is grounded in the actual Kilgore source
                data rather than a derived placeholder model.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
              {OLYMPIC_LIFTS.map((lift) => (
                <OlympicStandardsCard
                  key={lift.liftType}
                  lift={lift}
                  standards={olympicStandards[lift.liftType]}
                  isMetric={isMetric}
                />
              ))}
            </div>
          </section>

          {OLYMPIC_LIFTS.map((lift) => (
            <OlympicTrackingSection
              key={lift.liftType}
              liftType={lift.liftType}
              sectionId={lift.sectionId}
            />
          ))}

          <FaqSection />
        </div>
      </PageContainer>
    </>
  );
}
