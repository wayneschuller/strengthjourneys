
import { useEffect, useRef } from "react";
import Chart from "chart.js/auto"; // Pick everything. You can hand pick which chartjs features you want, see chartjs docs.
import { Line } from "react-chartjs-2";
import "chartjs-adapter-date-fns";
import zoomPlugin from "chartjs-plugin-zoom";
import ChartDataLabels from "chartjs-plugin-datalabels";
import annotationPlugin from "chartjs-plugin-annotation";
import { ChartControls } from "./visualizerChartControls";

Chart.register(zoomPlugin, ChartDataLabels, annotationPlugin);

export function VisualizerLineChart(props) {
  const chartRef = useRef(null);

  console.log(`<VisualiserLineChart />...`);

  // if (!props.visualizerData) return;
  // if (!props.visualizerConfig) return;

  let parsedData = props.parsedData;
  let visualizerData = props.visualizerData;
  let setVisualizerData = props.setVisualizerData;
  let visualizerConfig = props.visualizerConfig;
  let setVisualizerConfig = props.setVisualizerConfig;

  // console.log(visualizerData);
  // console.log(visualizerConfig);

  // On chart load hide certain lifts that were hidden last sesssion (remembered via localStorage)
  useEffect(() => {
    console.log(`<SJLineChart /> useEffect [visualizerData]`);
    if (!visualizerData) return;

    const chart = chartRef.current;
    let selectedLifts = JSON.parse(localStorage.getItem("selectedLifts"));

    if (selectedLifts) {
      // Loop through visualizerData and only show the same lifts as previous session
      visualizerData.forEach((lift) => {
        if (!selectedLifts.includes(lift.label)) {
          lift.hidden = true; // Hide the lift on the legend (strikethrough appears)

          // Hide the corresponding annotations.
          // This might work better if we referenced the chart.datasets internals directly,
          // however it seems to change the existing chart even without running chart.update().
          let singleRM =
            visualizerConfig.achievementAnnotations[`${lift.label}_best_1RM`];
          let tripleRM =
            visualizerConfig.achievementAnnotations[`${lift.label}_best_3RM`];
          let fiveRM =
            visualizerConfig.achievementAnnotations[`${lift.label}_best_5RM`];
          if (singleRM) singleRM.display = false;
          if (tripleRM) tripleRM.display = false;
          if (fiveRM) fiveRM.display = false;
        }
      });
    } else {
      // We have no localstorage for selectedLifts so let's make one for next time with every lift
      let selectedLifts = visualizerData.map((item) => item.label);
      localStorage.setItem("selectedLifts", JSON.stringify(selectedLifts));
    }

    if (chart) {
      zoomShowRecent();
    }
  }, [props.visualizerData]); // Only run this effect once, on mount

  function zoomShowAllTime() {
    const chart = chartRef.current;
    if (chart)
      chart.zoomScale(
        "x",
        { min: visualizerConfig.padDateMin, max: visualizerConfig.padDateMax },
        "default"
      );
  }

  function zoomShowRecent() {
    const chart = chartRef.current;
    // if (chart) chart.resetZoom();
    let sixMonthsAgo =
      visualizerConfig.padDateMax - 1000 * 60 * 60 * 24 * 30 * 6;
    if (sixMonthsAgo < visualizerConfig.padDateMin)
      sixMonthsAgo = visualizerConfig.padDateMin;
    if (chart)
      chart.zoomScale("x", { min: sixMonthsAgo, max: visualizerConfig.padDateMax }, "default");
  }

  function chartUpdate() {
    const chart = chartRef.current;
    if (chart) chart.update();
  }

  // When someone clicks an item in the legend we will:
  // 1) Show/Hide the line (default behaviour)
  // 2) Show/Hide PR annotations for that line
  // 3) Remember the choice in localStorage for next time
  const newLegendClickHandler = function (e, legendItem, legend) {
    const index = legendItem.datasetIndex;
    const chart = legend.chart;

    let selectedLifts = JSON.parse(localStorage.getItem("selectedLifts"));
    if (!selectedLifts) selectedLifts = [];

    let liftType = legendItem.text;
    let singleRM =
      visualizerConfig.achievementAnnotations[`${liftType}_best_1RM`];
    let tripleRM =
      visualizerConfig.achievementAnnotations[`${liftType}_best_3RM`];
    let fiveRM =
      visualizerConfig.achievementAnnotations[`${liftType}_best_5RM`];

    if (chart.isDatasetVisible(index)) {
      console.log(`Hide ${legendItem.text}`);
      chart.hide(index);
      legendItem.hidden = true;
      if (singleRM) singleRM.display = false;
      if (tripleRM) tripleRM.display = false;
      if (fiveRM) fiveRM.display = false;
      selectedLifts = selectedLifts.filter((lift) => lift !== liftType); // Exclude unclicked lift
    } else {
      console.log(`Show ${legendItem.text}`);
      chart.show(index);
      legendItem.hidden = false;
      if (singleRM) singleRM.display = true;
      if (tripleRM) tripleRM.display = true;
      if (fiveRM) fiveRM.display = true;
      selectedLifts = [...selectedLifts, liftType]; // Include clicked lift
    }

    // Update the chart instance to reflect changes to data we made
    chart.update();

    // Update our localstorage with the array of which lifts are selected
    localStorage.setItem("selectedLifts", JSON.stringify(selectedLifts));
  };


  const animationOptions = {
    // duration:  2000,
    easing: "easeInExpo",
  };

  const scalesOptions = {
    x: {
      type: "time",
      time: {
        minUnit: "day",
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
  };

  const titleOptions = {
    display: false,
    text: `Title`, // Weird title for testing purposes
    font: { size: 20 },
  };

  const legendOptions = {
    display: true,
    position: "top",
    labels: {
      font: {
        font: "Catamaran",
        size: 18,
      },
    },
    onClick: newLegendClickHandler,
  };

  const datalabelsOptions = {
    formatter: (context) => {
      return context.y;
    },
    font: (context) => {
      // Mark heavy singles in bold data labels, and the e1rm estimate data labels as italic
      const liftSingle =
        context.dataset.data[context.dataIndex].label.indexOf("Potential");
      if (liftSingle === -1)
        return { family: "Catamaran", weight: "bold", size: 13 };
      else return { family: "Catamaran", style: "italic", size: 12 };
    },
    align: "end",
    anchor: "end",
  };

  const tooltipOptions = {
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
        if (url) return `Click to open ${url}`; // Tooltip reminder they can click to open video
      },
    },
  };

  // Work out some bounds of our data and six months figure
  const sixtyDaysInMilliseconds = 60 * 24 * 60 * 60 * 1000; // Used for zoom config limits
  const zoomOptions = {
    zoom: {
      wheel: { enabled: true },
      mode: "x",
    },
    pan: {
      enabled: true,
      mode: "x",
    },
    limits: {
      x: {
        min: visualizerConfig.padDateMin,
        max: visualizerConfig.padDateMax,
        minRange: sixtyDaysInMilliseconds,
      },
    },
  };

  const annotationOptions = {
    annotations: visualizerConfig.achievementAnnotations,
  };

  // Line Chart Options for react-chartjs-2 Visualizer
  let chartOptions = {
    responsive: true,
    // parsing: false,     // if you can match data to chartjs internal formats - this will improve speed
    font: { family: "Catamaran" },
    animation: animationOptions,
    onClick: (event, item) => {
      // Used to detect a click on a graph point and open URL in the data.
      if (item && item.length > 0) {
        const url = item[0].element.$context.raw.url;
        if (url) window.open(url);
      }
    },
    scales: scalesOptions,
    plugins: {
      title: titleOptions,
      legend: legendOptions,
      datalabels: datalabelsOptions,
      tooltip: tooltipOptions,
      zoom: zoomOptions,
      annotation: annotationOptions,
    },
  };

  return (
    <>
      {visualizerData && (
        <Line ref={chartRef} options={chartOptions} data={{ datasets: visualizerData }} />
      )}
      { (visualizerData && parsedData) && <ChartControls
            zoomShowAllTime={zoomShowAllTime}
            zoomShowRecent={zoomShowRecent}
            parsedData={parsedData}
            visualizerData={visualizerData}
            setVisualizerData={setVisualizerData}
            visualizerConfig={visualizerConfig}
            setVisualizerConfig={setVisualizerConfig}
            chartUpdate={chartUpdate}
          />
      }
    </>
  );
}