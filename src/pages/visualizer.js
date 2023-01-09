import { React, useEffect } from 'react';
import { useOutletContext } from "react-router-dom";
import { useCookies } from 'react-cookie';

import Box from '@mui/material/Box';
import LinearProgress from '@mui/material/LinearProgress';
import Stack from '@mui/material/Stack';
import { Container } from '@mui/system';

// import Chart from 'chart.js/auto';    // FIXME: do I still need this now that I use Chart.register below?
// import { Line } from 'react-chartjs-2';
// import 'chartjs-adapter-date-fns';
// import zoomPlugin from 'chartjs-plugin-zoom';
// import ChartDataLabels from 'chartjs-plugin-datalabels';
// import annotationPlugin from 'chartjs-plugin-annotation';

import { SJLineChart } from '../components/SJLineChart';

// Chart.register(zoomPlugin, ChartDataLabels, annotationPlugin);

const Visualizer = (props) => {
  console.log(`<Visualizer />...`);

  const [ visualizerData, 
          isLoading,
          visualizerConfig, 
          setEquation,
        ] = useOutletContext();

  const [cookies, setCookie] = useCookies(['selectedLifts', 'ssid', 'tokenResponse']);

  // On chart load hide certain lifts that were hidden last sesssion (remembered via cookie)
  useEffect(() => {
    console.log(`Visualiser useEffect [visualizerData]`);

    return; // FIXME: This should maybe be moved into SJLineChart.js wrapper?

    if (!visualizerData) return; 

    if (cookies.selectedLifts) {
      
      // Loop through visualizerData and hide the lifts not in the cookie
      visualizerData.datasets.forEach(lift => {
        if (!cookies.selectedLifts.includes(lift.label)) {
          lift.hidden = true;     // Hide the lift on the legend (strikethrough appears)

          // Hide the corresponding annotations
          let singleRM = visualizerConfig.achievementAnnotations[`${lift.label}_best_1RM`];
          let tripleRM = visualizerConfig.achievementAnnotations[`${lift.label}_best_3RM`];
          let fiveRM = visualizerConfig.achievementAnnotations[`${lift.label}_best_5RM`];
          if (singleRM) singleRM.display = false;
          if (tripleRM) tripleRM.display = false;
          if (fiveRM) fiveRM.display = false;

        }
      });

    } else {
      // We have no cookie so let's make one for next time with every lift
      let selectedLifts = visualizerData.datasets.map(item => item.label);
      setCookie('selectedLifts', JSON.stringify(selectedLifts), { path: '/' });
    }

    // const chart = chartRef.current;
    // if (chart) chart.zoomScale('x', { min: visualizerConfig.sixMonthsAgo, max: visualizerConfig.padDateMax }, "default");

  }, [visualizerData]); // Only run this effect once, on mount

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