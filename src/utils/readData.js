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
//  getGoogleUserInfo->loadGSheetValues->parseData->processData
//
// Flow can be triggered by:
//  - on app launch using previous ssid and tokenResponse from localStorage
//  - on choosing a GSheet from the Google File Picker
//  - when a user changes equation
//  - on auto-refresh of Google Sheet data (FIXME: not implemented)
//
// (the entry point will be different for each of those triggers)
// ------------------------------------------------------------------
export async function getGoogleUserInfo(
  setUserInfo,
  setInfoChipStatus,
  setInfoChipToolTip,
  setIsLoading,
  setIsDataReady,
  visualizerData,
  setVisualizerData,
  setParsedData,
  setAnalyzerData
) {
  console.log(`getGoogleUserInfo()...`);

  const tokenResponse = JSON.parse(localStorage.getItem(`tokenResponse`));
  const ssid = localStorage.getItem(`ssid`);

  if (!tokenResponse) {
    setUserInfo(null);
    return; // No ticket to google? Then no party.
  }
  setIsLoading(true);

  await axios
    .get("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
    })
    .then((response) => {
      // handle success
      // console.log(`API get UserInfo success: response.data: ${JSON.stringify(response.data)}`);
      setUserInfo(response.data);

      // If we have a valid looking ssid then we can go to the next step in the chain
      if (ssid && ssid.length > 10) {
        setInfoChipStatus("Loading GSheet Values");
        if (localStorage.getItem("gSheetName")) {
          setInfoChipToolTip(localStorage.getItem("gSheetName")); // Put the GSheet filename in the chip tooltip
        }

        loadGSheetValues(
          setInfoChipStatus,
          setInfoChipToolTip,
          setIsLoading,
          setIsDataReady,
          visualizerData,
          setVisualizerData,
          setParsedData,
          setAnalyzerData
        );
      } else {
        setInfoChipStatus("Select Data Source"); // User must click to get File Picker
        setIsLoading(false);
      }
    })
    .catch((error) => {
      console.log(`axios.get UserInfo error:`);
      console.log(error);

      // Just in case we had a working tokenResponse that has now expired.
      setUserInfo(null);
      localStorage.removeItem("tokenResponse");
      setIsLoading(false);
      setIsDataReady(false);
    });
}

export async function loadGSheetValues(
  setInfoChipStatus,
  setInfoChipToolTip,
  setIsLoading,
  setIsDataReady,
  visualizerData,
  setVisualizerData,
  setParsedData,
  setAnalyzerData
) {
  console.log("loadGSheetValues()...");

  const tokenResponse = JSON.parse(localStorage.getItem(`tokenResponse`));
  const ssid = localStorage.getItem(`ssid`);
  if (!ssid) {
    return;
  }

  setIsLoading(true);
  setInfoChipStatus("Loading GSheet Values");

  await axios
    .get(
      `https://sheets.googleapis.com/v4/spreadsheets/${ssid}/values/A%3AZ?dateTimeRenderOption=FORMATTED_STRING&key=${process.env.REACT_APP_GOOGLE_API_KEY}`,
      {
        headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
      }
    )
    .then((response) => {
      let result = parseData(response.data.values, visualizerData, setVisualizerData, setParsedData, setAnalyzerData);

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
      setInfoChipStatus("Error Reading Google Sheet");
      localStorage.removeItem("ssid"); // Remove ssid if it failed. FIXME: good idea?
      console.log(error);
      // setInfoChipToolTip(error.response.data.error.message);
    });
}
