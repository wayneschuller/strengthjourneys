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
import SampleImage from "/public/sample_google_sheet_fuzzy_border.png";

const title = "The Power of Owning Your Lifting Data with Google Sheets";

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
        <h1>{title}s</h1>
        <h3>
          by <StrengthJourneys /> Staff
        </h3>
      </header>

      <p>
        As lifters, we invest countless hours in the gym, pushing our limits and
        striving for progress. But are we giving the same attention to our
        lifting data? Here’s why taking ownership of your strength journey
        matters and how{" "}
        <a href={googleSheetSampleURL} target="_blank">
          Google Sheets
        </a>{" "}
        can empower you as your ultimate workout companion.
      </p>

      <h2>1. Lifting For Life</h2>
      <p>
        Remember this: Lifting is a lifelong journey. When we start lifting,
        imagining where we will be in 5, 10, or even 20 years of exercise isn’t
        easy. Lifting begins as just a hobby and then grows into a lifelong
        passion. In the second half of life, lifting becomes a key to thriving.
        Each rep, set, and PR tells a story of dedication and growth. We
        shouldn’t let go of that story.
      </p>

      <h2>2. Beyond Fitness Apps and Data Silos</h2>
      <p>
        While fitness apps and services are convenient, it’s important to be
        aware of the potential risks of relying solely on them. What if the app
        shuts down or changes its features? These are valid concerns that could
        affect your lifting journey. By keeping your own copy of your lifting
        history, you ensure that your data remains secure and accessible, no
        matter what.
      </p>
      <p>
        If you have a preferred fitness app, that is great! We recommend dual
        recording into both your preferred app and also your system. Over the
        years, most lifters will likely change fitness apps occasionally. By
        maintaining your own records, you retain control over your data in the
        long term.
      </p>
      <p>
        (Note: we are working on importers to help read data from popular
        fitness apps into a more general CSV format)
      </p>

      <h2>3. Google Sheets: Your Personal Gym Log</h2>
      <p>
        Enter Google Sheets—a powerful yet simple tool for tracking your lifts.
        It’s fast, works seamlessly on mobile devices, can be accessed anywhere,
        and works offline, making it a convenient and comfortable choice for
        your lifting journey. We recommend a simple journal-style format:
      </p>
      <figure>
        <a
          href="https://docs.google.com/spreadsheets/d/14J9z9iJBCeJksesf3MdmpTUmo2TIckDxIQcTx1CPEO0/edit#gid=0"
          target="_blank"
        >
          <Image
            className="w-5/6 md:w-1/2"
            src={SampleImage}
            priority={true}
            alt="Screenshot of sample google sheet data"
          />
        </a>
        <figcaption>Click image to open our sample data template</figcaption>
      </figure>

      <h2>4. Celebrate Your Progress</h2>
      <p>
        While obsessing over numbers isn’t necessary, having a record of your
        journey can be incredibly motivating. It’s easy to forget how far you’ve
        come, but with your lifting log, you can look back and be thankful for
        past achievements. A complete history of your lifting data helps you
        celebrate consistency as well as memorable barbell moments.
      </p>

      <h2>Conclusion</h2>
      <p>
        Owning your lifting data isn’t just about numbers—it’s about taking
        control of your fitness narrative. Using Google Sheets, you create a
        lasting record of your strength journey. The <StrengthJourneys /> web
        app instantly enables you to analyze and track this progress over time.
      </p>
    </article>
  );
}
