import { createContext, useCallback, useContext, useMemo, useState } from "react";

const MAX_ACTIVITY_ENTRIES = 200;

const DevActivityMonitorContext = createContext(null);

function getTimestamp() {
  const now = new Date();

  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")}.${String(now.getMilliseconds()).padStart(3, "0")}`;
}

export function DevActivityMonitorProvider({ children }) {
  const [entries, setEntries] = useState([]);

  const addEntry = useCallback((entry) => {
    const timestamp = Date.now();
    setEntries((previousEntries) => [
      ...previousEntries.slice(-(MAX_ACTIVITY_ENTRIES - 1)),
      {
        id: entry.id ?? `${timestamp}-${Math.random().toString(36).slice(2, 8)}`,
        recordedAt: timestamp,
        ...entry,
        time: entry.time ?? getTimestamp(),
      },
    ]);
  }, []);

  const clearEntries = useCallback(() => {
    setEntries([]);
  }, []);

  const value = useMemo(
    () => ({
      entries,
      addEntry,
      clearEntries,
    }),
    [entries, addEntry, clearEntries],
  );

  return (
    <DevActivityMonitorContext.Provider value={value}>
      {children}
    </DevActivityMonitorContext.Provider>
  );
}

export function useDevActivityMonitor() {
  const context = useContext(DevActivityMonitorContext);

  if (!context) {
    throw new Error(
      "useDevActivityMonitor must be used within a DevActivityMonitorProvider.",
    );
  }

  return context;
}
