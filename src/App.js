import './App.css';

import { useState, useEffect } from "react";
import { Outlet } from "react-router-dom";

import ResponsiveAppBar from './components/appBar';
import { getGoogleUserInfo } from './utils/readData';

export default function App() {
  const [dataModifiedTime, setDataModifiedTime] = useState(0); // Unix timestamp
  const [userInfo, setUserInfo] = useState(null);  // .name .picture .email (from Google userinfo API)
  const [infoChipStatus, setInfoChipStatus] = useState("Choose Data Source");  // Used in the navbar info chip-button
  const [infoChipToolTip, setInfoChipToolTip] = useState(null);  
  const [isLoading, setIsLoading] = useState(false); // Use to show loading animation
  const [visualizerData, setVisualizerData] = useState(null);
  const [equation, setEquation] = useState('Brzycki');
  const [visualizerConfig, setVisualizerConfig] = useState({
    padDateMin: null,
    padDateMax: null,
    highestWeight: null,
    sixMonthsAgo: null,
    min: null,
    achievementAnnotations: null,
  });
  console.log(`<App />...`)

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
        setVisualizerData,
        visualizerConfig, setVisualizerConfig,
        equation,
        );
    }
  }, []);

  // useEffect(() => {
  //   console.log(`equation useEffect: ${equation}`)

  //   // Has equation changed from the localStorage previous version?

  //     // Process data again

  //     // Change equation in localStorage

  // }, [equation]);

  return (
    <div>

     <ResponsiveAppBar 
      userInfo={userInfo}
      setUserInfo={setUserInfo}
      infoChipStatus={infoChipStatus}
      setInfoChipStatus={setInfoChipStatus}
      infoChipToolTip={infoChipToolTip}
      setInfoChipToolTip={setInfoChipToolTip}
      setVisualizerData={setVisualizerData}
      isLoading={isLoading}
      setIsLoading={setIsLoading}
      visualizerConfig={visualizerConfig}
      setVisualizerConfig={setVisualizerConfig}
     />

      {/* An <Outlet> renders whatever child route is currently active,
          so you can think about this <Outlet> as a placeholder for
          the child routes we defined above. */}
        <Outlet 
          context={[  visualizerData, 
                      isLoading,
                      visualizerConfig,
                      setEquation,
                    ]} 
        />
    </div>
  );
}