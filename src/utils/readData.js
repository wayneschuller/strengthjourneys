// readData.js
// Wayne Schuller, wayne@schuller.id.au
// Licenced under https://www.gnu.org/licenses/gpl-3.0.html
//
// Utility functions for reading raw lift data
//
// Two main sources:
//  - google sheets api
//  - local CSV upload (code removed - just use google picker upload)
//
// In the future we could support another spreadsheet or fitness app API

import axios from 'axios';
import { parseData } from './parseData';

// ------------------------------------------------------------------
// Data processing flow:
//
//  getGoogleUserInfo->getGDriveMetadata->loadGSheetValues->parseData->processData
//
// Flow can be triggered by:
//  - on app launch using cookie saved ssid and tokenResponse
//  - on choosing a GSheet from the Google File Picker 
//  - when a user changes equation
//  - on auto-refresh of Google Sheet data
//
// (the entry point will be different for each of those triggers)
// ------------------------------------------------------------------
export async function getGoogleUserInfo(setUserInfo,
                                        setInfoChipStatus,
                                        setInfoChipToolTip,
                                        setIsLoading,     
                                        setVisualizerData,
                                        visualizerConfig, setVisualizerConfig,
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
        setInfoChipStatus("Checking GSheet Modified Time"); 
        getGDriveMetadata(setInfoChipStatus,
                          setInfoChipToolTip,
                          setIsLoading,     
                          setVisualizerData,
                          visualizerConfig, setVisualizerConfig,
                         );
      } else {
        setInfoChipStatus("Select Data Source");  // User must click to get File Picker
      }
    })
    .catch((error) => {
      console.log(`axios.get UserInfo error:`);
      console.log(error);

      // Just in case we had a working tokenResponse that has now expired.
      setUserInfo(null);
      // removeCookie('tokenResponse'); // Forget the tokenReponse  FIXME
    })
}

export async function getGDriveMetadata (
                                        setInfoChipStatus,
                                        setInfoChipToolTip,
                                        setIsLoading,     
                                        setVisualizerData,
                                        visualizerConfig, setVisualizerConfig,
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

      // FIXME: Checking for modified time needs an interval handler
      // FIXME: If this is our first time through always move forward
      // If the modified time is newer then refresh the data from Google Sheets
      const modifiedTime = Date.parse(response.data.modifiedTime);
      // console.log(`useState dataModifiedTime: ${dataModifiedTime}. Response: ${modifiedTime}`);

      // FIXME: don't check for modified time yet.
      // if (modifiedTime > dataModifiedTime) {
      if (true) {
        setInfoChipStatus("Loading GSheet Values"); 
        // setDataModifiedTime(modifiedTime);
        loadGSheetValues( setInfoChipStatus,
                          setInfoChipToolTip,
                          setIsLoading,     
                          setVisualizerData,
                          visualizerConfig, setVisualizerConfig,
                        );
      } else {
        console.log(`Google Sheet metadata check: modifiedtime is unchanged`);
      } 
    })
    .catch((error) => {
      setInfoChipStatus("Error Reading GDrive File Metadata");
      setInfoChipToolTip(error.response.data.error.message);
      console.log(error);
    })
}

async function loadGSheetValues( setInfoChipStatus,
                                 setInfoChipToolTip,
                                 setIsLoading,     
                                 setVisualizerData,
                                 visualizerConfig, setVisualizerConfig,
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
                    setVisualizerData,
                    setVisualizerConfig,
                    );
    })
    .catch((error) => {
      setInfoChipStatus("Error Reading Google Sheet");
      console.log(error);
      // setInfoChipToolTip(error.response.data.error.message);
    })
}