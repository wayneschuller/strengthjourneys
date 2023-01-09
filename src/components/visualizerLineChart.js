
import { useEffect, useRef} from 'react';
import Chart from 'chart.js/auto';      // Pick everything. You can hand pick which chartjs features you want, see chartjs docs. 
import { Line } from 'react-chartjs-2';
import 'chartjs-adapter-date-fns';
import zoomPlugin from 'chartjs-plugin-zoom';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import annotationPlugin from 'chartjs-plugin-annotation';
import { ChartControls } from './visualizerChartControls';

Chart.register(zoomPlugin, ChartDataLabels, annotationPlugin);

export function VisualizerLineChart (props) {
  const chartRef = useRef(null);

  console.log(`<VisualiserLineChart />...`);
  // console.log(props);

  if (!props.visualizerData) return;
  if (!props.visualizerConfig) return;

  let visualizerData = props.visualizerData;
  let visualizerConfig = props.visualizerConfig;


  // On chart load hide certain lifts that were hidden last sesssion (remembered via cookie)
  useEffect(() => {
    console.log(`<SJLineChart /> useEffect [visualizerData]`);
    if (!visualizerData) return; 

    const chart = chartRef.current;
    let selectedLifts = JSON.parse(localStorage.getItem('selectedLifts'));

    if (selectedLifts) {
      
      // Loop through visualizerData and only show the same lifts as previous session
      visualizerData.datasets.forEach(lift => {
        if (!selectedLifts.includes(lift.label)) {
          lift.hidden = true;     // Hide the lift on the legend (strikethrough appears)

          // Hide the corresponding annotations
  // FIXME: This might work better if we referenced the chart.datasets internals directly?!?
          let singleRM = visualizerConfig.achievementAnnotations[`${lift.label}_best_1RM`];
          let tripleRM = visualizerConfig.achievementAnnotations[`${lift.label}_best_3RM`];
          let fiveRM = visualizerConfig.achievementAnnotations[`${lift.label}_best_5RM`];
          if (singleRM) singleRM.display = false;
          if (tripleRM) tripleRM.display = false;
          if (fiveRM) fiveRM.display = false;

        }
      });

    } else {
      // We have no localstorage for selectedLifts so let's make one for next time with every lift
      let selectedLifts = visualizerData.datasets.map(item => item.label);
      localStorage.setItem('selectedLifts', JSON.stringify(selectedLifts));
    }

    // FIXME: We could manually zoom in here so as to not hardcode in config?
    // if (chart) chart.zoomScale('x', { min: visualizerConfig.sixMonthsAgo, max: visualizerConfig.padDateMax }, "default");

  }, [visualizerData]); // Only run this effect once, on mount

  function zoomShowAllTime() {
    const chart = chartRef.current;
    if (chart) chart.zoomScale('x', { min: visualizerConfig.padDateMin, max: visualizerConfig.padDateMax }, "default");
  }

  function zoomShowRecent() {
    const chart = chartRef.current;
    // if (chart) chart.resetZoom(); 
    let _sixMonthsAgo = visualizerConfig.padDateMax - 1000 * 60 * 60 * 24 * 30 * 6;
    if (_sixMonthsAgo < visualizerConfig.padDateMin) sixMonthsAgo = visualizerConfig.padDateMin;
    const _padDateMax = visualizerConfig.padDateMax;
    if (chart) chart.zoomScale('x', { min: _sixMonthsAgo, max: _padDateMax }, "default");
  }

  // When someone clicks an item in the legend we will:
  // 1) Show/Hide the line (default behaviour)
  // 2) Show/Hide PR annotations for that line
  // 3) Remember the choice in a cookie for next time
  const newLegendClickHandler = function (e, legendItem, legend) {
    const index = legendItem.datasetIndex;
    const chart = legend.chart;

    let selectedLifts = JSON.parse(localStorage.getItem('selectedLifts'));
    if (!selectedLifts) selectedLifts = [];

    let liftType = legendItem.text;
    let singleRM = visualizerConfig.achievementAnnotations[`${liftType}_best_1RM`];
    let tripleRM = visualizerConfig.achievementAnnotations[`${liftType}_best_3RM`];
    let fiveRM = visualizerConfig.achievementAnnotations[`${liftType}_best_5RM`];

    if (chart.isDatasetVisible(index)) {
        console.log(`Hide ${legendItem.text}`);
        chart.hide(index);
        legendItem.hidden = true;
        if (singleRM) singleRM.display = false;
        if (tripleRM) tripleRM.display = false;
        if (fiveRM) fiveRM.display = false;
        selectedLifts = selectedLifts.filter((lift) => lift !== liftType);  // Exclude unclicked lift
    } else {
        console.log(`Show ${legendItem.text}`);
        chart.show(index);
        legendItem.hidden = false;
        if (singleRM) singleRM.display = true;
        if (tripleRM) tripleRM.display = true;
        if (fiveRM) fiveRM.display = true;
        selectedLifts = [...selectedLifts, liftType];  // Include clicked lift
    }

    // Update the chart instance to reflect changes to data we made
    chart.update();

    // Update our localstorage with the array of which lifts are selected
    localStorage.setItem('selectedLifts', JSON.stringify(selectedLifts));

  }


  // Work out some bounds of our data and six months figure
  const sixtyDaysInMilliseconds = 60 * 24 * 60 * 60 * 1000;   // Used for zoom config limits

  // let tenDaysInMilliseconds = 10 * 24 * 60 * 60 * 1000;
  // // let padDateMax = new Date(Date.now() + tenDaysInMilliseconds);
  // // padDateMax = padDateMax.getTime();
  // let padDateMin = new Date(visualizerData[0].data[0].x); // First tuple in first lift
  // padDateMin = padDateMin.setDate(padDateMin.getTime() - tenDaysInMilliseconds);

  // let padDateMax = new Date(visualizerData[0].data[visualizerData[0].data.length - 1].x); // Last tuple in first lift
  // padDateMax = padDateMax.setDate(padDateMax.getTime() + tenDaysInMilliseconds);

  // // Set the zoom/pan to the last 6 months of data if we have that much
  // let sixMonthsAgo = padDateMax - 1000 * 60 * 60 * 24 * 30 * 6;
  // if (sixMonthsAgo < padDateMin) sixMonthsAgo = padDateMin;

  // // Search through the processed data and find the largest y value 
  // let highestWeight = -1;
  // processedData.forEach((liftType) => {
  //   liftType.data.forEach((lift) => {
  //     if (lift.y > highestWeight) 
  //       highestWeight = lift.y;
  //   });
  // });
  // highestWeight = Math.ceil(highestWeight / 49) * 50; // Round up to the next mulitiple of 50

  console.log(`<Visualizer > vis.padDateMin: ${visualizerConfig.padDateMin}, vis.padDateMax: ${visualizerConfig.padDateMax}, vis.sixMonthsAgo: ${visualizerConfig.sixMonthsAgo}`);

  // Make private copies so that the chart doesn't redraw on state change (kindy hacky test)
  const _padDateMin = visualizerConfig.padDateMin
  const _padDateMax = visualizerConfig.padDateMax
  const _highestWeight = visualizerConfig.highestWeight;
  const _sixMonthsAgo = visualizerConfig.sixMonthsAgo;
  const _achievementAnnotations = visualizerConfig.achievementAnnotations;
  console.log(`<Visualizer > _padDateMin: ${_padDateMin}, _padDateMax: ${_padDateMax}, _sixMonthsAgo: ${_sixMonthsAgo}`);

  const animationOptions = {
    // duration:  2000,
    easing: "easeInExpo",
  }

  const scalesOptions = {
      x: {
          type: "time",
          // suggestedMin: visualizerConfig.sixMonthsAgo,
          // suggestedMax: visualizerConfig.padDateMax,
          min: _sixMonthsAgo,
          suggestedMax: _padDateMax,
          time: {
            minUnit: "day"
          },
      },
      y: {
        suggestedMin: 0,
        // suggestedMax: visualizerConfig.highestWeight, 
        suggestedMax: _highestWeight,

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
        position: 'top',
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
            if (url)
              return `Click to open ${url}`; // Tooltip reminder they can click to open video
          },
        }
  };

  const zoomOptions = {
        zoom: {
          wheel: {enabled: true,},
          mode: 'x',   
        },
        pan: {
          enabled: true,
          mode: 'x',
        },
        limits: {
          x: { min: _padDateMin, max: _padDateMax, minRange: sixtyDaysInMilliseconds },
        },
  };

  const annotationOptions = {
    annotations: visualizerConfig.achievementAnnotations,
    // annotations: _achievementAnnotations,
  };

  // Line Chart Options for react-chartjs-2 Visualizer 
  let chartOptions = {
    responsive: true,
    font: {family: "Catamaran"},
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
    { props.visualizerData && <Line ref={chartRef} options={chartOptions} data={visualizerData} /> }
    <ChartControls zoomShowAllTime={zoomShowAllTime}  zoomShowRecent={zoomShowRecent} setEquation={props.setEquation} /> 
    </>
  );

}