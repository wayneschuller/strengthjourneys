"use client";

import dynamic from "next/dynamic";
import Head from "next/head";
import { useEffect, useState, useContext } from "react";
import { useSession, signIn } from "next-auth/react";
import useUserLiftData from "@/lib/useUserLiftData";
import InstructionsCard from "@/components/InstructionsCard";
import { devLog } from "@/lib/SJ-utils";
import { useReadLocalStorage } from "usehooks-ts";

// Hack needed to get zoom/pan to work for next.js client
// https://github.com/chartjs/chartjs-plugin-zoom/issues/742
const DynamicHeaderVisualizerChart = dynamic(
  () => import("../components/VisualizerChart"),
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
        <InstructionsCard session={session} />
      </div>
    );

  return (
    <>
      <Head>
        <title>Strength Visualizer (Strength Journeys)</title>
        <meta
          name="description"
          content="Strength Journeys Strength Analyzer"
        />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <div className="">
        <h1 className="flex-1 scroll-m-20 text-center text-4xl font-extrabold tracking-tight md:hidden lg:text-5xl ">
          Strength Visualizer
        </h1>
        <div
          style={{
            position: "relative",
            height: "80vh",
            width: "92vw",
          }}
        >
          <DynamicHeaderVisualizerChart />
        </div>
      </div>
    </>
  );
};
export default Visualizer;
