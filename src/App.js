import './App.css';

import { useState, useEffect } from "react";
import { Outlet } from "react-router-dom";

import ResponsiveAppBar from './components/appBar';
import { getGoogleUserInfo } from './utils/readData';

export default function App() {
  const [parsedData, setParsedData] = useState(null);
  const [visualizerData, setVisualizerData] = useState(null);
  const [userInfo, setUserInfo] = useState(null);  // .name .picture .email (from Google userinfo API)
  const [infoChipStatus, setInfoChipStatus] = useState("Choose Data Source");  // Used in the navbar info chip-button
  const [infoChipToolTip, setInfoChipToolTip] = useState(null);  
  const [isLoading, setIsLoading] = useState(false); // Use to show loading animation
  const [visualizerConfig, setVisualizerConfig] = useState({
    padDateMin: null,
    padDateMax: null,
    highestWeight: null,
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

      localStorage.setItem('isInit', true);

      // ✅ Only runs once per app load
      getGoogleUserInfo(
        setUserInfo,
        setInfoChipStatus,
        setInfoChipToolTip,
        setIsLoading,
        visualizerData, setVisualizerData,
        visualizerConfig,  setVisualizerConfig,
        setParsedData,
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
      visualizerData={visualizerData}
      setVisualizerData={setVisualizerData}
      isLoading={isLoading}
      setIsLoading={setIsLoading}
      visualizerConfig={visualizerConfig}
      setVisualizerConfig={setVisualizerConfig}
      setParsedData={setParsedData}
     />

      {/* An <Outlet> renders whatever child route is currently active,
          so you can think about this <Outlet> as a placeholder for
          the child routes we defined above. */}
        <Outlet 
          context={[  parsedData,
                      isLoading,
                      visualizerData, setVisualizerData,
                      visualizerConfig, setVisualizerConfig,
                    ]} 
        />
    </div>
  );
}