import Link from "next/link";

import { useAthleteBioData } from "@/lib/use-athlete-biodata";
import { useUserLiftingData } from "@/lib/use-userlift-data";
import { useSession } from "next-auth/react";
import { devLog } from "@/lib/processing-utils";
import { StandardsSlider } from "@/components/standards-slider";
import { NextSeo } from "next-seo";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import {
  PageHeader,
  PageHeaderHeading,
  PageHeaderDescription,
} from "@/components/page-header";

import {
  LiftTypeSummaryStatistics,
  LiftTypeRepPRsAccordion,
  LiftTypeRecentHighlights,
} from "@/components/analyzer/lift-achievements-card";

import { VisualizerMini } from "@/components/visualizer/visualizer-mini";

const googleSheetSampleURL =
  "https://docs.google.com/spreadsheets/d/14J9z9iJBCeJksesf3MdmpTUmo2TIckDxIQcTx1CPEO0/edit#gid=0";

const StrengthJourneys = () => (
  <span className="mx-1 text-blue-600 underline visited:text-purple-600 hover:text-blue-800">
    <Link href="/">Strength Journeys</Link>
  </span>
);

import { bigFourLiftInsightData } from "@/lib/big-four-insight-data";

export async function getStaticPaths() {
  const paths = bigFourLiftInsightData.map((lift) => ({
    params: { lift: lift.slug },
  }));
  return { paths, fallback: false };
}

export async function getStaticProps({ params }) {
  const liftData = bigFourLiftInsightData.find(
    (lift) => lift.slug === params.lift,
  );
  return {
    props: {
      liftInsightData: liftData,
    },
  };
}

export default function BigFourBarbellInsights({ liftInsightData }) {
  return (
    <>
      <NextSeo
        title={liftInsightData.pageTitle}
        description={liftInsightData.pageDescription}
        canonical={liftInsightData.canonicalURL}
        openGraph={{
          url: liftInsightData.canonicalURL,
          title: liftInsightData.pageTitle,
          description: liftInsightData.pageDescription,
          type: "website",
          images: [
            {
              url: liftInsightData.ogImageURL,
              alt: liftInsightData.pageTitle,
            },
          ],
          site_name: "Strength Journeys",
        }}
        twitter={{
          handle: "@wayneschuller",
          site: "@wayneschuller",
          cardType: "summary_large_image",
        }}
        additionalMetaTags={[
          {
            name: "keywords",
            content: liftInsightData.pageKeywords,
          },
        ]}
      />
      <BarbellInsightsMain liftInsightData={liftInsightData} />
    </>
  );
}

function BarbellInsightsMain({ liftInsightData }) {
  const {
    parsedData,
    topLiftsByTypeAndReps,
    topLiftsByTypeAndRepsLast12Months,
  } = useUserLiftingData();
  const { status: authStatus } = useSession();

  return (
    <div className="container">
      <PageHeader>
        <PageHeaderHeading icon={liftInsightData.liftIcon}>
          {liftInsightData.pageTitle}
        </PageHeaderHeading>
        <PageHeaderDescription className="max-w-full">
          <div className="italic">{liftInsightData.liftQuote}</div>
          <div>{liftInsightData.liftQuoteAuthor}</div>
        </PageHeaderDescription>
      </PageHeader>

      <div className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-3">
        <div className="col-span-3">
          <StrengthLevelsCard liftType={liftInsightData.liftType} />
        </div>
        {/* <div className="col-span-3 flex flex-col gap-6 lg:flex-row"> */}
        <div className="col-span-3 grid grid-cols-1 gap-6 lg:grid-cols-3">
          <MyLiftTypeSummaryCard liftType={liftInsightData.liftType} />
          <MyLiftTypeRecentHighlightsCard liftType={liftInsightData.liftType} />
          <HowStrong liftType={liftInsightData.liftType} />
        </div>
        <div className="col-span-3">
          <VisualizerMini liftType="Back Squat" />
        </div>
        <div className="col-span-3">
          <MyLiftTypePRsCard liftType={liftInsightData.liftType} />
        </div>
        <div className="col-span-3">
          <VideoCard
            liftType={liftInsightData.liftType}
            videos={liftInsightData.videos}
          />
        </div>
      </div>
    </div>
  );
}

function MyLiftTypeSummaryCard({ liftType }) {
  const { status: authStatus } = useSession();
  return (
    <Card>
      <CardHeader>
        <CardTitle>My {liftType} Summary</CardTitle>
      </CardHeader>
      <CardContent>
        {authStatus === "authenticated" ? (
          <LiftTypeSummaryStatistics liftType={liftType} />
        ) : (
          <div>Login to see your data</div>
        )}
      </CardContent>
    </Card>
  );
}

function MyLiftTypePRsCard({ liftType }) {
  const { status: authStatus } = useSession();
  return (
    <Card>
      <CardHeader>
        <CardTitle>My {liftType} PRs</CardTitle>
      </CardHeader>
      <CardContent>
        {authStatus === "authenticated" ? (
          <LiftTypeRepPRsAccordion liftType={liftType} />
        ) : (
          <div>Login to see your data</div>
        )}
      </CardContent>
    </Card>
  );
}

function MyLiftTypeRecentHighlightsCard({ liftType }) {
  const {
    parsedData,
    topLiftsByTypeAndReps,
    topLiftsByTypeAndRepsLast12Months,
  } = useUserLiftingData();
  const { status: authStatus } = useSession();

  return (
    <Card>
      <CardHeader>
        <CardTitle>My {liftType} Recent Highlights</CardTitle>
      </CardHeader>
      <CardContent>
        {authStatus === "authenticated" ? (
          <LiftTypeRecentHighlights liftType={liftType} />
        ) : (
          <div>Login to see your data</div>
        )}
      </CardContent>
    </Card>
  );
}

function HowStrong({ liftType }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>How Strong Should My {liftType} Be?</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <p>
          The barbell squat is one of the most effective exercises for building
          strength and muscle mass. The amount of weight you should be able to
          squat depends on your body weight, fitness level, and experience with
          the exercise.
        </p>
        <p>
          As a general guideline, a beginner should be able to squat their body
          weight for 5 reps, an intermediate lifter should be able to squat 1.5
          times their body weight for 5 reps, and an advanced lifter should be
          able to squat 2 times their body weight for 5 reps.
        </p>
        <p>
          {`On the chart below you can visualize your strength level by clicking
          the checkbox for "Show Bodyweight Multiples" or "Show Strength
          Standards"`}
        </p>
      </CardContent>
    </Card>
  );
}

function StrengthLevelsCard({ liftType }) {
  const { age, sex, bodyWeight, isMetric } = useAthleteBioData();
  const unitType = isMetric ? "kg" : "lb";

  return (
    <Card>
      <CardHeader>
        <CardTitle>My {liftType} Strength Rating</CardTitle>
        <CardDescription>
          Standards for a {age} year old {sex}, weighing {bodyWeight}
          {unitType}. Go to the{" "}
          <Link href="/strength-level-calculator">
            Strength Levels Calculator
          </Link>{" "}
          to modify bio details.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <StandardsSlider liftType={liftType} />
      </CardContent>
    </Card>
  );
}

function VideoCard({ liftType, videos }) {
  return (
    <Card className="">
      <CardHeader>
        <CardTitle>{liftType} Video Guides</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex h-fit flex-col gap-8 lg:flex-row">
          {videos.map((videoUrl, index) => (
            <div key={index} className="aspect-video max-h-80 flex-1">
              <iframe
                src={videoUrl}
                title={`YouTube video player ${index}`}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                className="h-full w-full"
              ></iframe>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
