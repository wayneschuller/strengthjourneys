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

  const [padDateMin, setPadDateMin] = useState(null);
  const [padDateMax, setPadDateMax] = useState(null);
  const [recentXAxisMin, setRecentXAxisMin] = useState(null);
  const [recentXAxisMax, setRecentXAxisMax] = useState(null);
  const [suggestedYMax, setSuggestedYMax] = useState(null);
  const [achievementAnnotations, setAchievementAnnotations] = useState(null);

  // ------------------------------------------------------------------
  // Data processing flow:
  //
  //    getGoogleUserInfo->checkGSheetModified->loadGSheetValues
  //
  // Flow is mostly triggered by event handlers, but also can process
  // the data on launch if they have a valid token and ssid in cookies
  // ------------------------------------------------------------------
  async function getGoogleUserInfo(tokenResponse) {
    console.log(`getGoogleUserInfo()...`);

    if (!tokenResponse && tokenResponse.access_token) {
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
        if (cookies.ssid !== undefined && cookies.ssid.length > 10) 
          checkGSheetModified(tokenResponse);
      })
      .catch((error) => {
        console.log(`axios.get UserInfo error:`);
        console.log(error.response);

        // Just in case we had a working tokenResponse that has now expired.

        // TODO: It would be good to set some informative UI to past users than they need to sign in again.
        // TODO: Don't treat old users like new users...
        setUserInfo(null);
        removeCookie('tokenResponse'); // Forget the tokenReponse 

      })
  }

  async function checkGSheetModified (tokenResponse) {
    console.log("checkGSheetModified()...");

    // API call to get GDrive file metadata to get modified time and the filename
    await axios
      .get(`https://www.googleapis.com/drive/v3/files/${cookies.ssid}?fields=modifiedTime%2Cname&key=${process.env.REACT_APP_GOOGLE_API_KEY}`, {
        headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
      })
      .then((response) => {
        // handle success
        // console.log(`API get GDrive file metadata .then received:`);
        // console.log(response.data);
        setInfoChipToolTip(response.data.name);

        // If the modified time is newer then refresh the data from Google Sheets
        const modifiedTime = Date.parse(response.data.modifiedTime);
        // console.log(`useState dataModifiedTime: ${dataModifiedTime}. Response: ${modifiedTime}`);
        if (modifiedTime > dataModifiedTime) {
          setDataModifiedTime(modifiedTime);
          loadGSheetValues(cookies.ssid, tokenResponse);
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
  async function getGSheetMetadata () {
      console.log("getGSheetMetadata()...");

      await axios
        .get(`https://sheets.googleapis.com/v4/spreadsheets/${cookies.ssid}?includeGridData=false`, {
          headers: { Authorization: `Bearer ${cookies.tokenResponse.access_token}` },
        })
        .then((response) => {
          // handle success
          // console.log(`API get GSheet metadata .then received:`);
          // console.log(response.data);
        })
        .catch((error) => {
          setInfoChipStatus("Error Reading Google Sheet Metadata");
          setInfoChipToolTip(error.response.data.error.message);
          console.log(error);
        })
    }

  async function loadGSheetValues(ssid, tokenResponse) {
      console.log("loadGSheetValues()...");

      await axios
      .get(`https://sheets.googleapis.com/v4/spreadsheets/${ssid}/values/A%3AZ?dateTimeRenderOption=FORMATTED_STRING&key=${process.env.REACT_APP_GOOGLE_API_KEY}`, {
          headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
        })
        .then((response) => {

          setInfoChipStatus("Data Source Connected");

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

          // Also set some unixtimes for the last 6 months.
          // Set the zoom/pan to the last 6 months of data if we have that much
          // FIXME: we could simply use padeDateMax and calculate 6 months from that. Remove recentXAxisMin/Max state
          let recentXAxisMin = new Date(padDateMax - 1000 * 60 * 60 * 24 * 30 * 6);
          if (recentXAxisMin < padDateMin) recentXAxisMin = padDateMin;
          let recentXAxisMax = new Date(padDateMax);
          setRecentXAxisMin(recentXAxisMin);
          setRecentXAxisMax(recentXAxisMax);

          // Search through the processed data and find the largest estimate
          // Round up to the nearest 50
          let yMax = 220;
          setSuggestedYMax(yMax);

          // Lastly, load in the data.
          setVisualizerData(processed);
        })
        .catch((error) => {
          setInfoChipStatus("Error Reading Google Sheet");
          console.log(error);
          // setInfoChipToolTip(error.response.data.error.message);
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
      loadGSheetValues={loadGSheetValues}
      setVisualizerData={setVisualizerData}
     />

      {/* An <Outlet> renders whatever child route is currently active,
          so you can think about this <Outlet> as a placeholder for
          the child routes we defined above. */}
        <Outlet 
          context={[  visualizerData, 
                      padDateMin, padDateMax, 
                      recentXAxisMin, setRecentXAxisMin,
                      recentXAxisMax, 
                      suggestedYMax, 
                      achievementAnnotations, setAchievementAnnotations,
                    ]} 
        />
    </div>
  );
}