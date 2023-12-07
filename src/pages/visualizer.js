"use client";

import dynamic from "next/dynamic";
import Head from "next/head";
import { useEffect, useState, useContext } from "react";
import { useSession, signIn } from "next-auth/react";
import useUserLiftData from "@/lib/useUserLiftData";
import { ParsedDataContext } from "@/pages/_app";
import { sampleParsedData } from "@/lib/sampleParsedData";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import InstructionsCard from "@/components/InstructionsCard";
import { devLog } from "@/lib/SJ-utils";

import {
  Sheet,
  SheetContent,
  SheetClose,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

// Hack needed to get zoom/pan to work for next.js client
// https://github.com/chartjs/chartjs-plugin-zoom/issues/742
const DynamicHeaderVisualizerChart = dynamic(
  () => import("../components/VisualizerChart"),
  {
    ssr: false,
  },
);

const Visualizer = () => {
  const {
    parsedData,
    setParsedData,
    ssid,
    setSsid,
    isDemoMode,
    setIsDemoMode,
    liftTypes,
    setLiftTypes,
    selectedLiftTypes,
    setSelectedLiftTypes,
  } = useContext(ParsedDataContext);
  const { data: session } = useSession();
  const { isLoading } = useUserLiftData();

  devLog(`Visualizer render: ssid: ${ssid}`);
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

const LiftChooserPanel = ({}) => {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button className="mt-2 px-2 text-base hover:bg-transparent focus-visible:bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 ">
          {/* <ViewVerticalIcon className="h-5 w-5" /> */}
          Choose Lifts
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="pr-0">
        <div className="flex w-min flex-col">
          <div>Back Squat</div>
          <div>Deadlift</div>
          <div>Bench Press</div>
          <SheetClose asChild className="flex justify-center">
            <Button>Close controls</Button>
          </SheetClose>
        </div>
      </SheetContent>
    </Sheet>
  );
};
