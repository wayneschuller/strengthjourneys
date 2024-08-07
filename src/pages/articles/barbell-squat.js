import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import Head from "next/head";
import Image from "next/image";

const title = "Barbell Back Squat - The King of Lifts";

const googleSheetSampleURL =
  "https://docs.google.com/spreadsheets/d/14J9z9iJBCeJksesf3MdmpTUmo2TIckDxIQcTx1CPEO0/edit#gid=0";

const StrengthJourneys = () => (
  <span className="mx-1 text-blue-600 underline visited:text-purple-600 hover:text-blue-800">
    <a href="https://www.strengthjourneys.xyz/">Strength Journeys</a>
  </span>
);

export default function Article() {
  return (
    // <div className="mx-4 mb-10 flex items-center justify-center">
    <div className="mx-4 mb-4 md:mx-[5vw]">
      <Head>
        <title>{title}</title>
        <meta name="description" content={title} />
      </Head>

      <h1 className="mb-4 flex-1 scroll-m-20 text-center text-4xl font-extrabold tracking-tight lg:text-5xl">
        {title}
      </h1>
      <h2 className="flex justify-center text-2xl">
        Resources collated by <StrengthJourneys /> staff
      </h2>

      <div className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-3">
        <HowStrong />
        <QuotesCard />
        <VideoCard />
      </div>
    </div>
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
function QuotesCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Quotes on the Back Squat</CardTitle>
      </CardHeader>
      <CardContent>
        “There is simply no other exercise, and certainly no machine, that
        produces the level of central nervous system activity, improved balance
        and coordination, skeletal loading and bone density enhancement,
        muscular stimulation and growth, connective tissue stress and strength,
        psychological demand and toughness, and overall systemic conditioning
        than the correctly performed full squat.” ― Mark Rippetoe, Starting
        Strength
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
        <div className="flex flex-col gap-4">
          <iframe
            // width="560"
            height="315"
            src="https://www.youtube.com/embed/C_VtOYc6j5c"
            title="YouTube video player"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          ></iframe>
          <iframe
            // width="560"
            height="315"
            src="https://www.youtube.com/embed/jyopTyOjXb0"
            title="YouTube video player"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          ></iframe>
          <iframe
            // width="560"
            height="315"
            src="https://www.youtube.com/embed/nhoikoUEI8U"
            title="YouTube video player"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          ></iframe>
        </div>
      </CardContent>
    </Card>
  );
}
