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

import axios from 'axios';
import { parseData } from './parseData';

// ------------------------------------------------------------------
// Data processing flow:
//
//  getGoogleUserInfo->(getGDriveMetadata)->loadGSheetValues->parseData->processData
//
// Flow can be triggered by:
//  - on app launch using previous ssid and tokenResponse from localStorage
//  - on choosing a GSheet from the Google File Picker 
//  - when a user changes equation
//  - on auto-refresh of Google Sheet data (FIXME: not implemented)
//
// (the entry point will be different for each of those triggers)
// ------------------------------------------------------------------
export async function getGoogleUserInfo(setUserInfo,
                                        setInfoChipStatus,
                                        setInfoChipToolTip,
                                        setIsLoading,     
                                        visualizerData, setVisualizerData,
                                        visualizerConfig, setVisualizerConfig,
                                        setParsedData, setAnalyzerData,
                                        ) {

  console.log(`getGoogleUserInfo()...`);

  const tokenResponse = JSON.parse(localStorage.getItem(`tokenResponse`));
  const ssid = localStorage.getItem(`ssid`);

  if (!tokenResponse) {
    setUserInfo(null);
    return; // No ticket to google? Then no party.
  }

  await axios
    .get('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
    })
    .then((response) => {
      // handle success
      // console.log(`API get UserInfo success: response.data: ${JSON.stringify(response.data)}`);
      setUserInfo(response.data);

      // If we have a valid looking ssid then we can go to the next step in the chain
      if (ssid && ssid.length > 10)  {
        setInfoChipStatus("Loading GSheet Values"); 
        if (localStorage.getItem('gSheetName')) {
          setInfoChipToolTip(localStorage.getItem('gSheetName')); // Put the GSheet filename in the chip tooltip
        }

        loadGSheetValues( setInfoChipStatus,
                        setInfoChipToolTip,
                        setIsLoading,     
                        visualizerData, setVisualizerData,
                        visualizerConfig, setVisualizerConfig,
                        setParsedData, setAnalyzerData,
                      );


        // We used to get the filename and modified time, but let's 
        // try not bothering with that exta API get step
        // setInfoChipStatus("Checking GSheet Filename"); 
        // getGDriveMetadata(setInfoChipStatus,
                          // setInfoChipToolTip,
                          // setIsLoading,     
                          // visualizerData, setVisualizerData,
                          // visualizerConfig, setVisualizerConfig,
                          // setParsedData, setAnalyzerData,
                        //  );
      } else {
        setInfoChipStatus("Select Data Source");  // User must click to get File Picker
      }
    })
    .catch((error) => {
      console.log(`axios.get UserInfo error:`);
      console.log(error);

      // Just in case we had a working tokenResponse that has now expired.
      setUserInfo(null);
      localStorage.removeItem('tokenResponse');
      setIsLoading(false);
    })
}

export async function getGDriveMetadata (
                                        setInfoChipStatus,
                                        setInfoChipToolTip,
                                        setIsLoading,     
                                        visualizerData, setVisualizerData,
                                        visualizerConfig, setVisualizerConfig,
                                        setParsedData, setAnalyzerData,
                                        ) {
  console.log("getGSheetMetadata()...");

  const tokenResponse = JSON.parse(localStorage.getItem(`tokenResponse`));
  const ssid = localStorage.getItem(`ssid`);

  setIsLoading(true);

  // API call to get GDrive file metadata to get modified time and the filename
  await axios
    .get(`https://www.googleapis.com/drive/v3/files/${ssid}?fields=modifiedTime%2Cname&key=${process.env.REACT_APP_GOOGLE_API_KEY}`, {
      headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
    })
    .then((response) => {
      // handle success
      // console.log(`API get GDrive file metadata .then received:`);
      // console.log(response.data);

      setInfoChipToolTip(response.data.name); // Put the GSheet filename in the chip tooltip
      setInfoChipStatus("Loading GSheet Values"); 

      loadGSheetValues( setInfoChipStatus,
                        setInfoChipToolTip,
                        setIsLoading,     
                        visualizerData, setVisualizerData,
                        visualizerConfig, setVisualizerConfig,
                        setParsedData, setAnalyzerData,
                      );
    })
    .catch((error) => {
      setIsLoading(false);
      setInfoChipStatus("Error Reading GDrive File Metadata");
      setInfoChipToolTip(error.response.data.error.message);
      console.log(error);
    })
}

export async function loadGSheetValues( setInfoChipStatus,
                                 setInfoChipToolTip,
                                 setIsLoading,     
                                 visualizerData, setVisualizerData,
                                 visualizerConfig, setVisualizerConfig,
                                 setParsedData, setAnalyzerData,
                                 ) {
  console.log("loadGSheetValues()...");

  const tokenResponse = JSON.parse(localStorage.getItem(`tokenResponse`));
  const ssid = localStorage.getItem(`ssid`);
  if (!ssid) {
    return;
  }

  setIsLoading(true);

  await axios
    .get(`https://sheets.googleapis.com/v4/spreadsheets/${ssid}/values/A%3AZ?dateTimeRenderOption=FORMATTED_STRING&key=${process.env.REACT_APP_GOOGLE_API_KEY}`, {
          headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
    })
    .then((response) => {
      setInfoChipStatus("Google Sheet Data Loaded");

      parseData(response.data.values, 
                    setIsLoading,     
                    visualizerData, setVisualizerData,
                    visualizerConfig, setVisualizerConfig,
                    setParsedData, setAnalyzerData
                    );
    })
    .catch((error) => {
      setInfoChipStatus("Error Reading Google Sheet");
      localStorage.removeItem('ssid'); // Remove ssid if it failed. FIXME: good idea?
      console.log(error);
      // setInfoChipToolTip(error.response.data.error.message);
    })
}