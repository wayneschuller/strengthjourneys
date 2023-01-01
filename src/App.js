import './App.css';

import { useState, useEffect } from "react";
import { Outlet } from "react-router-dom";

import axios from 'axios';
import { useCookies } from 'react-cookie';

import { parseData } from './utils/parseData';
import { defaultVisualizerData, processVisualizerData, processAchievements } from './utils/visualizerDataProcessing';
import ResponsiveAppBar from './components/appBar';

export default function App() {

  // const [parsedData, setParsedData] = useState(null);  
  const [visualizerData, setVisualizerData] = useState(null);

  const [dataModifiedTime, setDataModifiedTime] = useState(0); // Unix timestamp
  const [cookies, setCookie, removeCookie] = useCookies(['ssid', 'tokenResponse']);
  const [userInfo, setUserInfo] = useState(null);  // .name .picture .email (from Google userinfo API)
  const [infoChipStatus, setInfoChipStatus] = useState("Choose Data Source");  // Used in the navbar info chip-button
  const [infoChipToolTip, setInfoChipToolTip] = useState(null);  

  const [isLoading, setIsLoading] = useState(false); // Use to show loading animation

  const [padDateMin, setPadDateMin] = useState(null);
  const [padDateMax, setPadDateMax] = useState(null);
  const [suggestedYMax, setSuggestedYMax] = useState(null);
  const [achievementAnnotations, setAchievementAnnotations] = useState(null);

  // ------------------------------------------------------------------
  // Data processing flow:
  //
  //    getGoogleUserInfo->getGSheetMetadata->loadGSheetValues
  //
  // Flow is mostly triggered by event handlers, but also can process
  // the data on launch if they have a valid token and ssid in cookies
  // ------------------------------------------------------------------
  async function getGoogleUserInfo(tokenResponse) {
    console.log(`getGoogleUserInfo()...`);

    if (!tokenResponse) {
      console.log(`Can't get userInfo without tokenResponse...`);
      setVisualizerData(defaultVisualizerData);
      return; // No ticket to google? Then no party.
    }

    if (userInfo !== null) {
      console.log(`...ABORT as we seem to already have userInfo`);
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
        if (cookies.ssid !== undefined && cookies.ssid.length > 10)  {
          setInfoChipStatus("Checking GSheet Modified Time"); 
          getGDriveMetadata(cookies.ssid, tokenResponse);    
        } else {
          setInfoChipStatus("Select Data Source");  // User must click to get File Picker
        }
      })
      .catch((error) => {
        console.log(`axios.get UserInfo error:`);
        console.log(error.response);

        // Just in case we had a working tokenResponse that has now expired.
        setUserInfo(null);
        removeCookie('tokenResponse'); // Forget the tokenReponse 
      })
  }

  async function getGDriveMetadata (ssid, tokenResponse) {
    console.log("getGSheetMetadata()...");

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
        // FIXME: We should check if the data is loaded - if not then go ahead anyway
        // If the modified time is newer then refresh the data from Google Sheets
        const modifiedTime = Date.parse(response.data.modifiedTime);
        // console.log(`useState dataModifiedTime: ${dataModifiedTime}. Response: ${modifiedTime}`);

        // FIXME: don't check for modified time yet.
        // if (modifiedTime > dataModifiedTime) {
        if (true) {
          setInfoChipStatus("Loading GSheet Values"); 
          setDataModifiedTime(modifiedTime);
          loadGSheetValues(ssid, tokenResponse);
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

  // Gets interesting information about the sheet but not modified time
  // NOTE: Currently unused, but may be useful in the future
  async function getGSheetMetadata (ssid, tokenResponse) {
      console.log("getGSheetMetadata()...");
      setIsLoading(true);

      await axios
        .get(`https://sheets.googleapis.com/v4/spreadsheets/${ssid}?includeGridData=false`, {
          headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
        })
        .then((response) => {
          // handle success
          // console.log(`API get GSheet metadata .then received:`);
          // console.log(response.data);
          // loadGSheetValues(ssid, tokenResponse);  // Next step in the chain
        })
        .catch((error) => {
          setInfoChipStatus("Error Reading Google Sheet Metadata");
          setInfoChipToolTip(error.response.data.error.message);
          console.log(error);
        })
    }

  async function loadGSheetValues(ssid, tokenResponse) {
      console.log("loadGSheetValues()...");
      setIsLoading(true);

      await axios
      .get(`https://sheets.googleapis.com/v4/spreadsheets/${ssid}/values/A%3AZ?dateTimeRenderOption=FORMATTED_STRING&key=${process.env.REACT_APP_GOOGLE_API_KEY}`, {
          headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
        })
        .then((response) => {

          setInfoChipStatus("Google Sheet Data Loaded");

          // SUCCESS - We have the Google Sheet Data.
          // Now we do some significant processing.

          let parsedData = parseData(response.data.values);
          // console.log(`API get GSheet values success: range is ${response.data.range}`);
          // console.log(`setParsedData to: ${JSON.stringify(parsedData[0])}`);
          // setParsedData(parsedData);    // FIXME: we might need parsedData in state later

          // Process the data for the visualizer
          let processed = processVisualizerData(parsedData);   // FIXME: check for errors?
          // console.log(`Here is processed[0]:`);
          // console.log(processed[0]);

          // Process the PRs/Achivements and return some chartjs annotation config.
          let annotations = processAchievements(parsedData, processed);

          setAchievementAnnotations(annotations);

          // Use the most popular lift to set some aesthetic x-axis padding at start and end
          // There is a chance loading another data set will require a new range, but unlikely.
          // FIXME: just check ALL the first tuples in every lift and use the most recent one.
          let padDateMin = new Date(processed[0].data[0].x); // First tuple in first lift
          padDateMin = padDateMin.setDate(padDateMin.getDate() - 10);
          let padDateMax = new Date(processed[0].data[processed[0].data.length - 1].x); // Last tuple in first lift
          padDateMax = padDateMax.setDate(padDateMax.getDate() + 10);
          setPadDateMin(padDateMin);
          setPadDateMax(padDateMax);

          // Search through the processed data and find the largest y value 
          let highestWeight = 0;
          processed.forEach((liftType) => {
            liftType.data.forEach((lift) => {
              if (lift.y > highestWeight) 
                highestWeight = lift.y;
            });
          });
          highestWeight = Math.ceil(highestWeight / 50) * 50; // Round up to the next mulitiple of 50
          setSuggestedYMax(highestWeight);

          // Lastly, load in the data.
          setVisualizerData(processed);
          setIsLoading(false);
        })
        .catch((error) => {
          setInfoChipStatus("Error Reading Google Sheet");
          console.log(error);
          setInfoChipToolTip(error.response.data.error.message);
        })
    }

  // Event handlers do most of the data flow for us
  // However we want useEffect to auto load data on init from cookies
  let didInit = false;
  useEffect(() => {
    if (!didInit && cookies.tokenResponse) {
      didInit = true;
      // ✅ Only runs once per app load
      // console.log(`useEffect: We now have a tokenResponse, let's talk to Google...`);
      getGoogleUserInfo(cookies.tokenResponse);
    }
  }, []);

  return (
    <div>

     <ResponsiveAppBar 
      cookies={cookies}
      setCookie={setCookie}
      removeCookie={removeCookie}
      userInfo={userInfo}
      setUserInfo={setUserInfo}
      infoChipStatus={infoChipStatus}
      setInfoChipStatus={setInfoChipStatus}
      infoChipToolTip={infoChipToolTip}
      setInfoChipToolTip={setInfoChipToolTip}
      getGoogleUserInfo={getGoogleUserInfo}
      getGDriveMetadata={getGDriveMetadata}
      loadGSheetValues={loadGSheetValues}
      setVisualizerData={setVisualizerData}
      isLoading={isLoading}
      setIsLoading={setIsLoading}
     />

      {/* An <Outlet> renders whatever child route is currently active,
          so you can think about this <Outlet> as a placeholder for
          the child routes we defined above. */}
        <Outlet 
          context={[  visualizerData, 
                      isLoading,
                      padDateMin, padDateMax, 
                      suggestedYMax, 
                      achievementAnnotations, setAchievementAnnotations,
                    ]} 
        />
    </div>
  );
}