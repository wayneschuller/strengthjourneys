import './App.css';

import { useState, useEffect } from "react";
import { Outlet } from "react-router-dom";


import ResponsiveAppBar from './components/appBar';

export default function App() {

  const [parsedData, setParsedData] = useState(null);  
  const [visualizerData, setVisualizerData] = useState(null);

  return (
    <div>

     <ResponsiveAppBar 
      setParsedData={setParsedData}
      setVisualizerData={setVisualizerData}
     />

      {/* An <Outlet> renders whatever child route is currently active,
          so you can think about this <Outlet> as a placeholder for
          the child routes we defined above. */}
        <Outlet 
          context={[parsedData, visualizerData]} 
        />
    </div>
  );
}