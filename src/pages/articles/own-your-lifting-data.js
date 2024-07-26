import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import Image from "next/image";
import SampleImage from "/public/sample_google_sheet_fuzzy_border.png";

const googleSheetSampleURL =
  "https://docs.google.com/spreadsheets/d/14J9z9iJBCeJksesf3MdmpTUmo2TIckDxIQcTx1CPEO0/edit#gid=0";

export default function Article() {
  return (
    <div className="mx-4 flex items-center justify-center">
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
        <h1>The Power of Owning Your Lifting Data with Google Sheets</h1>
        <h3>by Strength Journeys Staff</h3>
      </header>

      <p>
        As lifters we invest countless hours in the gym, pushing our limits and
        striving for progress. But are we giving the same attention to our
        lifting data? Here's why owning your strength journey matters and how{" "}
        <a href={googleSheetSampleURL}>Google Sheets</a> can be your ultimate
        workout companion.
      </p>

      <h2>1. Lifting: A Lifelong Journey</h2>
      <p>
        For many of us, lifting isn't just a hobby—it's a lifelong passion. Each
        rep, set, and PR tells a story of dedication and growth. Wouldn't it be
        a shame to lose that narrative?
      </p>

      <h2>2. Beyond Fitness Apps</h2>
      <p>
        While fitness apps and services are convenient, relying solely on them
        can be risky. What if the app shuts down or changes its features? By
        keeping your own copy of your lifting history, you ensure that your data
        remains accessible, no matter what.
      </p>

      <h2>3. Break Free from Data Silos</h2>
      <p>
        Don't let your hard-earned progress get trapped in a proprietary app. By
        maintaining your own records, you retain control over your data and can
        easily switch between different tracking methods without losing your
        history.
      </p>

      <h2>4. Google Sheets: Your Personal Gym Log</h2>
      <p>
        Enter Google Sheets—a powerful, yet simple tool for tracking your lifts.
        It's fast, works seamlessly on mobile devices, can be accessed anywhere,
        and it works offline. Whether you're planning your next workout or
        logging your latest PR, Google Sheets has you covered. We recommend a
        simple journal style format:
      </p>
      <div className="">
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
      </div>

      <h2>5. Celebrate Your Progress</h2>
      <p>
        While obsessing over numbers isn't necessary, having a record of your
        journey can be incredibly motivating. It's easy to forget how far you've
        come, but with your personal lifting log, you can look back and be
        thankful for past achievements. A full history of your lifting data
        helps you celebrate not just personal records, but also your
        consistency.
      </p>

      <h2>Conclusion</h2>
      <p>
        Owning your lifting data isn't just about numbers—it's about taking
        control of your fitness narrative. By using Google Sheets, you create a
        lasting record of your strength journey. You can use the{" "}
        <a href="https://www.strengthjourneys.xyz/">
          Strength Journeys web app
        </a>{" "}
        to analyze and see your milestones over time.
      </p>
    </article>
  );
}
