import { React, useState, useEffect, useRef } from 'react';
import { useOutletContext } from "react-router-dom";

import Box from '@mui/material/Box';
import Grid from '@mui/material/Unstable_Grid2';
import Typography from '@mui/material/Typography';

import Chart from 'chart.js/auto';    // Causes large webpack but is easier than manually registering what you need.
import { Line } from 'react-chartjs-2';
import 'chartjs-adapter-date-fns';
import zoomPlugin from 'chartjs-plugin-zoom';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import annotationPlugin from 'chartjs-plugin-annotation';

import { ChartControls, LiftControls } from '../components/vizualizerChartControls';

import { dummyProcessedData } from '../utils/visualizerDataProcessing';


Chart.register(zoomPlugin, ChartDataLabels, annotationPlugin);

const Visualizer = (props) => {

  const [ visualizerData, 
          padDateMin, 
          padDateMax, 
          recentXAxisMin, 
          recentXAxisMax, 
          suggestedYMax, 
          achievementAnnotations,
          setAchievementAnnotations,
        ] = useOutletContext();

  const [zoomRecent, setZoomRecent] = useState(true); // Zoom recent or zoom to all
  const [showAchievements, setShowAchievements] = useState(true); // PR/Achivement annotations
  const [selectedVisualizerData, setSelectedVisualizerData] = useState(null); 

  const chartRef = useRef(null);


  // Every time visualizerData changes, wrap a new selectedVisualizerData
  useEffect(() => {

    if (!visualizerData) return;


    // FIXME: Top 4 is a good default, but try to remember their selection from last time.
    var wrapper = {
      datasets: [visualizerData[0], visualizerData[1], visualizerData[2], visualizerData[3]],
    };

    console.log(`Setting setSelectedVisualizerData`);
    console.log(wrapper);

    setSelectedVisualizerData(wrapper);

    visualizerData[0].hidden = false; // Let them see the top lift only as a default.

  }, [visualizerData]);

  useEffect(() => {
    // console.log(`<Visualizer /> useEffect zoomRecent: ${zoomRecent}`);
    const chart = chartRef.current;

    if (!chart || !padDateMin || !padDateMax) return;

    if (zoomRecent) {
      // console.log(`Chart controls setting chart.zoomScale ${recentXAxisMin.getTime()}, ${recentXAxisMax.getTime()}`);
      chart.zoomScale("x", { min: recentXAxisMin.getTime(), max: recentXAxisMax.getTime() }, "default");
    } else {
      // Zoom out to show all time
      chart.zoomScale("x", { min: padDateMin, max: padDateMax }, "default");
    }

  }, [zoomRecent]);

  // Line Chart Options for react-chartjs-2 Visualizer 
  const zoomMinTimeRange = 1000 * 60 * 60 * 24 * 60; // Minimum x-axis is 60 days
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
          suggestedMin: padDateMin, 
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
          x: { min: "original", max: "original", minRange: zoomMinTimeRange },
        },
      },

      annotation: {
          annotations: achievementAnnotations,
          },
      },
  };

  return (
    <div>
     <Box sx={{ m: 4 }} >
      <Grid container spacing={1} >

        { !visualizerData && 
        <Grid md={12}>
          <Typography variant="h3" gutterBottom>Strength Visualizer </Typography>
        </Grid>
        }


        <Grid md={10}>
          { (visualizerData && selectedVisualizerData) && <Line ref={chartRef} data={selectedVisualizerData} options={chartOptions}/> }
        </Grid>
        <Grid md={2}>
          { (visualizerData && selectedVisualizerData) && <ChartControls 
                                zoomRecent={zoomRecent} 
                                setZoomRecent={setZoomRecent} 
                                showAchievements={showAchievements}
                                setShowAchievements={setShowAchievements}
                                /> 
          }
        </Grid>


        <Grid md={12}>
          { (visualizerData && selectedVisualizerData) && <LiftControls
                                visualizerData={visualizerData}
                                setSelectedVisualizerData={setSelectedVisualizerData}
                                showAchievements={showAchievements}
                                achievementAnnotations={achievementAnnotations}
                                setAchievementAnnotations={setAchievementAnnotations}                                
                              />
          }
        </Grid>

      </Grid>
      </Box>
    </div>
  );
}

export default Visualizer;