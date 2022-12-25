import './App.css';

import { React, useState } from "react";
import { Outlet } from "react-router-dom";

import Container from '@mui/material/Container';
import Box from '@mui/material/Box';

import ResponsiveAppBar from './components/appBar';
import { defaultVisualizerData } from './components/visualizerDataProcessing';

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
     <Box sx={{ m: 1 }} md={{ m: 3}} >
       <Container maxWidth="xl" sx={{ borderRadius: '6px', border: '1px solid grey', boxShadow: '13', backgroundColor: 'palette.secondary.light' }}>
        <Outlet 
          context={[parsedData, visualizerData, setVisualizerData]} 
        />
       </Container>
     </Box>
    </div>
  );
}