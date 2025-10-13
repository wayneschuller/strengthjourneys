"use client";

import { useState, useEffect, useContext } from "react";
import useDrivePicker from "react-google-drive-picker";
import { handleOpenFilePicker } from "@/lib/handle-open-picker";
import { Button } from "@/components/ui/button";
import { devLog } from "@/lib/processing-utils";
import Image from "next/image";
import { useLocalStorage } from "usehooks-ts";
import {
  ArrowDown,
  ArrowRight,
  ArrowBigDown,
  ArrowBigRight,
} from "lucide-react";
import { useSession, signIn, signOut } from "next-auth/react";
import Link from "next/link";

import SampleImage from "../../public/sample_google_sheet_fuzzy_border.png";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

// This is very similar to the ChooseSheetInstructionsCard but designed for the front page
export function OnBoardingDashboard() {
  const [openPicker, authResponse] = useDrivePicker();
  const { data: session, status: authStatus } = useSession();

  // We need the next 3 for the file picker button we give with instructions
  const [ssid, setSsid] = useLocalStorage("ssid", null, {
    initializeWithValue: false,
  });
  const [sheetURL, setSheetURL] = useLocalStorage(
    "sheetURL",
    null,

    { initializeWithValue: false },
  );
  const [sheetFilename, setSheetFilename] = useLocalStorage(
    "sheetFilename",
    null,
    { initializeWithValue: false },
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-2">
      <div>
        <h2 className="text-lg font-bold">
          Successful sign-in! Let{"'"}s connect your lifting data
        </h2>
        <div className="flex flex-col gap-4">
          <div className="">
            In two quick steps, you’ll connect your personal Google Sheet so
            Strength Journeys can show your training insights — while your data
            stays yours.
          </div>
          <Button asChild className="w-fit self-center">
            <a
              href="https://docs.google.com/spreadsheets/d/14J9z9iJBCeJksesf3MdmpTUmo2TIckDxIQcTx1CPEO0/edit#gid=0"
              target="_blank"
              rel="noopener noreferrer"
            >
              Step 1 - Open Google Sheet Template
            </a>
          </Button>
          <div className="mb-6">
            In Google Sheets click <em>File → Make a copy</em>. Give it a good
            name and start entering your own lifts.
          </div>
          <Button
            className="w-fit self-center"
            onClick={() =>
              handleOpenFilePicker(
                openPicker,
                session.accessToken,
                setSsid,
                setSheetURL,
                setSheetFilename,
              )
            }
          >
            Step 2 - Connect your Google Sheet to Strength Journeys
          </Button>

          <div className="text-sm">
            Strength Journeys does not collect or store your data. Instead we
            encourage every lifter to own the data of their personal strength
            journey.
          </div>
        </div>
      </div>
      <div className="md-auto flex flex-col md:ml-32">
        <figure className="">
          <a
            href="https://docs.google.com/spreadsheets/d/14J9z9iJBCeJksesf3MdmpTUmo2TIckDxIQcTx1CPEO0/edit#gid=0"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Image
              className="w-96 rounded-lg shadow-sm"
              src={SampleImage}
              priority
              alt="Screenshot of sample Google Sheet data"
            />
          </a>
          <figcaption className="mt-2 self-start text-sm text-gray-500">
            Example of your lifting log — simple, editable, and yours.
          </figcaption>
        </figure>

        <div className="mt-4 text-sm leading-relaxed text-gray-500">
          <p className="font-semibold text-gray-700">
            Our sample format is intuitive and easy to update. Some tips:
          </p>
          <ul className="list-inside list-disc text-left">
            <li>Use either “kg” or “lb” — the app reads both.</li>
            <li>Insert new rows and put your latest session at the top.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

// This card is shown if the user goes to the visualizer or analyzer with google auth but no spreadsheet selected
export function ChooseSheetInstructionsCard() {
  const [openPicker, authResponse] = useDrivePicker();
  const { data: session, status: authStatus } = useSession();

  // We need the next 3 for the file picker button we give with instructions
  const [ssid, setSsid] = useLocalStorage("ssid", null, {
    initializeWithValue: false,
  });
  const [sheetURL, setSheetURL] = useLocalStorage(
    "sheetURL",
    null,

    { initializeWithValue: false },
  );
  const [sheetFilename, setSheetFilename] = useLocalStorage(
    "sheetFilename",
    null,
    { initializeWithValue: false },
  );

  if (!session) return null;

  return (
    <Card className="md:w-2/3">
      <CardHeader>
        <CardTitle>Hello {session.user.name}! You are logged in.</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="">
          Next step is to link your personal Google sheet of your lifting data.
        </div>
        <div className="">
          Our{" "}
          <a
            href="https://docs.google.com/spreadsheets/d/14J9z9iJBCeJksesf3MdmpTUmo2TIckDxIQcTx1CPEO0/edit#gid=0"
            target="_blank"
            className="text-blue-600 underline visited:text-purple-600 hover:text-blue-800"
          >
            sample Google Sheet
          </a>{" "}
          format is intuitive and easy to update. Make a copy and start entering
          your lifts. (You can use {`"kg"`} or {`"lb"`})
        </div>
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
        <div className="">
          Strength Journeys does not collect or store your data. Instead we
          encourage every lifter to own the data of their personal strength
          journey.
        </div>
        <div className="">
          Link a Google sheet then every time you use Strength Journeys your web
          client will read your data and bring insights and inspiration!
        </div>
      </CardContent>
      <CardFooter>
        <Button
          className="w-full"
          onClick={() =>
            handleOpenFilePicker(
              openPicker,
              session.accessToken,
              setSsid,
              setSheetURL,
              setSheetFilename,
            )
          }
        >
          Choose Google Sheet
        </Button>
      </CardFooter>
    </Card>
  );
}

export function GettingStartedCard() {
  const { data: session, status: authStatus } = useSession();
  const [openPicker, authResponse] = useDrivePicker();

  // We need the next 3 for the file picker button we give with instructions
  const [ssid, setSsid] = useLocalStorage("ssid", null, {
    initializeWithValue: false,
  });
  const [sheetURL, setSheetURL] = useLocalStorage(
    "sheetURL",
    null,

    { initializeWithValue: false },
  );
  const [sheetFilename, setSheetFilename] = useLocalStorage(
    "sheetFilename",
    null,
    { initializeWithValue: false },
  );

  const arrowSize = 75;
  return (
    <Card className="hover:ring-0">
      <CardHeader>
        <CardTitle>
          Getting Started: Set Up Google Sheets and Connect with Strength
          Journeys
        </CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 lg:grid-cols-7">
        <div className="">
          Lift progressively heavier things with a{" "}
          <a
            href="https://www.roguefitness.com/rogue-45lb-ohio-power-bar-bare-steel"
            target="_blank"
            className="text-blue-600 underline visited:text-purple-600 hover:text-blue-800"
          >
            barbell
          </a>
          . <br></br>
          e.g.:{" "}
          <Link
            href="/barbell-squat-insights"
            className="text-blue-600 underline visited:text-purple-600 hover:text-blue-800"
          >
            Squat
          </Link>
          ,{" "}
          <Link
            href="/barbell-bench-press-insights"
            className="text-blue-600 underline visited:text-purple-600 hover:text-blue-800"
          >
            bench
          </Link>
          ,{" "}
          <Link
            href="/barbell-deadlift-insights"
            className="text-blue-600 underline visited:text-purple-600 hover:text-blue-800"
          >
            deadlift
          </Link>
          ,{" "}
          <Link
            href="/barbell-strict-press-insights"
            className="text-blue-600 underline visited:text-purple-600 hover:text-blue-800"
          >
            strict press
          </Link>
          . Just log any measurable lift movement and we can track it.
        </div>
        <div className="flex justify-center">
          <ArrowBigRight
            size={arrowSize}
            strokeWidth={0.5}
            className="hidden lg:block"
          />
          <ArrowBigDown
            size={arrowSize}
            strokeWidth={0.5}
            className="block lg:hidden"
          />
        </div>
        <div className="">
          Record your lifting progress in Google Sheets. Use simple columns:
          date, lift type, reps, weight. One set per row.
          <div>
            (
            <a
              href="https://docs.google.com/spreadsheets/d/14J9z9iJBCeJksesf3MdmpTUmo2TIckDxIQcTx1CPEO0/edit#gid=0"
              target="_blank"
              className="text-blue-600 underline visited:text-purple-600 hover:text-blue-800"
            >
              sample Google Sheet
            </a>
            ). Use {`"lb"`} or {`"kg"`} with weight values.
          </div>
        </div>
        <div className="flex justify-center">
          <ArrowBigRight
            size={arrowSize}
            strokeWidth={0.5}
            className="hidden lg:block"
          />
          <ArrowBigDown
            size={arrowSize}
            strokeWidth={0.5}
            className="block lg:hidden"
          />
        </div>
        <div className="">
          {authStatus !== "authenticated" ? (
            <button
              onClick={() => signIn("google")}
              className="text-blue-600 underline visited:text-purple-600 hover:text-blue-800"
            >
              Sign in via Google
            </button>
          ) : (
            "Sign in via Google"
          )}{" "}
          and{" "}
          {authStatus === "authenticated" && !ssid ? (
            <button
              onClick={() =>
                handleOpenFilePicker(
                  openPicker,
                  session.accessToken,
                  setSsid,
                  setSheetURL,
                  setSheetFilename,
                )
              }
              className="text-blue-600 underline visited:text-purple-600 hover:text-blue-800"
            >
              select your Google Sheet
            </button>
          ) : (
            "select your Google Sheet"
          )}
          . We will read your data every couple of seconds. We do not keep a
          copy of your data.
        </div>
        <div className="flex justify-center">
          <ArrowBigRight
            size={arrowSize}
            strokeWidth={0.5}
            className="hidden lg:block"
          />
          <ArrowBigDown
            size={arrowSize}
            strokeWidth={0.5}
            className="block lg:hidden"
          />
        </div>
        <div className="">
          Explore the{" "}
          <Link
            href="/analyzer"
            className="text-blue-600 underline visited:text-purple-600 hover:text-blue-800"
          >
            Analyzer
          </Link>{" "}
          or{" "}
          <Link
            href="/visualizer"
            className="text-blue-600 underline visited:text-purple-600 hover:text-blue-800"
          >
            Visualizer
          </Link>{" "}
          for motivation, rewards and additional insights.
        </div>
      </CardContent>
      <CardFooter className="text-muted-foreground">
        <div>
          Strength Journeys securely accesses your Google Sheet for read-only
          purposes, ensuring your data is never altered or stored by us. Your
          original data remains intact and solely under your control. {` `}
          <Link
            href="/privacy-policy.html"
            className="text-blue-600 underline visited:text-purple-600 hover:text-blue-800"
          >
            (Privacy Policy)
          </Link>
        </div>
      </CardFooter>
    </Card>
  );
}

export const SignInInvite = () => {
  const { status: authStatus } = useSession();

  // FIXME: add in a check for ssid and prompt for file picker if needed.
  if (authStatus === "authenticated") return null;

  return (
    <div>
      <button
        onClick={() => signIn("google")}
        className="text-blue-600 underline visited:text-purple-600 hover:text-blue-800"
      >
        Sign in
      </button>{" "}
      and link your Google Sheet lifting data to see your unique ratings for
      each lift.
    </div>
  );
};
