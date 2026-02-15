import React, { createContext, useContext, useState, useEffect, useRef } from "react";
import { todayStr } from "@/lib/date-utils";
import { useUserLiftingData } from "./use-userlift-data";
import { devLog } from "@/lib/processing-utils";
import { gaEvent, GA_EVENT_TAGS } from "@/lib/analytics";

const TimerContext = createContext();

export const useTimer = () => useContext(TimerContext);

export const TimerProvider = ({ children }) => {
  const [time, setTime] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [entriesForToday, setEntriesForToday] = useState(0);
  const entriesForTodayRef = useRef(0);
  const { parsedData } = useUserLiftingData();

  useEffect(() => {
    if (parsedData === null) return; // Still pending data

    const todayString = todayStr();
    const newEntriesForToday = parsedData.filter(
      (item) => item.date === todayString,
    ).length;

    if (newEntriesForToday > entriesForTodayRef.current) {
      setTime(0);
    }

    entriesForTodayRef.current = newEntriesForToday;
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

    gaEvent(GA_EVENT_TAGS.TIMER_START_STOP_TOGGLE);
  };

  const handleReset = () => {
    setIsRunning(false);
    setTime(0);

    gaEvent(GA_EVENT_TAGS.TIMER_RESET);
  };

  const handleRestart = () => {
    setIsRunning(true);
    setTime(0);

    gaEvent(GA_EVENT_TAGS.TIMER_RESTARTED);
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
