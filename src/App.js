import './App.css';

import { useState, useEffect } from "react";
import { Outlet } from "react-router-dom";

import { useCookies } from 'react-cookie';
import ResponsiveAppBar from './components/appBar';
import { getGoogleUserInfo } from './utils/readData';

export default function App() {
  const [dataModifiedTime, setDataModifiedTime] = useState(0); // Unix timestamp
  const [cookies] = useCookies(['ssid', 'tokenResponse']);
  const [userInfo, setUserInfo] = useState(null);  // .name .picture .email (from Google userinfo API)
  const [infoChipStatus, setInfoChipStatus] = useState("Choose Data Source");  // Used in the navbar info chip-button
  const [infoChipToolTip, setInfoChipToolTip] = useState(null);  
  const [isLoading, setIsLoading] = useState(false); // Use to show loading animation
  const [visualizerData, setVisualizerData] = useState(null);
  const [visualizerConfig, setVisualizerConfig] = useState({
    padDateMin: null,
    padDateMax: null,
    highestWeight: null,
    sixMonthsAgo: null,
    achievementAnnotations: null,
  });

  // Event handlers do most of the data flow for us
  // However we want this mount useEffect to auto load data on init from cookies
  let didInit = false;
  useEffect(() => {
    if (!didInit && cookies.tokenResponse) {
      didInit = true;
      // ✅ Only runs once per app load
      getGoogleUserInfo(cookies.ssid, cookies.tokenResponse,
        setUserInfo,
        setInfoChipStatus,
        setInfoChipToolTip,
        setIsLoading,
        setVisualizerData,
        visualizerConfig, setVisualizerConfig,
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
                      visualizerConfig, setVisualizerConfig,
                    ]} 
        />
    </div>
  );
}