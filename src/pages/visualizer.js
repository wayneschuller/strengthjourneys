"use client";

import dynamic from "next/dynamic";
import Head from "next/head";
import { useEffect, useState, useContext } from "react";
import { useSession, signIn } from "next-auth/react";
import { useUserLiftData } from "@/lib/use-userlift-data";
import { ChooseSheetInstructionsCard } from "@/components/instructions-cards";
import { devLog } from "@/lib/processing-utils";
import { useReadLocalStorage } from "usehooks-ts";

// Hack needed to get zoom/pan to work for next.js client
// https://github.com/chartjs/chartjs-plugin-zoom/issues/742
const DynamicHeaderVisualizerChart = dynamic(
  () => import("../components/visualizer-chart"),
  {
    ssr: false,
  },
);

const Visualizer = () => {
  const { data: session } = useSession();
  const { isLoading } = useUserLiftData();
  const ssid = useReadLocalStorage("ssid");

  // devLog(`Visualizer render: `);
  if (!isLoading && session?.user && !ssid)
    return (
      <div className="mt-5 flex flex-1 flex-row justify-center align-middle md:mt-10">
        <ChooseSheetInstructionsCard session={session} />
      </div>
    );

  return (
    <>
      <Head>
        <title>Strength Visualizer (Strength Journeys)</title>
        <meta
          content="Strength Journeys Strength E1RM Visualizer"
          name="description"
        />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <div className="flex flex-col items-center justify-center">
        <h1 className="text-center text-4xl font-extrabold tracking-tight md:hidden lg:text-5xl ">
          Strength Visualizer
        </h1>
        <div
          style={{
            position: "relative",
            // Try to maximise chart size across all screen sizes
            height: "88vh",
            width: "95vw",
          }}
        >
          <DynamicHeaderVisualizerChart />
        </div>
      </div>
    </>
  );
};
export default Visualizer;
