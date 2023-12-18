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

export function ChooseSheetInstructionsCard({ session }) {
  const [openPicker, authResponse] = useDrivePicker();

  // We need the next 3 for the file picker button we give with instructions
  const [ssid, setSsid] = useLocalStorage("ssid", null);
  const [sheetURL, setSheetURL] = useLocalStorage("sheetURL", null);
  const [sheetFilename, setSheetFilename] = useLocalStorage(
    "sheetFilename",
    null,
  );

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
          format is intuitive and easy to update. (make a copy and start
          entering your lifts)
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
  const [ssid, setSsid] = useLocalStorage("ssid", null);
  const [sheetURL, setSheetURL] = useLocalStorage("sheetURL", null);
  const [sheetFilename, setSheetFilename] = useLocalStorage(
    "sheetFilename",
    null,
  );

  const arrowSize = 75;
  return (
    <Card className="">
      <CardHeader>
        <CardTitle>Getting Started</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 md:grid-cols-7">
        <div className="">
          Lift progressively heavier things with a{" "}
          <a
            href="https://www.roguefitness.com/rogue-45lb-ohio-power-bar-bare-steel"
            target="_blank"
            className="text-blue-600 underline visited:text-purple-600 hover:text-blue-800"
          >
            barbell
          </a>
          . Squat, bench, deadlift. Usually inside a gym.
        </div>
        <div className="flex justify-center">
          <ArrowBigRight
            size={arrowSize}
            strokeWidth={0.5}
            className="hidden md:block"
          />
          <ArrowBigDown
            size={arrowSize}
            strokeWidth={0.5}
            className="block md:hidden"
          />
        </div>
        <div className="">
          Record your lifting progress in Google Sheets.
          <div>
            (
            <a
              href="https://docs.google.com/spreadsheets/d/14J9z9iJBCeJksesf3MdmpTUmo2TIckDxIQcTx1CPEO0/edit#gid=0"
              target="_blank"
              className="text-blue-600 underline visited:text-purple-600 hover:text-blue-800"
            >
              sample Google Sheet
            </a>
            )
          </div>
        </div>
        <div className="flex justify-center">
          <ArrowBigRight
            size={arrowSize}
            strokeWidth={0.5}
            className="hidden md:block"
          />
          <ArrowBigDown
            size={arrowSize}
            strokeWidth={0.5}
            className="block md:hidden"
          />
        </div>
        <div className="">
          {authStatus !== "authenticated" ? (
            <button
              onClick={() => signIn("google")}
              className="text-blue-600 underline visited:text-purple-600 hover:text-blue-800"
            >
              Sign in
            </button>
          ) : (
            "Sign in"
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
          .
        </div>
        <div className="flex justify-center">
          <ArrowBigRight
            size={arrowSize}
            strokeWidth={0.5}
            className="hidden md:block"
          />
          <ArrowBigDown
            size={arrowSize}
            strokeWidth={0.5}
            className="block md:hidden"
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
        Strength Journeys securely accesses your Google Sheet for read-only
        purposes, ensuring your data is never altered or stored by us. Your
        original data remains intact and solely under your control.
      </CardFooter>
    </Card>
  );
}
