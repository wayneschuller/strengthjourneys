/** @format */

import "./App.css";

import { useState, useEffect } from "react";
import { Outlet } from "react-router-dom";

import ResponsiveAppBar from "./components/appBar";
import { getGoogleUserInfo } from "./utils/readData";

export default function App() {
  const [userInfo, setUserInfo] = useState(null); // .name .picture .email (from Google userinfo API)

  // Top right information chip. FIXME: merge these two together.
  const [infoChipStatus, setInfoChipStatus] = useState("Choose Data Source"); // Used in the navbar info chip-button
  const [infoChipToolTip, setInfoChipToolTip] = useState(null);

  // These control the rendering of various progress and chart.js components
  const [isLoading, setIsLoading] = useState(false); // Used to show loading animation
  const [isDataReady, setIsDataReady] = useState(false); // Used to trigger when app is ready to render

  // Main data elements. These may not need to be in React state.
  const [parsedData, setParsedData] = useState(null);
  const [visualizerData, setVisualizerData] = useState(null);
  const [analyzerData, setAnalyzerData] = useState(null);

  console.log(`<App />...`);

  // Event handlers do most of the data flow for us
  // However we want this mount useEffect to auto load data on init when we have a previous tokenResponse and ssid
  let didInit = false;
  useEffect(() => {
    const tokenResponse = JSON.parse(localStorage.getItem(`tokenResponse`));

    if (!didInit && tokenResponse) {
      didInit = true;

      // ✅ Only runs once per app load
      getGoogleUserInfo(
        setUserInfo,
        setInfoChipStatus,
        setInfoChipToolTip,
        setIsLoading,
        setIsDataReady,
        visualizerData,
        setVisualizerData,
        setParsedData,
        setAnalyzerData
      );
    }
  }, []);

  return (
    <div>
      <ResponsiveAppBar
        userInfo={userInfo}
        setUserInfo={setUserInfo}
        infoChipStatus={infoChipStatus}
        setInfoChipStatus={setInfoChipStatus}
        infoChipToolTip={infoChipToolTip}
        setInfoChipToolTip={setInfoChipToolTip}
        isLoading={isLoading}
        setIsLoading={setIsLoading}
        isDataReady={isDataReady}
        setIsDataReady={setIsDataReady}
        visualizerData={visualizerData}
        setVisualizerData={setVisualizerData}
        setParsedData={setParsedData}
        setAnalyzerData={setAnalyzerData}
      />

      {/* An <Outlet> renders whatever child route is currently active,
          so you can think about this <Outlet> as a placeholder for
          the child routes we defined above. */}
      <Outlet
        context={[parsedData, isLoading, isDataReady, visualizerData, setVisualizerData, analyzerData, setAnalyzerData]}
      />
    </div>
  );
}
