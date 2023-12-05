"use client";

import { useState, useEffect, useContext } from "react";
import { ParsedDataContext } from "@/pages/_app";
import useDrivePicker from "@fyelci/react-google-drive-picker";
import { handleOpenPicker } from "@/components/handleOpenPicker";
import { Button } from "@/components/ui/button";
import { devLog } from "@/lib/devLog";
import Image from "next/image";

import SampleImage from "../../public/sample_google_sheet_fuzzy_border.png";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const InstructionsCard = ({ session }) => {
  const [openPicker, authResponse] = useDrivePicker();
  const { parsedData, setParsedData, ssid, setSsid } =
    useContext(ParsedDataContext);

  return (
    <Card className="w-2/3">
      <CardHeader>
        <CardTitle>You are logged in as {session.user.name}</CardTitle>
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
          <Image
            className="w-5/6 md:w-1/2"
            src={SampleImage}
            priority={true}
            alt="Screenshot of sample google sheet data"
          />
        </div>
        <div className="">
          Strength Journeys does not collect or store your data. Instead we
          encourage every lifter to own their own Google Sheet of their personal
          strength journey.
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
            handleOpenPicker(openPicker, session.accessToken, setSsid)
          }
        >
          Choose Google Sheet
        </Button>
      </CardFooter>
    </Card>
  );
};

export default InstructionsCard;
