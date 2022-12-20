import './App.css';

import { React, useState } from "react";
import { Outlet } from "react-router-dom";

import Container from '@mui/material/Container';
import Box from '@mui/material/Box';

import ResponsiveAppBar from './components/appBar';

export default function App() {

  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isVisualizerDataProcessed, setIsVisualizerDataProcessed] = useState(false);

  return (
    <div>

     <ResponsiveAppBar 
      isAuthenticated={isAuthenticated} 
      setIsAuthenticated={setIsAuthenticated} 
      isVisualizerDataProcessed={isVisualizerDataProcessed} 
      setIsVisualizerDataProcessed={setIsVisualizerDataProcessed} 
     />

      {/* An <Outlet> renders whatever child route is currently active,
          so you can think about this <Outlet> as a placeholder for
          the child routes we defined above. */}
     <Box sx={{ m: 1 }} md={{ m: 3}} >
       <Container maxWidth="lg" sx={{ borderRadius: '6px', border: '1px solid grey', boxShadow: '13', backgroundColor: 'palette.secondary.light' }}>
        <Outlet 
          context={[isAuthenticated, setIsAuthenticated], [isVisualizerDataProcessed, setIsVisualizerDataProcessed]} 
        />
       </Container>
     </Box>
    </div>
  );
}