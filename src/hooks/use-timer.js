/**
 * Shared gym timer context.
 *
 * Two design constraints drive everything in this file:
 *
 * 1. The clock is derived from wall-clock timestamps, never from counting
 *    interval ticks. Mobile browsers throttle background timers to roughly one
 *    tick per minute, so a counter that adds one second per tick silently loses
 *    minutes the moment a lifter pockets their phone. We store when the current
 *    running leg began and subtract, so the interval only decides how smoothly
 *    the display refreshes, not how much time has passed.
 *
 * 2. A rest timer is useless if the screen sleeps mid-set, so we hold a Screen
 *    Wake Lock while the timer runs. The lock is only ever held while the tab is
 *    visible (the browser enforces that), so it releases itself as soon as the
 *    lifter switches apps or locks the phone.
 *
 * The context is mounted app-wide in _app.js, which lets the nav bar MiniTimer
 * keep counting while the lifter moves around the site mid-workout.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { format } from "date-fns";
import { useLocalStorage } from "usehooks-ts";

import { useUserLiftingData } from "@/hooks/use-userlift-data";
import { gaEvent, GA_EVENT_TAGS } from "@/lib/analytics";
import { LOCAL_STORAGE_KEYS } from "@/lib/localStorage-keys";
import { devLog } from "@/lib/processing-utils";

const TimerContext = createContext();

export const useTimer = () => useContext(TimerContext);

// Fast enough that the seconds digit turns over promptly, slow enough to stay
// cheap. The display only reads a timestamp, so this is purely refresh rate.
const TICK_INTERVAL_MS = 250;

export const TimerProvider = ({ children }) => {
  const [elapsedMs, setElapsedMs] = useState(0);
  const [isRunning, setIsRunning] = useState(false);

  // Wall-clock bookkeeping. startedAt is the epoch ms of the leg currently
  // running (null while paused); bankedMs holds everything from earlier legs.
  const startedAtRef = useRef(null);
  const bankedMsRef = useRef(0);

  const entriesForTodayRef = useRef(0);
  const restAlertFiredRef = useRef(false);
  const { parsedData } = useUserLiftingData();

  const [restTargetSeconds, setRestTargetSeconds] = useLocalStorage(
    LOCAL_STORAGE_KEYS.TIMER_REST_TARGET,
    0,
    { initializeWithValue: false },
  );

  const [isMuted, setIsMuted] = useLocalStorage(
    LOCAL_STORAGE_KEYS.TIMER_MUTED,
    false,
    { initializeWithValue: false },
  );

  const readElapsedMs = useCallback(() => {
    const runningLegMs =
      startedAtRef.current === null ? 0 : Date.now() - startedAtRef.current;

    return bankedMsRef.current + runningLegMs;
  }, []);

  const zeroTheClock = useCallback((keepRunning) => {
    bankedMsRef.current = 0;
    startedAtRef.current = keepRunning ? Date.now() : null;
    restAlertFiredRef.current = false;
    setElapsedMs(0);
  }, []);

  // Refresh the display while running. Throttling this interval costs us
  // smoothness only, because every tick re-reads the wall clock.
  useEffect(() => {
    if (!isRunning) return;

    const tick = () => setElapsedMs(readElapsedMs());

    tick();
    const interval = setInterval(tick, TICK_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [isRunning, readElapsedMs]);

  // Coming back to a throttled tab, correct the display immediately rather than
  // waiting for the next tick to land.
  useEffect(() => {
    const resync = () => {
      if (document.visibilityState === "visible") setElapsedMs(readElapsedMs());
    };

    document.addEventListener("visibilitychange", resync);
    return () => document.removeEventListener("visibilitychange", resync);
  }, [readElapsedMs]);

  // Keep the screen alive while resting. Re-request on every return to
  // visibility because the browser drops the lock whenever the tab is hidden.
  useEffect(() => {
    if (!isRunning) return;
    if (typeof navigator === "undefined" || !navigator.wakeLock) return;

    let sentinel = null;
    let isCancelled = false;

    const acquire = async () => {
      if (document.visibilityState !== "visible") return;

      try {
        const nextSentinel = await navigator.wakeLock.request("screen");
        if (isCancelled) {
          nextSentinel.release().catch(() => {});
          return;
        }
        sentinel = nextSentinel;
      } catch (error) {
        devLog(`Screen wake lock unavailable: ${error?.message}`);
      }
    };

    const reacquire = () => {
      if (document.visibilityState === "visible") acquire();
    };

    acquire();
    document.addEventListener("visibilitychange", reacquire);

    return () => {
      isCancelled = true;
      document.removeEventListener("visibilitychange", reacquire);
      sentinel?.release().catch(() => {});
    };
  }, [isRunning]);

  // Logging a set is the clearest possible signal that rest just started. The
  // count lives in a ref rather than state because nothing renders it: it exists
  // only to spot the moment a new entry lands.
  useEffect(() => {
    if (parsedData === null) return; // Still pending data

    const todayString = format(new Date(), "yyyy-MM-dd"); // Local date, not UTC
    const newEntriesForToday = parsedData.filter(
      (item) => item.date === todayString,
    ).length;

    if (newEntriesForToday > entriesForTodayRef.current) {
      zeroTheClock(isRunning);
    }

    entriesForTodayRef.current = newEntriesForToday;
  }, [parsedData, isRunning, zeroTheClock]);

  const elapsedSeconds = Math.floor(elapsedMs / 1000);
  const hasRestTarget = restTargetSeconds > 0;
  const isOvertime = hasRestTarget && elapsedSeconds >= restTargetSeconds;
  const remainingSeconds = hasRestTarget
    ? restTargetSeconds - elapsedSeconds
    : null;

  // Announce the end of the rest period once per running leg.
  useEffect(() => {
    if (!hasRestTarget) return;
    if (!isOvertime) return;
    if (restAlertFiredRef.current) return;

    restAlertFiredRef.current = true;

    if (!isMuted) playRestChime();
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate([120, 60, 120, 60, 200]);
    }

    gaEvent(GA_EVENT_TAGS.TIMER_REST_COMPLETE, {
      rest_target_seconds: restTargetSeconds,
    });
  }, [hasRestTarget, isOvertime, isMuted, restTargetSeconds]);

  const handleStartStop = useCallback(() => {
    primeAudio();

    if (isRunning) {
      // Bank the leg that just ended so a later resume picks up where we left off.
      bankedMsRef.current = readElapsedMs();
      startedAtRef.current = null;
      setElapsedMs(bankedMsRef.current);
      setIsRunning(false);
    } else {
      startedAtRef.current = Date.now();
      setIsRunning(true);
    }

    gaEvent(GA_EVENT_TAGS.TIMER_START_STOP_TOGGLE);
  }, [isRunning, readElapsedMs]);

  const handleReset = useCallback(() => {
    zeroTheClock(false);
    setIsRunning(false);

    gaEvent(GA_EVENT_TAGS.TIMER_RESET);
  }, [zeroTheClock]);

  const handleRestart = useCallback(() => {
    primeAudio();
    zeroTheClock(true);
    setIsRunning(true);

    gaEvent(GA_EVENT_TAGS.TIMER_RESTARTED);
  }, [zeroTheClock]);

  // Used when a page wants the timer live on arrival without stomping on a
  // count that is already under way.
  const ensureRunning = useCallback(() => {
    if (startedAtRef.current !== null) return; // Already counting

    startedAtRef.current = Date.now();
    setIsRunning(true);
  }, []);

  const setRestTarget = useCallback(
    (seconds) => {
      primeAudio();

      // Picking a target you are already past should not set off the chime: it
      // belongs to the end of a rest period, not to the act of choosing one.
      restAlertFiredRef.current =
        seconds > 0 && readElapsedMs() >= seconds * 1000;

      setRestTargetSeconds(seconds);

      gaEvent(GA_EVENT_TAGS.TIMER_REST_TARGET_SET, {
        rest_target_seconds: seconds,
      });
    },
    [readElapsedMs, setRestTargetSeconds],
  );

  const value = useMemo(
    () => ({
      time: elapsedSeconds,
      isRunning,
      restTargetSeconds,
      hasRestTarget,
      remainingSeconds,
      isOvertime,
      isMuted,
      setIsMuted,
      setRestTarget,
      ensureRunning,
      handleStartStop,
      handleReset,
      handleRestart,
    }),
    [
      elapsedSeconds,
      isRunning,
      restTargetSeconds,
      hasRestTarget,
      remainingSeconds,
      isOvertime,
      isMuted,
      setIsMuted,
      setRestTarget,
      ensureRunning,
      handleStartStop,
      handleReset,
      handleRestart,
    ],
  );

  return (
    <TimerContext.Provider value={value}>{children}</TimerContext.Provider>
  );
};

/**
 * Formats a second count as MM:SS, growing to H:MM:SS for the long sessions.
 * Guards against NaN and negatives so a display never renders "NaN:NaN".
 *
 * @param {number} totalSeconds
 * @returns {string}
 */
export const formatTime = (totalSeconds) => {
  const safeSeconds = Number.isFinite(totalSeconds)
    ? Math.max(0, Math.floor(totalSeconds))
    : 0;

  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;

  const paddedSeconds = String(seconds).padStart(2, "0");

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${paddedSeconds}`;
  }

  return `${String(minutes).padStart(2, "0")}:${paddedSeconds}`;
};

// A synthesised chime beats shipping an audio file: nothing to download, works
// offline, and no bundle cost. Created lazily because Safari counts an unused
// AudioContext against the page.
let sharedAudioContext = null;

const getAudioContext = () => {
  if (typeof window === "undefined") return null;

  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return null;

  if (!sharedAudioContext) {
    try {
      sharedAudioContext = new AudioContextClass();
    } catch (error) {
      devLog(`Audio unavailable for timer chime: ${error?.message}`);
      return null;
    }
  }

  return sharedAudioContext;
};

/**
 * iOS keeps an AudioContext suspended until a user gesture touches it, so every
 * timer control runs this on the way through. By the time a rest period ends the
 * context is already awake and the chime can play.
 */
const primeAudio = () => {
  const context = getAudioContext();
  if (context?.state === "suspended") context.resume().catch(() => {});
};

const playRestChime = () => {
  const context = getAudioContext();
  if (!context) return;

  if (context.state === "suspended") context.resume().catch(() => {});

  try {
    const startTime = context.currentTime;

    // Three rising notes, short enough to cut through gym noise without
    // becoming the thing everyone in the room turns around to look at.
    [660, 880, 1170].forEach((frequency, index) => {
      const noteStart = startTime + index * 0.18;
      const oscillator = context.createOscillator();
      const gain = context.createGain();

      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(frequency, noteStart);

      gain.gain.setValueAtTime(0.0001, noteStart);
      gain.gain.exponentialRampToValueAtTime(0.28, noteStart + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, noteStart + 0.16);

      oscillator.connect(gain);
      gain.connect(context.destination);

      oscillator.start(noteStart);
      oscillator.stop(noteStart + 0.18);
    });
  } catch (error) {
    devLog(`Timer chime failed: ${error?.message}`);
  }
};
