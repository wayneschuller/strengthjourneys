
import { useState, useEffect} from 'react';
import { useCookies } from 'react-cookie';

import Chart from 'chart.js/auto';    // FIXME: do I still need this now that I use Chart.register below?
import { Line } from 'react-chartjs-2';
import 'chartjs-adapter-date-fns';
import zoomPlugin from 'chartjs-plugin-zoom';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import annotationPlugin from 'chartjs-plugin-annotation';

Chart.register(zoomPlugin, ChartDataLabels, annotationPlugin);

export function SJLineChart (props) {
  console.log(`<SJLine />...`);
  console.log(props);

  // Create the vanilla chart.js chart
  // let canvas = document.getElementById("myChartCanvas");
  // myChart = new Chart(canvas, getChartConfig());

  if (!props.data) return;
  if (!props.options) return;

  // let ref = props.chartRef;
  let _visualizerData = props.data;
  let _chartOptions = props.options; 

  return (
    <Line options={_chartOptions} data={_visualizerData} />
  );

}