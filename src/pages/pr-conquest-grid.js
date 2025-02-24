"use client";

import Head from "next/head";
import { useSession } from "next-auth/react";
import { useState, useEffect } from "react";
import { NextSeo } from "next-seo";
import { useUserLiftingData } from "@/lib/use-userlift-data";
import { ChooseSheetInstructionsCard } from "@/components/instructions-cards";
import { useReadLocalStorage } from "usehooks-ts";
import { Separator } from "@/components/ui/separator";
import { devLog } from "@/lib/processing-utils";
import { RelatedArticles } from "@/components/article-cards";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import {
  PageHeader,
  PageHeaderHeading,
  PageHeaderDescription,
} from "@/components/page-header";
import { Trophy, Grid2x2Check } from "lucide-react";

import { fetchRelatedArticles } from "@/lib/sanity-io.js";
import { parse } from "date-fns";

export async function getStaticProps() {
  const RELATED_ARTICLES_CATEGORY = "Personal Record Analyzer";
  const relatedArticles = await fetchRelatedArticles(RELATED_ARTICLES_CATEGORY);

  return {
    props: {
      relatedArticles,
    },
    revalidate: 60 * 60,
  };
}

export default function ConquestGrid({ relatedArticles }) {
  // OG Meta Tags
  const description =
    "Unlock free insights into your strength training with our PR Analyzer. Track PRs, consistency and detailed squat/bench/deadlift analysis.";
  const title = "PR Conquest Grid | Strength Journeys";
  const canonicalURL = "https://www.strengthjourneys.xyz/analyzer";
  const ogImageURL =
    "https://www.strengthjourneys.xyz/strength_journeys_analyzer_og.png";
  const keywords =
    "strength training, PR analyzer, workout progress, consistency tracking, monthly highlights, lifting journey, strength gains, personal records, workout heatmap, lift frequency analysis, strength progress reports, fitness data visualization";

  return (
    <>
      <NextSeo
        title={title}
        description={description}
        canonical={canonicalURL}
        openGraph={{
          url: canonicalURL,
          title: title,
          description: description,
          type: "website",
          images: [
            {
              url: ogImageURL,
              alt: "Strength Journeys PR Conquest Grid",
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
            content: keywords,
          },
        ]}
      />
      {/* Keep the main component separate. I learned the hard way if it breaks server rendering you lose static metadata tags */}
      <ConquestGridMain relatedArticles={relatedArticles} />
    </>
  );
}

function ConquestGridMain({ relatedArticles }) {
  const { data: session, status: authStatus } = useSession();
  const {
    parsedData,
    topLiftsByTypeAndReps,
    topLiftsByTypeAndRepsLast12Months,
    isLoading,
  } = useUserLiftingData();
  const ssid = useReadLocalStorage("ssid");

  if (!isLoading && authStatus === "authenticated" && !ssid)
    return (
      <div className="mt-5 flex flex-1 flex-row justify-center align-middle md:mt-10">
        <ChooseSheetInstructionsCard session={session} />
      </div>
    );

  const weightCounts = processConquestGrid(parsedData, "Bench Press");
  devLog(weightCounts);

  return (
    <div className="container">
      <PageHeader>
        <PageHeaderHeading icon={Grid2x2Check}>
          PR Conquest Grid
        </PageHeaderHeading>
        <PageHeaderDescription>
          Track and conquer your barbell lifting PRs with the PR Conquest Map, a
          precise grid visualizing your PRs at different rep schemes. Dark green
          marks achieved PRs, light green indicates guaranteed new PRs, and
          light yellow highlights probable challenges, offering a serious,
          data-driven approach to measure and expand your strength progress.
        </PageHeaderDescription>
      </PageHeader>
      {!isLoading && parsedData && (
        <Card className="mt-6 shadow-lg">
          <CardHeader>
            <CardTitle>Bench Press Frequency Table</CardTitle>
          </CardHeader>
          <CardContent>
            <table className="mt-4 w-full table-auto border-collapse">
              <tbody>
                <tr>
                  <th className="border px-4 py-2 text-center">Weight (kg)</th>
                  {[...Array(10).keys()].map((rep) => (
                    <th key={rep} className="border px-4 py-2 text-center">
                      {rep + 1} {rep + 1 === 1 ? "Rep" : "Reps"}
                    </th>
                  ))}
                </tr>
                {Object.entries(weightCounts).map(([weight, counts]) => (
                  <tr key={weight} className="">
                    <td className="border px-4 py-2 text-center">{weight}kg</td>
                    {counts.map((count, index) => (
                      <td key={index} className="border px-4 py-2 text-center">
                        {count}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      <RelatedArticles articles={relatedArticles} />
    </div>
  );
}

// Process the parsedData to get the conquest grid info needed
export function processConquestGrid(parsedData, liftType = "Bench Press") {
  if (!parsedData) return null;

  const startTime = performance.now();
  const today = new Date().toISOString().slice(0, 10); // Format today's date as "YYYY-MM-DD"
  const startDate = "1900-01-01"; // FIXME: Later we will add custom start dates

  const commonWeights = [
    20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120, 130, 140, 150,
  ];

  const weightCounts = commonWeights.reduce((acc, weight) => {
    acc[weight] = Array(10).fill(0); // Create an array of size 10 for reps 1 to 10
    return acc;
  }, {});

  // Loop backwards through the parsed data
  // Count how many times each common weight was lifted for reps between 1 and 10
  for (let i = parsedData.length - 1; i >= 0; i--) {
    const entryDate = parsedData[i].date; // Directly use the date string

    if (entryDate < startDate) break; // Stop if we've reached the start date

    if (parsedData[i].isGoal) continue; // Don't count entries that are just dreams

    const reps = parsedData[i].reps;
    if (reps < 1 || reps > 10) continue; // Only count reps between 1 and 10

    if (parsedData[i].liftType !== liftType) continue; // Only count the specified lift type

    const weight = parsedData[i].weight;

    if (!commonWeights.includes(weight)) continue; // Only count weights in the commonWeights array

    // Increment the count for this weight and rep
    weightCounts[weight][reps - 1]++;
  }

  devLog(
    "processConquestGrid execution time: " +
      `${Math.round(performance.now() - startTime)}ms`,
  );

  return weightCounts;
}
