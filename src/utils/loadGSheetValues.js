/** @format */

// readData.js
// Wayne Schuller, wayne@schuller.id.au
// Licenced under https://www.gnu.org/licenses/gpl-3.0.html
//
// Utility functions for reading raw lift data
//
// Two main sources:
//  - google sheets api
//  - local CSV upload (code removed - FIXME: implement google picker csv upload)
//
// In the future we could support another spreadsheet or fitness app API

import axios from "axios";
import { parseData } from "./parseData";

// ------------------------------------------------------------------
// Data processing flow:
//
//  loadGSheetValues->parseData->processData
//
// Flow can be triggered by:
//  - on app launch using previous ssid and tokenResponse from localStorage
//  - on choosing a GSheet from the Google File Picker
//  - on auto-refresh of Google Sheet data (FIXME: not implemented)
//
// (the entry point will be different for each of those triggers)
// ------------------------------------------------------------------
export async function loadGSheetValues(
  setAppStatus,
  setInfoChip,
  setVisualizerData,
  setParsedData,
  setAnalyzerData,
  auth,
  setSheetIcon
) {
  console.log("loadGSheetValues()...");

  const credential = JSON.parse(localStorage.getItem(`googleCredential`));
  if (!credential?.accessToken) {
    console.log("No access token found in localStorage");
    return;
  }

  const ssid = localStorage.getItem(`ssid`);
  if (!ssid) {
    console.log("No ssid found in localStorage");
    return;
  }

  const gSheetName = localStorage.getItem(`gSheetName`);
  setInfoChip({ label: "Loading GSheet Values", tooltip: gSheetName });

  const url = localStorage.getItem(`url`);

  if (url && gSheetName) setSheetIcon({ url: url, tooltip: `Click to open ${gSheetName}` });

  setAppStatus("loading");

  await axios
    .get(
      `https://sheets.googleapis.com/v4/spreadsheets/${ssid}/values/A%3AZ?dateTimeRenderOption=FORMATTED_STRING&key=${process.env.REACT_APP_GOOGLE_API_KEY}`,
      {
        headers: { Authorization: `Bearer ${credential.accessToken}` },
      }
    )
    .then((response) => {
      // console.log(response);

      let result = parseData(response.data.values, setVisualizerData, setParsedData, setAnalyzerData);

      if (result) {
        setInfoChip({ label: "Google Sheet Data Loaded", tooltip: gSheetName });
        setAppStatus("processed"); // This should trigger <Visualizer /> and <Analyzer /> rendering
      } else {
        // We have data that could not be parsed
        let tooltip = "";
        if (localStorage.getItem("gSheetName")) {
          tooltip = `Could not parse lifting data in file "${localStorage.getItem("gSheetName")}"`; // Put the GSheet filename in the chip tooltip
        } else {
          tooltip = "Click to choose another Google Sheet";
        }
        setInfoChip({ label: "Bad Google Sheet Data", tooltip: tooltip });

        // Clean up gracefully
        localStorage.removeItem("selectedLifts");
        localStorage.removeItem("ssid");
        localStorage.removeItem("gSheetName");

        localStorage.setItem("retryLoadGSheetValues", true); // Prevent infinite loops
        setAppStatus("ready"); // We are 'ready' in auth for the user to pick a good gsheet
      }
    })
    .catch((error) => {
      // The most likely scenario is the access token has expired
      // So try to sign in again.

      if (localStorage.getItem("retryLoadGSheetValues")) {
        console.log("loadGSheetValues() had an error, but we have already retried. Do not try again.");
        console.log(error);
        localStorage.removeItem("retryLoadGSheetValues");
        setInfoChip({ label: "Error reading Google Sheet", tooltip: null }); // FIXME: Should be similar to the error cleanup above?
        setAppStatus("ready"); // We are 'ready' in auth for the user to pick a good gsheet
      } else {
        console.log("loadGSheetValues() had an error, so trying to sign in again...");
        console.log(error);
        auth.signinWithGoogle();
        localStorage.setItem("retryLoadGSheetValues", true); // Prevent infinite loops
      }
    });
}
