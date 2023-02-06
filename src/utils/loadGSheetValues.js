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
  setInfoChipStatus,
  setInfoChipToolTip,
  setIsLoading,
  setIsDataReady,
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
  if (gSheetName) setInfoChipToolTip(gSheetName);

  const url = localStorage.getItem(`url`);

  if (url && gSheetName) setSheetIcon({ url: url, tooltip: `Click to open ${gSheetName}` });

  setIsLoading(true);
  setIsDataReady(false);
  setInfoChipStatus("Loading GSheet Values");

  await axios
    .get(
      `https://sheets.googleapis.com/v4/spreadsheets/${ssid}/values/A%3AZ?dateTimeRenderOption=FORMATTED_STRING&key=${process.env.REACT_APP_GOOGLE_API_KEY}`,
      {
        headers: { Authorization: `Bearer ${credential.accessToken}` },
      }
    )
    .then((response) => {
      console.log(response);

      let result = parseData(response.data.values, setVisualizerData, setParsedData, setAnalyzerData);

      if (result) {
        setInfoChipStatus("Google Sheet Data Loaded");
        setIsLoading(false); // Stop the loading animations
        setIsDataReady(true); // This should trigger <Visualizer /> and <Analyzer /> rendering
      } else {
        // We have data that could not be parsed
        setInfoChipStatus("Bad Google Sheet Data");
        if (localStorage.getItem("gSheetName")) {
          setInfoChipToolTip(`Could not parse lifting data in file "${localStorage.getItem("gSheetName")}"`); // Put the GSheet filename in the chip tooltip
        } else {
          setInfoChipToolTip("Click to choose another Google Sheet");
        }

        // Clean up gracefully
        localStorage.removeItem("selectedLifts");
        localStorage.removeItem("ssid");
        localStorage.removeItem("gSheetName");
        setIsLoading(false);
      }
    })
    .catch((error) => {
      // The most likely scenario is the access token has expired
      // So try to sign in again.

      // FIXME: should only try once, otherwise we get infinite loops
      console.log("loadGSheetValues() had an error, so trying to sign in again...");
      console.log(error);
      auth.signinWithGoogle();
    });
}
