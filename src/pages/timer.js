/** @format */

// pages/timer.js
import Head from "next/head";
import React, { useState, useEffect } from "react";

import { Inter, Fira_Mono } from "next/font/google";
const inter = Inter({ subsets: ["latin"] });
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const Timer = () => {
  const [time, setTime] = useState(1);

  return (
    <>
      <Head>
        <title>{formatTime(time)} (Lifting Timer)</title>
        <meta name="description" content="Lifing Set Timer App" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main
        className={`flex flex-col items-center justify-between pt-4 ${inter.className}`}
      >
        <h1 className="flex-1 scroll-m-20 text-center text-4xl font-extrabold tracking-tight lg:text-5xl ">
          Lifting Set Timer
        </h1>
        <Stopwatch time={time} setTime={setTime} />
      </main>
    </>
  );
};
export default Timer;

function Stopwatch({ time, setTime }) {
  const [isRunning, setIsRunning] = useState(false);

  useEffect(() => {
    let interval;

    if (isRunning) {
      interval = setInterval(() => {
        setTime((prevTime) => prevTime + 1); // Add 1 second
      }, 1000);
    }

    return () => clearInterval(interval);
  }, [isRunning]);

  const handleStartStop = () => {
    setIsRunning((prevIsRunning) => !prevIsRunning);
  };

  const handleReset = () => {
    setIsRunning(false);
    setTime(0);
  };

  const handleRestart = () => {
    setIsRunning(true);
    setTime(0);
  };

  return (
    <>
      <Card className="my-2 bg-muted p-4 ring-4 hover:ring-blue-800 md:my-5 md:p-10">
        <div className="font-mono text-7xl font-bold md:text-9xl lg:text-[15rem] 2xl:text-[25rem]">
          {formatTime(time)}
        </div>
      </Card>
      <Button
        // className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 mx-2 rounded"
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
    </>
  );
}

const formatTime = (totalSeconds) => {
  // const totalSeconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const remainingSeconds = totalSeconds % 60;

  const formattedMinutes = String(minutes).padStart(2, "0");
  const formattedSeconds = String(remainingSeconds).padStart(2, "0");

  // Use a monospaced font to maintain consistent width
  return `${formattedMinutes}:${formattedSeconds}`;
};
