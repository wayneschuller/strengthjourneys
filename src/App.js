import './App.css';

import { React, useState } from "react";
import { Outlet } from "react-router-dom";

import Container from '@mui/material/Container';
import Box from '@mui/material/Box';

import ResponsiveAppBar from './components/appBar';

export default function App() {

  const [parsedData, setParsedData] = useState(null);  // A set of parsed lifting data

  // visualizerData with some dummy defaults
  // This is estimated one rep max data + extra analysis for the visualizer
  const [visualizerData, setVisualizerData] = useState ({
    dateTime: 1,    // unix epoch timestamp of when data was loaded  
    datasets: [{
      label: "Back Squat Sample Data",
      data: [
        {
          x: '2015-10-11', 
          y: 196,
          label: "Potential blah da blah",
        }, 
        {
          x: '2015-11-02', 
          y: 170,
          label: "potential doop de doop",
        },
        {
          x: '2015-11-05', 
          y: 130,
          label: "potential nope",
        },
      ]
    }]
  });

  return (
    <div>

     <ResponsiveAppBar 
      setParsedData={setParsedData}
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