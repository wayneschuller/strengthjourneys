/** @format */
// pages/timer.js

"use client";

import Head from "next/head";
import React, { useState, useEffect, useContext } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useTimer } from "@/hooks/use-timer";
import { devLog } from "@/lib/processing-utils";
import { NextSeo } from "next-seo";

import { fetchRelatedArticles } from "@/lib/sanity-io.js";
import { RelatedArticles } from "@/components/article-cards";
import { PageContainer } from "@/components/page-header";

export async function getStaticProps() {
  const RELATED_ARTICLES_CATEGORY = "Gym Timer";
  const relatedArticles = await fetchRelatedArticles(RELATED_ARTICLES_CATEGORY);

  return {
    props: {
      relatedArticles,
    },
    revalidate: 60 * 60,
  };
}

/**
 * Lifting Set Timer page. Renders SEO metadata and a full-screen countdown/stopwatch timer
 * suitable for use at the gym on phones or large displays.
 * @param {Object} props
 * @param {Array} props.relatedArticles - CMS articles related to the Gym Timer topic, fetched via ISR.
 */
export default function Timer({ relatedArticles }) {
  // const { time } = useTimer();

  // OG Meta Tags
  const canonicalURL = "https://www.strengthjourneys.xyz/timer";
  const title = "Gym Timer | Strength Journeys";
  const ogImageURL =
    "https://www.strengthjourneys.xyz/strength_journeys_timer_og.png";
  const description =
    "World's greatest gym timer app. Perfect for tracking lifting sets, rest periods, and overall workout duration. Hulk lift big. Hulk smash timer space bar.";
  const keywords =
    "gym timer, workout timer, lifting set timer, rest period tracker, strength training app, fitness timer, exercise timer, workout management, interval timer, weight lifting timer, strength journeys, fitness app";

  return (
    <PageContainer>
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
              alt: "Strength Journeys Strength Level Calculator",
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

      <section className="flex flex-col items-center">
        <h1 className="scroll-m-20 text-center text-4xl font-extrabold tracking-tight md:hidden lg:text-5xl">
          Lifting Set Timer
        </h1>
        <LargeTimer />
        <RelatedArticles articles={relatedArticles} />
      </section>
    </PageContainer>
  );
}

/**
 * Full-screen timer display with a giant time readout and restart/start-stop/reset controls.
 * Starts automatically on mount and supports spacebar restart via keyboard listener.
 */
function LargeTimer() {
  const {
    time,
    setTime,
    isRunning,
    setIsRunning,
    handleStartStop,
    handleReset,
    handleRestart,
  } = useTimer();

  useEffect(() => {
    // Start the timer on first mount of this page
    setIsRunning(true);
  }, [setIsRunning]); // It only needs to run on [] mount but eslint wants the dependency put in

  useEffect(() => {
    const handleKeyDown = (event) => {
      // Check if the pressed key is 'Space'
      if (event.code === "Space") {
        // Prevent the default action to avoid scrolling the page
        event.preventDefault();
        handleRestart();
      }
    };

    // Add event listener for 'keydown' on window
    window.addEventListener("keydown", handleKeyDown);

    // Cleanup function to remove the event listener
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [setIsRunning, handleRestart]); // The empty array ensures this effect runs only once on mount

  return (
    <div className="flex flex-col items-center">
      <Card
        className="my-10 flex-1 bg-muted ring-4 hover:cursor-pointer hover:ring-blue-900 md:my-5"
        onClick={handleRestart}
      >
        <CardContent>
          <div
            className={`pt-6 text-center text-9xl font-bold tabular-nums md:text-[15rem] lg:text-[20rem] xl:text-[25rem] 2xl:text-[30rem]`}
          >
            {formatTime(time)}
          </div>
        </CardContent>
      </Card>
      <Button
        className="my-2 text-xl tracking-tight hover:ring md:px-6 md:py-8 md:text-3xl lg:text-6xl xl:my-4 xl:px-10 xl:py-20 xl:text-9xl"
        onClick={handleRestart}
      >
        Restart
      </Button>
      <div className="mt-2">
        <button
          className="mx-2 rounded bg-blue-500 px-4 py-2 font-bold text-white hover:bg-blue-700"
          onClick={handleStartStop}
        >
          {isRunning ? "Stop" : "Start"}
        </button>
        <button
          className="mx-2 rounded bg-red-500 px-4 py-2 font-bold text-white hover:bg-red-700"
          onClick={handleReset}
        >
          Reset
        </button>
      </div>
    </div>
  );
}

const formatTime = (totalSeconds) => {
  const minutes = Math.floor(totalSeconds / 60);
  const remainingSeconds = totalSeconds % 60;

  const formattedMinutes = String(minutes).padStart(2, "0");
  const formattedSeconds = String(remainingSeconds).padStart(2, "0");

  return `${formattedMinutes}:${formattedSeconds}`;
};

/**
 * Compact inline timer display used in the site navigation bar. Renders only while the timer is running,
 * showing the elapsed time and restarting on click.
 */
export function MiniTimer() {
  const {
    time,
    setTime,
    isRunning,
    setIsRunning,
    handleStartStop,
    handleReset,
    handleRestart,
  } = useTimer();

  if (!isRunning) return null; // Don't show if not running

  return (
    <div
      className={`cursor-pointer tabular-nums tracking-wide`}
      onClick={() => handleRestart()}
    >
      {formatTime(time)}
    </div>
  );
}
