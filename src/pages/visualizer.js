import { React, useState, useEffect, useRef } from 'react';
import { useOutletContext } from "react-router-dom";
import { useCookies } from 'react-cookie';

import Box from '@mui/material/Box';
import LinearProgress from '@mui/material/LinearProgress';
import Stack from '@mui/material/Stack';

import Chart from 'chart.js/auto';    // FIXME: do I still need this now that I use Chart.register below?
import { Line } from 'react-chartjs-2';
import 'chartjs-adapter-date-fns';
import zoomPlugin from 'chartjs-plugin-zoom';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import annotationPlugin from 'chartjs-plugin-annotation';

import { VerticalChartControls, LiftControls, VizConfigZoom } from '../components/vizualizerChartControls';

import { Container } from '@mui/system';

Chart.register(zoomPlugin, ChartDataLabels, annotationPlugin);

const Visualizer = (props) => {

  const [ visualizerData, 
          isLoading,
          visualizerConfig,
          setVisualizerConfig,
        ] = useOutletContext();

  const [zoomRecent, setZoomRecent] = useState(true); // Zoom recent or zoom to all
  const [cookies, setCookie] = useCookies(['selectedLifts', 'ssid', 'tokenResponse']);
  const chartRef = useRef(null);

  // On chart load hide certain lifts that were hidden last sesssion (remembered via cookie)
  useEffect(() => {
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
  }, [visualizerData]); // Only run this effect once, on mount

  function zoomShowAllTime() {
    const chart = chartRef.current;
    if (chart) chart.zoomScale('x', { min: visualizerConfig.padDateMin, max: visualizerConfig.padDateMax }, "default");
  }

  function zoomShowRecent() {
    const chart = chartRef.current;
    if (chart) chart.resetZoom();
  }


  // When someone clicks an item in the legend we will:
  // 1) Show/Hide the line (default behaviour)
  // 2) Show/Hide PR annotations for that line
  // 3) Remember the choice in a cookie for next time
  const newLegendClickHandler = function (e, legendItem, legend) {
    const index = legendItem.datasetIndex;
    const ci = legend.chart;

    let selectedLifts = cookies.selectedLifts; // We assume this cookie is ALWAYS set
    let liftType = legendItem.text;
    let singleRM = visualizerConfig.achievementAnnotations[`${liftType}_best_1RM`];
    let tripleRM = visualizerConfig.achievementAnnotations[`${liftType}_best_3RM`];
    let fiveRM = visualizerConfig.achievementAnnotations[`${liftType}_best_5RM`];

    if (ci.isDatasetVisible(index)) {
        console.log(`Hide ${legendItem.text}`);
        ci.hide(index);
        legendItem.hidden = true;
        if (singleRM) singleRM.display = false;
        if (tripleRM) tripleRM.display = false;
        if (fiveRM) fiveRM.display = false;
        selectedLifts = selectedLifts.filter((lift) => lift !== liftType);  // Exclude unclicked lift
    } else {
        console.log(`Show ${legendItem.text}`);
        ci.show(index);
        legendItem.hidden = false;
        if (singleRM) singleRM.display = true;
        if (tripleRM) tripleRM.display = true;
        if (fiveRM) fiveRM.display = true;
        selectedLifts = [...selectedLifts, liftType];  // Include clicked lift
    }
    // Update our cookie with the state of which lifts are selected
    setCookie('selectedLifts', JSON.stringify(selectedLifts), { path: '/' });

  }

  // Line Chart Options for react-chartjs-2 Visualizer 
  const sixtyDaysInMilliseconds = 60 * 24 * 60 * 60 * 1000;
  // console.log(`<Visualizer > padDateMin: ${visualizerConfig.padDateMin}, padDateMax: ${visualizerConfig.padDateMax}`);
  var chartOptions = {
    responsive: true,

    font: {family: "Catamaran"},

    onClick: (event, item) => { 
      // Used to detect a click on a graph point and open URL in the data.
      if (item && item.length > 0) {
        const url = item[0].element.$context.raw.url;
        if (url) window.open(url);
      }
    },

    scales: {
      x: {
          type: "time",
          min: visualizerConfig.min,      
          suggestedMax: visualizerConfig.padDateMax,
          time: {
            minUnit: "day"
          },
      },
      y: {
        suggestedMin: 0,
        suggestedMax: visualizerConfig.highestWeight, 

        ticks: {
          font: { family: "Catamaran", size: 15 },
          callback: (value) => {
            return `${value}`; // FIXME: insert unitType from data
          },
        },
      },
    },

    plugins: {

      title: {
        display: false,
        text: `Title`, // Weird title for testing purposes
        font: { size: 20 },
      },

      legend: {
        display: true,
        position: 'top',
        labels: {
          font: {
            font: "Catamaran",
            size: 18,
          },
        },
        onClick: newLegendClickHandler,
      },

      datalabels: {
        formatter: (context) => {
          return(context.y);
          },
        font: (context) => {
          // Mark heavy singles in bold data labels, and the e1rm estimate data labels as italic
          const liftSingle = context.dataset.data[context.dataIndex].label.indexOf("Potential");
          if (liftSingle === -1)
            return { family:"Catamaran", weight: "bold", size: 13 };
          else
            return { family: "Catamaran", style: "italic", size: 12 };
        },
        align: "end",
        anchor: "end",
      },

      tooltip: {
        enabled: true,
        position: "nearest",
        titleFont: { family: "Catamaran", size: 14 },
        bodyFont: { family: "Catamaran", size: 14 },
        callbacks: {
          title: (context) => {
            const d = new Date(context[0].parsed.x);
            const formattedDate = d.toLocaleString([], {
              year: "numeric",
              month: "long",
              day: "numeric",
            });
            return formattedDate;
          },
          label: (context) => context.raw.label,
          afterLabel: (context) => context.raw.afterLabel,
          footer: (context) => {
            const url = context[0].raw.url;
            if (url)
              return `Click to open ${url}`; // Tooltip reminder they can click to open video
          },
        }
      },

      zoom: {
        zoom: {
          wheel: {enabled: true,},
          mode: 'x',   
        },
        pan: {
          enabled: true,
          mode: 'x',
        },
        limits: {
          x: { min: visualizerConfig.padDateMin, max: visualizerConfig.padDateMax, minRange: sixtyDaysInMilliseconds },
        },
      },

      annotation: {
          annotations: visualizerConfig.achievementAnnotations,
          },
      },
  };

  return (
      <Container maxWidth='xl'>

          { (!visualizerData && !cookies.ssid) && <NewUserWelcome /> } 
          { (!visualizerData && cookies.ssid) && <ReturningUserWelcome tokenResponse={cookies.tokenResponse} /> } 

          {/* FIXME: I like this Liner Progress UI but I would like it center middle of the page  */}
          { isLoading && <LoadingLinearProgress /> }

          { visualizerData && <Line ref={chartRef} data={visualizerData} options={chartOptions}/> }
          { visualizerData && <VizConfigZoom zoomShowAllTime={zoomShowAllTime} zoomShowRecent={zoomShowRecent} /> }

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