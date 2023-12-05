"use client";

import { useState, useEffect, useContext } from "react";
import { useTheme } from "next-themes";
import CalendarHeatmap from "react-calendar-heatmap";
import { devLog } from "@/lib/devLog";

// We don't need this because we put our own styles in our globals.css
// import "react-calendar-heatmap/dist/styles.css";

function generateRandomHeatmapData() {
  const currentDate = new Date();
  const windowMonths = 24; // Two years ago
  const startDate = new Date(currentDate);
  startDate.setMonth(currentDate.getMonth() - windowMonths);

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

const Heatmap = ({ parsedData, months }) => {
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme } = useTheme();

  // useEffect only runs on the client, so now we can safely show the UI
  // As advised by: https://github.com/pacocoursey/next-themes#avoid-hydration-mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  // FIXME: if we are checking for mounted we could do clever stuff to get window width and adjust the heatmap data size accordingly?
  // We could set months based on window size here

  if (!parsedData) return;

  // Generate random data
  // const heatmap = generateRandomHeatmapData();

  const heatmap = generateHeatmapData(parsedData, months);

  // devLog(`Heatmap (theme: ${theme}):`);
  // devLog(heatmap);

  return (
    <CalendarHeatmap
      startDate={heatmap.startDate}
      endDate={heatmap.endDate}
      values={heatmap.heatmapData}
      classForValue={(value) => {
        if (!value) {
          return `color-gh-${theme || "light"}-0`; // Grabs colors from css
        }
        return `color-gh-${theme || "light"}-${value.count}`; // Grabs colors from css
      }}
      titleForValue={(value) => {
        if (!value) return null;

        return `${value?.date}: ${value?.count}`;
      }}
    />
  );
};

export default Heatmap;

// liftData.js

// liftData.js
// liftData.js

export const generateHeatmapData = (parsedData, months) => {
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
