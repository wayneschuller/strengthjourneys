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

import { 
  liftAnnotations, 
} from "../components/visualizerDataProcessing";

import ChartControls from '../components/vizualizerChartControls';

import { dummyProcessedData } from '../components/visualizerDataProcessing';


Chart.register(zoomPlugin, ChartDataLabels);

const Visualizer = (props) => {

  const [visualizerData, padDateMin, padDateMax ] = useOutletContext();
  const [minChartLines, setMinChartLines] = useState(3);
  const [maxChartLines, setMaxChartLines] = useState(8);
  const [zoomRecent, setZoomRecent] = useState(true); // Zoom recent or zoom to all

  const chartRef = useRef(null);

  useEffect(() => {
    // console.log(`<Visualizer /> useEffect zoomRecent: ${zoomRecent}`);
    const chart = chartRef.current;

    if (!visualizerData) return;


    let padDateMin = new Date(visualizerData.datasets[0].data[0].x); // First tuple in first lift
    padDateMin = padDateMin.setDate(padDateMin.getDate() - 4);
    let padDateMax = new Date(visualizerData.datasets[0].data[visualizerData.datasets[0].data.length - 1].x); // Last tuple in first lift
    padDateMax = padDateMax.setDate(padDateMax.getDate() + 14);

    if (zoomRecent) {
      // Set the zoom/pan to the last 6 months of data if we have that much
      let recentXAxisMin = new Date(padDateMax - 1000 * 60 * 60 * 24 * 30 * 6);
      if (recentXAxisMin < padDateMin) recentXAxisMin = padDateMin;
      let recentXAxisMax = new Date(padDateMax);
      chart.zoomScale("x", { min: recentXAxisMin.getTime(), max: recentXAxisMax.getTime() }, "default");
    } else {
      // Zoom out to show all time
      chart.zoomScale("x", { min: padDateMin, max: padDateMax }, "default");
    }

  }, [zoomRecent])

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
          suggestedMin: {padDateMin},
          suggestedMax: {padDateMax},
          distribution: "linear",  // FIXME: necessary?
          time: {
            minUnit: "day"
          },
      },
      y: {
        suggestedMin: 0,
        suggestedMax: 250, // FIXME: don't hardcode this but base it on data

        ticks: {
          font: { family: "Catamaran", size: 15 },
          callback: (value) => {
            return `${value}kg`; // FIXME: unhardcode units
          },
        },
      },
    },

    layout: {
      padding: {
        right: 50,
      },
    },

    plugins: {

      title: {
        display: false,
        text: 'Chart.js Line Chart',
        font: { size: 20 },
      },

      legend: {
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
    }

  };

  return (
    <div>
     <Box sx={{ m: 1 }} >
      <Grid container spacing={1} >

        { !visualizerData && 
        <Grid md={12}>
        <Typography variant="h3" gutterBottom>Strength Visualizer </Typography>
        </Grid>
        }


        <Grid md={10}>
          { visualizerData && <Line ref={chartRef} data={visualizerData} options={chartOptions}/> }
        </Grid>
        <Grid md={2}>
          { visualizerData && <ChartControls 
                                zoomRecent={zoomRecent} 
                                setZoomRecent={setZoomRecent} 
                                /> 
          }


        </Grid>
      </Grid>
      </Box>
    </div>
  );
}

export default Visualizer;


// The OLD project config - here for reference while porting
export function getFartConfig() {

  const configOld = {
    type: "line",
    options: {
      plugins: {
        annotation: {
          annotations: liftAnnotations,
        },
      },
    },
  };
  return configOld;
}

// Generate chart.js annotation plugin config data for an achievement
function createAchievementAnnotation(date, weight, text, background, datasetIndex) {
  return {
    type: "label",
    borderColor: (context) => context.chart.data.datasets[datasetIndex].backgroundColor,
    borderRadius: 3,
    borderWidth: 2,
    yAdjust: 20,
    content: [text],
    xValue: date,
    yValue: weight,
    backgroundColor: background,
    padding: {
      top: 2,
      left: 2,
      right: 2,
      bottom: 1,
    },
    display: (chart, options) => {
      // Only show if dataset line is visible on chart
      let meta = chart.chart.getDatasetMeta(datasetIndex);
      if (meta === undefined) return false;
      return meta.visible;
    },
    // scaleID: 'y',
  };
}