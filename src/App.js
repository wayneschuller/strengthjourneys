/** @format */

import "./App.css";

import { useState, useEffect } from "react";
import { Outlet } from "react-router-dom";

import ResponsiveAppBar from "./components/appBar";
import { loadGSheetValues } from "./utils/loadGSheetValues";
import { useAuth } from "./utils/auth";
import { sampleData } from "./utils/sampleData";
import { processData } from "./utils/processData";
import { WelcomeModal, sampleGSheet } from "./components/welcome";

export default function App() {
  const auth = useAuth();

  const [infoChip, setInfoChip] = useState({ label: "Choose Data Source", tooltip: null });
  const [sheetIcon, setSheetIcon] = useState({ url: sampleGSheet, tooltip: "Click to open sample Google Sheet data" });
  const [appStatus, setAppStatus] = useState("demo"); // 'demo' | 'ready' | 'loading' | 'processed'

  // Main data elements. These may not need to be in React state.
  const [parsedData, setParsedData] = useState(sampleData);
  const [visualizerData, setVisualizerData] = useState(null);
  const [analyzerData, setAnalyzerData] = useState(null);

  console.log(`<App />...`);

  let didProcessSampleData = false;
  useEffect(() => {
    // console.log(`[] useEffect...`);

    // Don't process sample data if are about to autoload from previous session
    const credential = JSON.parse(localStorage.getItem(`googleCredential`));
    const ssid = localStorage.getItem(`ssid`);
    if (credential && ssid) return;

    if (!didProcessSampleData) {
      didProcessSampleData = true;

      // Process the sample data for demo mode
      processData(parsedData, setVisualizerData, setAnalyzerData);
    }
  }, []);

  // Event handlers do most of the data flow for us
  // However we want this authorisation useEffect to auto load data on init when we have a previous accessToken
  // FIXME: we could be processing the sample data here and defaulting to demo mode
  let didInit = false;
  useEffect(() => {
    if (!didInit && auth?.user) {
      didInit = true;
      setAppStatus("loading");
      // ✅ Only runs once per app load
      loadGSheetValues(
        setAppStatus,
        setInfoChip,
        setVisualizerData,
        setParsedData,
        setAnalyzerData,
        auth,
        setSheetIcon
      );
    }
  }, [auth.user]);

  return (
    <div>
      <ResponsiveAppBar
        appStatus={appStatus}
        setAppStatus={setAppStatus}
        infoChip={infoChip}
        setInfoChip={setInfoChip}
        visualizerData={visualizerData}
        setVisualizerData={setVisualizerData}
        parsedData={parsedData}
        setParsedData={setParsedData}
        analyzerData={analyzerData}
        setAnalyzerData={setAnalyzerData}
        sheetIcon={sheetIcon}
        setSheetIcon={setSheetIcon}
      />

      {/* An <Outlet> renders whatever child route is currently active,
          so you can think about this <Outlet> as a placeholder for
          the child routes we defined above. */}
      <Outlet
        context={[
          appStatus,
          parsedData,
          setParsedData,
          visualizerData,
          setVisualizerData,
          analyzerData,
          setAnalyzerData,
        ]}
      />

      {appStatus === "demo" && <WelcomeModal />}
    </div>
  );
}
