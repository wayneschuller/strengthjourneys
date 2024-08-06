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
    <div className="mx-4 mb-10 flex items-center justify-center">
      <Head>
        <title>{title}</title>
        <meta name="description" content={title} />
      </Head>
      <Card className="shadow-lg shadow-primary-foreground ring-0 ring-black hover:ring-1 dark:ring-white">
        <CardHeader></CardHeader>
        <CardContent>
          <ArticleContent />
        </CardContent>
      </Card>
    </div>
  );
}

function ArticleContent() {
  return (
    <article className="prose prose-orange dark:prose-invert">
      <header>
        <h1>{title}</h1>
        <h3>
          by <StrengthJourneys /> Staff
        </h3>
      </header>
      <iframe
        width="560"
        height="315"
        src="https://www.youtube.com/embed/jyopTyOjXb0"
        title="YouTube video player"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
      ></iframe>
      <iframe
        width="560"
        height="315"
        src="https://www.youtube.com/embed/nhoikoUEI8U"
        title="YouTube video player"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
      ></iframe>
    </article>
  );
}
