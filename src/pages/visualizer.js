import { React, useEffect } from 'react';
import { useOutletContext } from "react-router-dom";
import { useCookies } from 'react-cookie';

import Box from '@mui/material/Box';
import LinearProgress from '@mui/material/LinearProgress';
import Stack from '@mui/material/Stack';
import { Container } from '@mui/system';

import { SJLineChart } from '../components/SJLineChart';

// Chart.register(zoomPlugin, ChartDataLabels, annotationPlugin);

const Visualizer = (props) => {
  console.log(`<Visualizer />...`);

  const [ visualizerData, 
          isLoading,
          visualizerConfig, 
          setEquation,
        ] = useOutletContext();


  return (
      <Container maxWidth='xl'>

          { (!visualizerData && !cookies.ssid) && <NewUserWelcome /> } 
          { (!visualizerData && cookies.ssid) && <ReturningUserWelcome tokenResponse={cookies.tokenResponse} /> } 

          {/* FIXME: I like this Liner Progress UI but I would like it center middle of the page  */}
          { !visualizerData ? <LoadingLinearProgress /> : <SJLineChart  visualizerData={visualizerData} 
                                                                        visualizerConfig={visualizerConfig} 
                                                                        setEquation={setEquation}
                                                                        /> }

      </Container>
  );
}

export default Visualizer;

function NewUserWelcome() {

  return (
    <div>
     <Box sx={{ m: 1 }} md={{ m: 3}} >
       <Container maxWidth="xl" sx={{ borderRadius: '6px', border: '1px solid grey', backgroundColor: 'palette.secondary.light' }}>
          <h1>Welcome to Strength Journeys</h1>
          <h3>Visualize your lifting history - lift consistently for a long time.</h3>
          <p>We recommend every lifter record and own their own data in a Google Sheet. (Don't just let your health and fitness data be trapped in someone else's application.)</p>
          <p>Here is our custom <a href="https://docs.google.com/spreadsheets/d/14J9z9iJBCeJksesf3MdmpTUmo2TIckDxIQcTx1CPEO0/edit#gid=0" target="_blank">Google Sheet data format</a>. 
            From Google Sheets, click "File" menu and then click "Make a copy" and edit with your data.</p>
       </Container>
     </Box>
    </div>
  );
}

function ReturningUserWelcome({ tokenResponse }) {
  return (
    <div>
       <Container maxWidth="xl" sx={{ borderRadius: '6px', border: '1px solid grey', backgroundColor: 'palette.secondary.light' }}>
          <h1>Welcome back to Strength Journeys.</h1>
          <h3>You are looking stronger than last time.</h3>

          { !tokenResponse && <><h3>Please click the "Google sign-in" button in the top right corner and we will visualize your greatness.</h3></> }
       </Container>
    </div>
  );
}


export function LoadingLinearProgress() {
  return (
    <Stack sx={{ width: '100%', color: 'grey.500' }} spacing={2}>
      <LinearProgress color="inherit" />
    </Stack>
  );
}