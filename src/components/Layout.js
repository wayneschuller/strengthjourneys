/** @format */

"use client";
import Navbar from "./NavBar";
import Footer from "@/components/Footer";
import { SessionProvider } from "next-auth/react";
import { useState, useEffect, useContext } from "react";
import { ParsedDataContext } from "@/pages/_app";
import { parseGSheetData } from "@/lib/parseGSheetData";
import { useSession, signIn, signOut } from "next-auth/react";
import useUserLiftData from "@/lib/useUserLiftData";
import { devLog } from "@/lib/SJ-utils";
import { sampleParsedData } from "@/lib/sampleParsedData";
import { useToast } from "@/components/ui/use-toast";
import { ToastAction } from "@/components/ui/toast";
import { useRouter } from "next/router";

let demoToastInit = false;
let loadedToastInit = false;

export function Layout({ children }) {
  const { parsedData, setParsedData, ssid, setSsid } =
    useContext(ParsedDataContext);
  const { data: session } = useSession();
  const { data, isError, isLoading } = useUserLiftData(session, ssid);
  const { toast } = useToast();
  const router = useRouter();
  const currentPath = router.asPath;

  // When userUserLiftData (useSWR) gives new Google sheet data, parse it
  // useSWR can ping google and cache it and it won't trigger until data changes
  useEffect(() => {
    // devLog(`<Layout /> useEffect[data]: isError is ${isError}`);
    // devLog(data);

    // If data changes and we have isError then signOut
    // This is because our token has expired
    // FIXME: get Google refreshtokens working
    if (isError) {
      console.log(
        "Couldn't speak to Google. This is normally because it is more than one hour since you logged in. Automatically signing out. This will be fixed in a future version using refresh tokens",
      );
      devLog(data);
      signOut();
      return;
    }

    let localParsedData = null;

    // useSWR will sometimes give us the same data cached
    // FIXME: check if the data has changed?
    // Or at least check if parsedData has changed?

    // Get some parsedData
    if (data?.values) {
      localParsedData = parseGSheetData(data.values);
    } else {
      localParsedData = sampleParsedData;
    }

    setParsedData(localParsedData);
  }, [data, isError]);

  // useEffect for showing toast instructions on key state changes
  useEffect(() => {
    // devLog(`<Layout /> Toast useEffect`);
    // devLog(session);

    // Check if the current path is "/visualizer" or "/analyzer"
    const isVisualizerRoute = currentPath === "/visualizer";
    const isAnalyzerRoute = currentPath === "/analyzer";

    if (!isVisualizerRoute && !isAnalyzerRoute) return; // Don't show toast on generic pages like Timer

    // session starts undefined, but if they are not logged in it just becomes null
    if (session === undefined) return;

    // Tell the user when demo mode has started
    if (!demoToastInit && session === null && !ssid) {
      demoToastInit = true; // Don't show this again
      toast({
        title: "Demo Mode",
        description:
          "Sign in via Google to visualize your personal Google Sheet lifting data.",
        action: (
          <ToastAction altText="Google Login" onClick={() => signIn("google")}>
            Google Sign in
          </ToastAction>
        ),
      });
      return;
    }

    // Tell the user when data is loaded
    if (
      !loadedToastInit &&
      !isLoading &&
      ssid &&
      session?.user &&
      parsedData?.length !== 0
    ) {
      loadedToastInit = true; // Don't show this again
      toast({
        title: "Data loaded from Google Sheets",
        description: "Bespoke lifting data", // FIXME: gsheet name goes here
      });
      return;
    }
  }, [session, isLoading, ssid, parsedData, router]);

  return (
    <>
      <Navbar />
      <main className={`mt-4 flex justify-center`}>{children}</main>
      <Footer />
    </>
  );
}
