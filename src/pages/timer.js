/** @format */
// pages/timer.js

"use client";

import Head from "next/head";
import React, { useState, useEffect, useContext } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useTimer } from "@/lib/timer-context";
import { devLog } from "@/lib/processing-utils";

export default function Timer() {
  const { time } = useTimer();

  // devLog(`<Timer /> rendering...`);

  return (
    <div className="mx-4 md:mx-[5vw]">
      <Head>
        <title>{formatTime(time) + " (Lifting Timer)"}</title>
        <meta name="description" content="Lifing Set Timer App" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div className="flex flex-col items-center">
        <h1 className="scroll-m-20 text-center text-4xl font-extrabold tracking-tight md:hidden lg:text-5xl">
          Lifting Set Timer
        </h1>
        <LargeTimer />
      </div>
    </div>
  );
}

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
  }, []); // The empty array ensures this effect runs only once on mount

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
