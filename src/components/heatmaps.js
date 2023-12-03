import React from "react";
import { useTheme } from "next-themes";
import CalendarHeatmap from "react-calendar-heatmap";
// import "react-calendar-heatmap/dist/styles.css";
// import "../styles/heatmap.css";
// import styles from "../styles/heatmap.css";

function generateRandomHeatmapData() {
  const currentDate = new Date();
  const windowMonths = 24;
  const startDate = new Date(currentDate);
  startDate.setMonth(currentDate.getMonth() - windowMonths); // Two years ago

  const endDate = new Date();

  const randomHeatmapData = [];

  for (
    let date = new Date(startDate);
    date <= endDate;
    date.setDate(date.getDate() + 1)
  ) {
    randomHeatmapData.push({
      date: new Date(date),
      count: Math.floor(Math.random() * 5),
    });
  }

  return {
    startDate,
    endDate,
    heatmapData: randomHeatmapData,
  };
}

const Heatmap = ({ parsedData, bestSets, months }) => {
  const { theme } = useTheme();
  if (!parsedData) return;

  // Generate random data
  // const heatmap = generateRandomHeatmapData();

  const heatmap = generateHeatmapData(parsedData, bestSets, months);

  console.log(`Heatmap (theme: ${theme}):`);
  console.log(heatmap);

  return (
    <div className="">
      <CalendarHeatmap
        startDate={heatmap.startDate}
        endDate={heatmap.endDate}
        values={heatmap.heatmapData}
        classForValue={(value) => {
          if (!value) {
            return `color-gh-${theme}-0`; // Grabs colors from css
          }
          return `color-gh-${theme}-${value.count}`; // Grabs colors from css
        }}
        titleForValue={(value) => {
          if (!value) return null;

          return `${value?.date}: ${value?.count}`;
        }}
      />
    </div>
  );
};

export default Heatmap;

// liftData.js

// liftData.js
// liftData.js

export const generateHeatmapData = (parsedData, bestSets, months) => {
  const currentDate = new Date();
  const windowMonths = months;

  const windowPeriod = new Date();
  windowPeriod.setMonth(currentDate.getMonth() - windowMonths);

  const filteredData = parsedData.filter(
    (lift) => new Date(lift.date) >= windowPeriod,
  );

  // Create a Set to track unique dates
  const uniqueDates = new Set();

  // Filter and create heatmapData with unique dates and a constant count of 1
  const heatmapData = filteredData
    .filter((lift) => {
      const dateStr = lift.date.toString();
      if (!uniqueDates.has(dateStr)) {
        uniqueDates.add(dateStr);
        return true;
      }
      return false;
    })
    .map((lift) => ({ date: lift.date, count: 1 }));

  // Ensure there's an entry for the date 12 months ago with count: 0
  if (new Date(heatmapData[0].date) > windowPeriod) {
    heatmapData.unshift({
      date: windowPeriod,
      count: 0,
    });
  }

  // Sort the heatmapData by date
  heatmapData.sort((a, b) => new Date(a.date) - new Date(b.date));

  // Set startDate to at least 12 months ago
  const startDate = heatmapData.length > 0 ? heatmapData[0].date : windowPeriod;
  const endDate = currentDate;

  return {
    startDate,
    endDate,
    heatmapData,
  };
};
