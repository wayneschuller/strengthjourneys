/** @format */
// pages/timer.js

"use client";

import Head from "next/head";
import React, { useState, useEffect, useContext } from "react";
import { GeistMono } from "geist/font/mono"; // Monospace font for stopwatch fixed width

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useTimer } from "@/lib/timer-context";

export default function Timer() {
  const { time } = useTimer();

  return (
    <div className="mx-4 md:mx-[5vw]">
      <Head>
        <title>{formatTime(time) + " (Lifting Timer)"}</title>
        <meta name="description" content="Lifing Set Timer App" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div className="flex flex-col items-center">
        <h1 className="scroll-m-20 text-center text-4xl font-extrabold tracking-tight md:hidden lg:text-5xl ">
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

  return (
    <div className="flex flex-col items-center">
      <Card
        className="my-10 flex-1 bg-muted ring-4 hover:bg-muted/80 hover:ring-blue-900 md:my-5"
        onClick={handleRestart}
      >
        <CardContent>
          <div
            className={`${GeistMono.className} pt-6 text-center font-mono text-9xl font-bold md:text-[15rem] lg:text-[20rem] xl:text-[25rem] 2xl:text-[30rem]`}
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

  if (time === 1) return null; // Don't show if not running

  return <div>{time}</div>;
}
