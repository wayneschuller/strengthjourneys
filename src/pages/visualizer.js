import { React, useEffect } from 'react';
import { useOutletContext } from "react-router-dom";

import 'chartjs-adapter-date-fns';

// import { 
  // Chart as ChartJS, 
  // Title,
  // CategoryScale,
  // LinearScale,
  // LineElement, 
  // PointElement, 
  // Tooltip, 
  // Legend 
// } from 'chart.js';

import 'chart.js/auto';
import { Line } from 'react-chartjs-2';

import { 
  chartClickHandler, 
  chartTitle, 
  liftAnnotations, 
  padDateMin, padDateMax, 
  unitType, 
  processVisualizerData
} from "../components/visualizerDataProcessing";

import { dummyProcessedData } from '../components/visualizerDataProcessing';

export let minChartLines = 3; // How many lifts to show by default
export let maxChartLines = 8; // Maximum number to graph - we will order by most popular lifts.

const basicColors = ["#ae2012", "#ee9b00", "#03045e", "#0a9396"];

// ChartJS.register(
  // Title,
  // CategoryScale,
  // LinearScale,
  // LineElement, 
  // PointElement, 
  // Tooltip, 
  // Legend 
// );

const Visualizer = (props) => {

  const [parsedData, visualizerData, setVisualizerData ] = useOutletContext();

  // When parsedData changes, let's process it for our visualizer
  useEffect(() => {
    console.log(`useEffect parsedData changed...`);
    if (!parsedData) return; // nothing further to do
    console.log(`useEffect: Attempting to process visualizer data...: ${JSON.stringify(parsedData[0])}`);
    let processed = processVisualizerData(parsedData);   // FIXME: check for errors?
    var wrapper = {
      datasets: createDataSets(processed, minChartLines, maxChartLines)
    }
    setVisualizerData(wrapper);
  }, [parsedData, setVisualizerData])

  return (
    <div>
      <h2>Strength Visualizer</h2>
      { parsedData ? 
        <>
        Logged in...
        </> : <>
        Please click the google-login button (top right) to configure data access.
        </>
        }
      <Line data={visualizerData} options={chartOptions}/> 
    </div>
  );
}

export default Visualizer;

// Line Chart Options for react-chartjs-2 Visualizer 
export const chartOptions = {
  responsive: true,

  font: {
    family: "Catamaran",
  },

  plugins: {

    title: {
      display: true,
      text: 'Chart.js Line Chart',
      font: { size: 20 },
    },

    legend: {
      position: 'top',
      labels: {
        font: {
          size: 18,
        },
      },
    },

    scales: {
      xAxis: {
        type: "time",
        // suggestedMin: padDateMin,
        // suggestedMax: padDateMax,
        time: {
          minUnit: "day",
        },
      },
      yAxis: {
        suggestedMin: 0,
        ticks: {
          font: { size: 15 },
          callback: (value) => {
            // return `${value}${unitType}`;
          },
        },
      },
    },
  },
};

// FIXME: some old functionality remaining here that needs to be ported
function createChart(data) {

  // Use the most popular lift to set some aesthetic x-axis padding at start and end
  // Right now only do this once on first csv load.
  // There is a chance loading another data set will require a new range, but unlikely.
  // padDateMin = new Date(processedData[0].e1rmLineData[0].x);
  padDateMin = padDateMin.setDate(padDateMin.getDate() - 4);
  // padDateMax = new Date(processedData[0].e1rmLineData[processedData[0].e1rmLineData.length - 1].x);
  padDateMax = padDateMax.setDate(padDateMax.getDate() + 14);

  // Set the zoom/pan to the last 6 months of data if we have that much
  let xAxisMin = new Date(padDateMax - 1000 * 60 * 60 * 24 * 30 * 6);
  if (xAxisMin < padDateMin) xAxisMin = padDateMin;
  let xAxisMax = new Date(padDateMax);
  // myChart.zoomScale("xAxis", { min: xAxisMin, max: xAxisMax }, "default");
}


// The OLD project config - here for reference while porting
export function getChartConfig() {
  // const data = {
    // datasets: createDataSets(minChartLines, maxChartLines),
  // };

  const zoomMinTimeRange = 1000 * 60 * 60 * 24 * 60; // 60 days limit to zoom in
  const zoomOptions = {
    limits: {
      x: { min: "original", max: "original", minRange: zoomMinTimeRange },
    },
    pan: {
      enabled: true,
      mode: "x",
    },
    zoom: {
      wheel: {
        enabled: true,
      },
      pinch: {
        enabled: true,
      },
      mode: "x",
    },
  };

  // Chart.defaults.font.family = "Catamaran";

  const config = {
    type: "line",
    // plugins: [ChartDataLabels],
    options: {
      onClick: chartClickHandler,
      plugins: {
        title: {
          text: chartTitle,
          display: true,
          font: { size: 18 },
        },
        zoom: zoomOptions,
        annotation: {
          annotations: liftAnnotations,
        },
        datalabels: {
          formatter: (context) => context.y,
          font: (context) => {
            // Mark heavy singles in bold data labels, and the e1rm estimate data labels as italic
            const liftSingle = context.dataset.data[context.dataIndex].label.indexOf("Potential");
            if (liftSingle === -1)
              return { weight: "bold", size: 13 };
            else
              return { style: "italic", size: 12 };
          },
          align: "end",
          anchor: "end",
        },
        tooltip: {
          enabled: true,
          position: "nearest",
          titleFont: { size: 14 },
          bodyFont: { size: 14 },
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
          },
        },
        legend: {
          labels: {
            font: {
              size: 18,
            },
          },
        },
      },
      scales: {
        xAxis: {
          type: "time",
          suggestedMin: padDateMin,
          suggestedMax: padDateMax,
          time: {
            minUnit: "day",
          },
        },
        yAxis: {
          suggestedMin: 0,
          ticks: {
            font: { size: 15 },
            callback: (value) => {
              return `${value}${unitType}`;
            },
          },
        },
      },
    },
  };
  return config;
}


// createDataSets
// Push our first num visualizer processedData into chart.js datasets
// max = number of data sets to create
// min = the default number that display (the rest will begin hidden)
function createDataSets(processedData, min, max) {
  var dataSets = [];

  console.log("createDataSets()...");

  let hidden = false;

  for (let i = 0; i < max; i++) {
    // Choose a beautiful color
    let color;
    const randomColor = `#${Math.floor(Math.random() * 16777215).toString(16)}`;

    color = i >= min ? randomColor : basicColors[i];

    if (i >= min) hidden = true; // Initially hide the lines above the minimum

    // Check if we have this data to chart, then push it on
    if (processedData[i] && processedData[i].label && processedData[i].data)
      dataSets.push({
        label: processedData[i].label,
        backgroundColor: color,
        borderColor: "rgb(50, 50, 50)",
        borderWidth: 2,
        pointStyle: "circle",
        radius: 4,
        hitRadius: 20,
        hoverRadius: 10,
        cubicInterpolationMode: "monotone",
        hidden: hidden,
        data: processedData[i].data,
      });
  }
  return dataSets;
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

// Show/hide the chart.js achievement annotations on the chart
function toggleAchievements() {
  const toggleInput = document.getElementById("toggleAchievements");
  if (toggleInput.value === "Hide") {
    // The user wants to hide achievements overlay
    // myChart.config.options.plugins.annotation.annotations = null;

    // Change the toggle button
    toggleInput.value = "Show";
    toggleInput.innerHTML = "Show Achievements";
  } else {
    // The user wants to show achievements overlay
    // myChart.config.options.plugins.annotation.annotations = liftAnnotations;

    // Change the toggle button
    toggleInput.value = "Hide";
    toggleInput.innerHTML = "Hide Achievements";
  }
  // myChart.update();
}
