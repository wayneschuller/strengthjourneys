import React, { createContext, useContext, useState, useEffect } from "react";
import { useUserLiftingData } from "./use-userlift-data";
import { devLog } from "@/lib/processing-utils";

const TimerContext = createContext();

export const useTimer = () => useContext(TimerContext);

export const TimerProvider = ({ children }) => {
  const [time, setTime] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [entriesForToday, setEntriesForToday] = useState(0);
  const { parsedData } = useUserLiftingData();

  useEffect(() => {
    if (parsedData === null) return; // Still pending data

    const todayString = new Date().toISOString().slice(0, 10); // Get today's date in 'YYYY-MM-DD' format
    const newEntriesForToday = parsedData.filter(
      (item) => item.date === todayString,
    ).length;

    if (newEntriesForToday > entriesForToday) {
      // devLog(`A new object was added today (${todayString}).`);
      // setIsRunning(true);
      setTime(0);
    }

    // Update the state variable to track the number of entries for today's date
    setEntriesForToday(newEntriesForToday);
  }, [parsedData]);

  useEffect(() => {
    let interval;

    if (isRunning) {
      interval = setInterval(() => {
        setTime((prevTime) => prevTime + 1); // Add 1 second
      }, 1000);
    }

    return () => clearInterval(interval);
  }, [isRunning, setTime]);

  const handleStartStop = () => {
    setIsRunning((prevIsRunning) => !prevIsRunning);
  };

  const handleReset = () => {
    setIsRunning(false);
    setTime(0);
  };

  const handleRestart = () => {
    setIsRunning(true);
    setTime(0);

    if (typeof window !== "undefined") {
      window.gtag("event", "timer_restarted");
    }
  };

  return (
    <TimerContext.Provider
      value={{
        time,
        setTime,
        isRunning,
        setIsRunning,
        handleStartStop,
        handleReset,
        handleRestart,
        entriesForToday,
      }}
    >
      {children}
    </TimerContext.Provider>
  );
};
