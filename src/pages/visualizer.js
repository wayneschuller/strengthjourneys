import { React, useState, useEffect, useRef } from 'react';
import { useOutletContext } from "react-router-dom";
import { useCookies } from 'react-cookie';

import Box from '@mui/material/Box';
import Grid from '@mui/material/Unstable_Grid2';
import Typography from '@mui/material/Typography';

import Chart from 'chart.js/auto';    // Causes large webpack but is easier than manually registering what you need.
import { Line } from 'react-chartjs-2';
import 'chartjs-adapter-date-fns';
import zoomPlugin from 'chartjs-plugin-zoom';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import annotationPlugin from 'chartjs-plugin-annotation';

import { VerticalChartControls, LiftControls } from '../components/vizualizerChartControls';

import { dummyProcessedData } from '../utils/visualizerDataProcessing';
import { Container } from '@mui/system';

Chart.register(zoomPlugin, ChartDataLabels, annotationPlugin);

const Visualizer = (props) => {

  const [ visualizerData, 
          padDateMin, 
          padDateMax, 
          recentXAxisMin, 
          setRecentXAxisMin, 
          recentXAxisMax, 
          suggestedYMax, 
          achievementAnnotations,
          setAchievementAnnotations,
        ] = useOutletContext();

  const [zoomRecent, setZoomRecent] = useState(true); // Zoom recent or zoom to all
  const [showAchievements, setShowAchievements] = useState(true); // PR/Achivement annotations
  const [selectedVisualizerData, setSelectedVisualizerData] = useState(null); 
  const [cookies, setCookie] = useCookies(['selectedChips']);

  const chartRef = useRef(null);

  // Every time visualizerData changes, wrap a new selectedVisualizerData
  // FIXME: could we prevent the rezoom in that happens here on data change?
  useEffect(() => {

    if (!visualizerData) return;

    if (cookies.selectedChips) {
      // If we have the cookie, modify our visualizerData so the .selected key matches what was in the cookie
      // console.log(`<Visualizer /> useEffect modifying visualizerData based on cookie`);
      visualizerData.forEach((item) => {
        item.selected = cookies.selectedChips.includes(item.label);
        if (item.selected) {
          // Turn on achievement annotations for this selected lift
          if (achievementAnnotations[`${item.label}_best_1RM`]) achievementAnnotations[`${item.label}_best_1RM`].display = true;
          if (achievementAnnotations[`${item.label}_best_3RM`]) achievementAnnotations[`${item.label}_best_3RM`].display = true;
          if (achievementAnnotations[`${item.label}_best_5RM`]) achievementAnnotations[`${item.label}_best_5RM`].display = true;
        } else {
          // Turn off achievement annotations for this NOT selected lift
          if (achievementAnnotations[`${item.label}_best_1RM`]) achievementAnnotations[`${item.label}_best_1RM`].display = false;
          if (achievementAnnotations[`${item.label}_best_3RM`]) achievementAnnotations[`${item.label}_best_3RM`].display = false;
          if (achievementAnnotations[`${item.label}_best_5RM`]) achievementAnnotations[`${item.label}_best_5RM`].display = false;
        }
      });  
    } else {

      // No cookie? Top three lifts is a good default
      if (visualizerData[0]) visualizerData[0].selected = true;
      if (visualizerData[1]) visualizerData[1].selected = true;
      if (visualizerData[2]) visualizerData[2].selected = true;
    }

    var wrapper = {
      datasets: visualizerData.filter(lift => lift.selected)
    };

    setSelectedVisualizerData(wrapper);

    // Also let us load the annotations for these lifts.
    

  }, [visualizerData]);

  // Line Chart Options for react-chartjs-2 Visualizer 
  const sixtyDaysInMilliseconds = 60 * 24 * 60 * 60 * 1000;
  const chartOptions = {
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
          min: recentXAxisMin,      // Default to zoomed in the last 6 months
          suggestedMax: padDateMax,
          time: {
            minUnit: "day"
          },
      },
      y: {
        suggestedMin: 0,
        suggestedMax: suggestedYMax, 

        ticks: {
          font: { family: "Catamaran", size: 15 },
          callback: (value) => {
            return `${value}kg`; // FIXME: unhardcode units
          },
        },
      },
    },

    plugins: {

      title: {
        display: false,
        text: `suggestedYMax: ${suggestedYMax}, PRs ${showAchievements}`, // Weird title for testing purposes
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
      },

      datalabels: {
        formatter: (context) => context.y,
        font: (context) => {
          // Mark heavy singles in bold data labels, and the e1rm estimate data labels as italic
          // FIXME: does not seem to be applying - probably a font selection issue?
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
          x: { min: padDateMin, max: padDateMax, minRange: sixtyDaysInMilliseconds },
        },
      },

      annotation: {
          annotations: achievementAnnotations,
          },
      },
  };

  return (
    <div>
      <Container maxWidth='xl'>
          { !visualizerData && <Typography> Welcome to Strength Journeys. Click Google sign in to continue. </Typography> } 

          { (visualizerData && selectedVisualizerData) && <Line ref={chartRef} data={selectedVisualizerData} options={chartOptions}/> }

          { (visualizerData && selectedVisualizerData) && <LiftControls
                                visualizerData={visualizerData}
                                setSelectedVisualizerData={setSelectedVisualizerData}
                                showAchievements={showAchievements}
                                achievementAnnotations={achievementAnnotations}
                                setAchievementAnnotations={setAchievementAnnotations}                                
                              />
          }
      </Container>
    </div>
  );
}

export default Visualizer;