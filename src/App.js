/** @format */

import "./App.css";

import { useState, useEffect } from "react";
import { Outlet } from "react-router-dom";

import ResponsiveAppBar from "./components/appBar";
import { loadGSheetValues } from "./utils/loadGSheetValues";
import { useAuth } from "./utils/auth";
import { sampleData } from "./utils/sampleData";
import { processData } from "./utils/processData";
import { WelcomeModal } from "./components/welcome";

export default function App() {
  const auth = useAuth();

  // Top right information chip. FIXME: merge these two together.
  const [infoChipStatus, setInfoChipStatus] = useState("Choose Data Source"); // Used in the navbar info chip-button
  const [infoChipToolTip, setInfoChipToolTip] = useState(null);

  // These control the rendering of various progress and chart.js components
  const [isLoading, setIsLoading] = useState(false); // Used to show loading animation
  const [isDataReady, setIsDataReady] = useState(false); // Used to trigger when app is ready to render
  const [isDemoMode, setIsDemoMode] = useState(false); // Used to show demo Data

  // Main data elements. These may not need to be in React state.
  const [parsedData, setParsedData] = useState(sampleData);
  const [visualizerData, setVisualizerData] = useState(null);
  const [analyzerData, setAnalyzerData] = useState(null);

  console.log(`<App />...`);

  let didProcessSampleData = false;
  useEffect(() => {
    // console.log(`[] useEffect...`);

    if (!didProcessSampleData) {
      didProcessSampleData = true;
      setIsDemoMode(true);
      // Process the sample data for demo mode
      processData(parsedData, setVisualizerData, setAnalyzerData);
      setIsDataReady(true);
    }
  }, []);

  // Event handlers do most of the data flow for us
  // However we want this authorisation useEffect to auto load data on init when we have a previous accessToken
  let didInit = false;
  useEffect(() => {
    if (!didInit && auth?.user) {
      didInit = true;
      setIsDemoMode(false);
      // ✅ Only runs once per app load
      loadGSheetValues(
        setInfoChipStatus,
        setInfoChipToolTip,
        setIsLoading,
        setIsDataReady,
        setVisualizerData,
        setParsedData,
        setAnalyzerData,
        auth
      );
    }
  }, [auth.user]);

  return (
    <div>
      <ResponsiveAppBar
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
        parsedData={parsedData}
        setParsedData={setParsedData}
        analyzerData={analyzerData}
        setAnalyzerData={setAnalyzerData}
      />

      {/* An <Outlet> renders whatever child route is currently active,
          so you can think about this <Outlet> as a placeholder for
          the child routes we defined above. */}
      <Outlet
        context={[
          isLoading,
          isDataReady,
          parsedData,
          setParsedData,
          visualizerData,
          setVisualizerData,
          analyzerData,
          setAnalyzerData,
        ]}
      />

      {isDemoMode && <WelcomeModal />}
    </div>
  );
}
