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
  <a href="https://www.strengthjourneys.xyz/">Strength Journeys</a>
);

export default function Article() {
  return (
    // <div className="mx-4 mb-10 flex items-center justify-center">
    <div className="mx-4 mb-4 md:mx-[5vw]">
      <Head>
        <title>{title}</title>
        <meta name="description" content={title} />
      </Head>

      <h1 className="mb-8 flex-1 scroll-m-20 text-center text-4xl font-extrabold tracking-tight lg:text-5xl">
        {title}
      </h1>
      <h3 className="prose prose-orange flex justify-center dark:prose-invert">
        Resources collated by <StrengthJourneys /> Staff
      </h3>

      <div className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-3">
        <QuotesCard />
        <VideoCard />
      </div>
    </div>
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
