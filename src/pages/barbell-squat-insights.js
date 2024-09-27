import Head from "next/head";
import { useAthleteBioData } from "@/lib/use-athlete-biodata";
import { useUserLiftingData } from "@/lib/use-userlift-data";
import { useSession } from "next-auth/react";
import { devLog } from "@/lib/processing-utils";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { Crown } from "lucide-react";

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

const title = "Barbell Back Squat - The King of Lifts";

const googleSheetSampleURL =
  "https://docs.google.com/spreadsheets/d/14J9z9iJBCeJksesf3MdmpTUmo2TIckDxIQcTx1CPEO0/edit#gid=0";

const StrengthJourneys = () => (
  <span className="mx-1 text-blue-600 underline visited:text-purple-600 hover:text-blue-800">
    <a href="https://www.strengthjourneys.xyz/">Strength Journeys</a>
  </span>
);

// FIXME: do full metadata wrapper

export default function SquatInsightsMain() {
  const {
    parsedData,
    topLiftsByTypeAndReps,
    topLiftsByTypeAndRepsLast12Months,
  } = useUserLiftingData();
  const { status: authStatus } = useSession();

  return (
    <div className="container">
      <PageHeader>
        <PageHeaderHeading icon={Crown}>{title}</PageHeaderHeading>
        <PageHeaderDescription className="max-w-full">
          <div className="italic">{header.quote}</div>
          <div>{header.author}</div>
        </PageHeaderDescription>
      </PageHeader>
      <Head>
        <title>{title}</title>
        <meta name="description" content={title} />
      </Head>

      <div className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-3">
        <div className="col-span-3">
          <StrengthLevelsCard />
        </div>
        <HowStrong />
        <MyBackSquatOverviewCard />
        <MyBackSquatRecentHighlightsCard />
        <div className="col-span-3">
          <MyBackSquatPRsCard />
        </div>
        <div className="col-span-3">
          <VideoCard />
        </div>
      </div>
    </div>
  );
}

function MyBackSquatOverviewCard() {
  const {
    parsedData,
    topLiftsByTypeAndReps,
    topLiftsByTypeAndRepsLast12Months,
  } = useUserLiftingData();
  const { status: authStatus } = useSession();

  if (authStatus !== "authenticated") return null;
  if (!topLiftsByTypeAndReps) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>My Back Squat Summary</CardTitle>
      </CardHeader>
      <CardContent>
        <LiftTypeSummaryStatistics liftType="Back Squat" />
      </CardContent>
    </Card>
  );
}

function MyBackSquatPRsCard() {
  const {
    parsedData,
    topLiftsByTypeAndReps,
    topLiftsByTypeAndRepsLast12Months,
  } = useUserLiftingData();
  const { status: authStatus } = useSession();

  if (authStatus !== "authenticated") return null;
  if (!topLiftsByTypeAndReps) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>My Back Squat PRs</CardTitle>
      </CardHeader>
      <CardContent>
        <LiftTypeRepPRsAccordion liftType="Back Squat" />
      </CardContent>
    </Card>
  );
}

function MyBackSquatRecentHighlightsCard() {
  const {
    parsedData,
    topLiftsByTypeAndReps,
    topLiftsByTypeAndRepsLast12Months,
  } = useUserLiftingData();
  const { status: authStatus } = useSession();

  if (authStatus !== "authenticated") return null;
  if (!topLiftsByTypeAndReps) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>My Back Squat Recent Highlights</CardTitle>
      </CardHeader>
      <CardContent>
        <LiftTypeRecentHighlights liftType="Back Squat" />
      </CardContent>
    </Card>
  );
}

function HowStrong() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>How Strong Should Is My Barbell Squat?</CardTitle>
      </CardHeader>
      <CardContent>
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
      </CardContent>
    </Card>
  );
}

function StrengthLevelsCard() {
  const {
    age,
    setAge,
    isMetric,
    setIsMetric,
    sex,
    setSex,
    bodyWeight,
    setBodyWeight,
    standards,
    toggleIsMetric,
  } = useAthleteBioData();

  if (!standards) return null;
  const squatStandards = standards["Back Squat"];
  if (!squatStandards) return null;

  const unitType = isMetric ? "kg" : "lb";

  return (
    <Card>
      <CardHeader>
        <CardTitle>Back Squat Strength Standards</CardTitle>
        <CardDescription>
          Standards for a {age} year old {sex}, weighing {bodyWeight}
          {unitType}. Go to the{" "}
          <a href="/strength-level-calculator">Strength Levels Calculator</a> to
          modify bio details.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col justify-between gap-2 md:flex-row">
          <div>
            Physically Active: {squatStandards.physicallyActive}
            {unitType}
          </div>
          <div>
            Beginner: {squatStandards.beginner}
            {unitType}
          </div>
          <div>
            Intermediate: {squatStandards.intermediate}
            {unitType}
          </div>
          <div>
            Advanced: {squatStandards.advanced}
            {unitType}
          </div>
          <div>
            Elite: {squatStandards.elite}
            {unitType}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function VideoCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Squat Overview Video Guides</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-8 lg:flex-row">
          <div className="aspect-video flex-1">
            <iframe
              // width="560"
              // height="315"
              src="https://www.youtube.com/embed/C_VtOYc6j5c"
              title="YouTube video player"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              className="h-full w-full"
            ></iframe>
          </div>
          <div className="aspect-video flex-1">
            <iframe
              // width="560"
              // height="315"
              src="https://www.youtube.com/embed/jyopTyOjXb0"
              title="YouTube video player"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              className="h-full w-full"
            ></iframe>
          </div>
          <div className="aspect-video flex-1">
            <iframe
              // width="560"
              // height="315"
              src="https://www.youtube.com/embed/nhoikoUEI8U"
              title="YouTube video player"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              className="h-full w-full"
            ></iframe>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

const header = {
  quote:
    "There is simply no other exercise, and certainly no machine, that produces the level of central nervous system activity, improved balance and coordination, skeletal loading and bone density enhancement, muscular stimulation and growth, connective tissue stress and strength, psychological demand and toughness, and overall systemic conditioning than the correctly performed full squat.",
  author: "Mark Rippetoe, Starting Strength",
};
