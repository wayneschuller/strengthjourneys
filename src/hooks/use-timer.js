/**
 * Shared gym timer context.
 *
 * The clock only ever runs forwards. A lifter should be reading their own
 * readiness rather than obeying a countdown, so instead of enforcing a rest
 * period we offer a repeating ping: a sound and a visual alert every few
 * minutes, while the clock keeps counting. Repeating rather than one-shot means
 * a missed ping is never the end of it, another one is always on the way.
 *
 * Two design constraints drive the rest of this file:
 *
 * 1. The clock is derived from wall-clock timestamps, never from counting
 *    interval ticks. Mobile browsers throttle background timers to roughly one
 *    tick per minute, so a counter that adds one second per tick silently loses
 *    minutes the moment a lifter pockets their phone. We store when the current
 *    running leg began and subtract, so the interval only decides how smoothly
 *    the display refreshes, not how much time has passed.
 *
 * 2. A gym timer is useless if the screen sleeps mid-set, so we hold a Screen
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

// How long a ping stays visually lit after it comes due. Long enough to catch
// from across a gym floor, short enough that the clock returns to normal before
// the next set.
const PING_ALERT_SECONDS = 8;

export const TimerProvider = ({ children }) => {
  const [elapsedMs, setElapsedMs] = useState(0);
  const [isRunning, setIsRunning] = useState(false);

  // Wall-clock bookkeeping. startedAt is the epoch ms of the leg currently
  // running (null while paused); bankedMs holds everything from earlier legs.
  const startedAtRef = useRef(null);
  const bankedMsRef = useRef(0);

  const entriesForTodayRef = useRef(0);
  const hasSeenTodaysEntriesRef = useRef(false);
  // How many pings have already sounded on this run, so each one lands once.
  const soundedPingsRef = useRef(0);
  const { parsedData } = useUserLiftingData();

  const [pingIntervalSeconds, setPingIntervalSeconds] = useLocalStorage(
    LOCAL_STORAGE_KEYS.TIMER_PING_INTERVAL,
    0,
    { initializeWithValue: false },
  );

  // Seeds the rotating nudge phrases. Lazily initialised once per session so the
  // wording varies between workouts while staying stable across every render of
  // this one.
  const [nudgeSeed] = useState(() => Date.now());

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

  /**
   * Sends the clock back to zero. Whether it keeps counting is read from the
   * timestamp ref rather than from `isRunning`, because an effect that closes
   * over a stale `isRunning` would otherwise clear the running leg and leave the
   * clock frozen at 00:00.
   *
   * @param {boolean} [run] - Force running or stopped. Omit to keep as-is.
   */
  const resetClock = useCallback((run) => {
    const shouldRun = run === undefined ? startedAtRef.current !== null : run;

    bankedMsRef.current = 0;
    startedAtRef.current = shouldRun ? Date.now() : null;
    soundedPingsRef.current = 0;
    setElapsedMs(0);
  }, []);

  // Refresh the display while running. Throttling this interval costs us
  // smoothness only, because every tick re-reads the wall clock.
  useEffect(() => {
    if (!isRunning) return;

    // A running clock always has a start timestamp. Enforcing the invariant here
    // rather than trusting every caller means a lifter can never end up staring
    // at a timer that says it is running while frozen on 00:00.
    if (startedAtRef.current === null) startedAtRef.current = Date.now();

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

  // Keep the screen alive while the clock runs. Re-request on every return to
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

    // The first load only establishes the baseline. Without that guard, simply
    // arriving with sets already logged today reads as a brand new set and
    // sends the clock back to zero a moment after the page appears.
    if (
      hasSeenTodaysEntriesRef.current &&
      newEntriesForToday > entriesForTodayRef.current
    ) {
      resetClock();
    }

    hasSeenTodaysEntriesRef.current = true;
    entriesForTodayRef.current = newEntriesForToday;
  }, [parsedData, resetClock]);

  const elapsedSeconds = Math.floor(elapsedMs / 1000);

  // How many pings the clock has passed, and when the most recent one landed.
  const pingCount =
    pingIntervalSeconds > 0
      ? Math.floor(elapsedSeconds / pingIntervalSeconds)
      : 0;
  const lastPingSeconds = pingCount * pingIntervalSeconds;

  // The lit ping is derived from the clock rather than stored in state, so it
  // clears itself as the seconds move on. No timeouts to cancel, and a paused
  // clock holds its alert until the lifter starts moving again.
  const activePingSeconds =
    pingCount > 0 && elapsedSeconds - lastPingSeconds < PING_ALERT_SECONDS
      ? lastPingSeconds
      : null;

  // Sound each ping once as it comes due.
  useEffect(() => {
    if (!isRunning) return;
    if (pingCount <= soundedPingsRef.current) return;

    soundedPingsRef.current = pingCount;

    if (!isMuted) playAlarmPing();
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate([120, 60, 120, 60, 200]);
    }

    gaEvent(GA_EVENT_TAGS.TIMER_ALARM_FIRED, {
      ping_interval_seconds: pingIntervalSeconds,
      ping_number: pingCount,
    });
  }, [pingCount, pingIntervalSeconds, isMuted, isRunning]);

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
    resetClock(false);
    setIsRunning(false);

    gaEvent(GA_EVENT_TAGS.TIMER_RESET);
  }, [resetClock]);

  const handleRestart = useCallback(() => {
    primeAudio();
    resetClock(true);
    setIsRunning(true);

    gaEvent(GA_EVENT_TAGS.TIMER_RESTARTED);
  }, [resetClock]);

  // Used when a page wants the timer live on arrival without stomping on a
  // count that is already under way.
  const ensureRunning = useCallback(() => {
    // Keep an in-progress leg rather than restarting it, but always assert the
    // running state: React bails out of the re-render when it is already true,
    // and an early return here would strand a clock whose timestamp survived
    // while the running state did not.
    if (startedAtRef.current === null) startedAtRef.current = Date.now();

    setIsRunning(true);
  }, []);

  const setPingInterval = useCallback(
    (seconds) => {
      primeAudio();

      // Count the pings the clock has already run past as sounded, so choosing
      // an interval mid-set never fires a burst of catch-up pings.
      soundedPingsRef.current =
        seconds > 0 ? Math.floor(readElapsedMs() / 1000 / seconds) : 0;

      setPingIntervalSeconds(seconds);

      gaEvent(GA_EVENT_TAGS.TIMER_PING_INTERVAL_SET, {
        ping_interval_seconds: seconds,
      });
    },
    [readElapsedMs, setPingIntervalSeconds],
  );

  const value = useMemo(
    () => ({
      time: elapsedSeconds,
      isRunning,
      pingIntervalSeconds,
      pingCount,
      activePingSeconds,
      nudgeSeed,
      isMuted,
      setIsMuted,
      setPingInterval,
      ensureRunning,
      handleStartStop,
      handleReset,
      handleRestart,
    }),
    [
      elapsedSeconds,
      isRunning,
      pingIntervalSeconds,
      pingCount,
      activePingSeconds,
      nudgeSeed,
      isMuted,
      setIsMuted,
      setPingInterval,
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

/**
 * Short label for an alarm point, e.g. 90 becomes "1:30".
 *
 * @param {number} seconds
 * @returns {string}
 */
export const formatAlarmLabel = (seconds) =>
  formatTime(seconds).replace(/^0(?=\d:)/, "");

// A synthesised ping beats shipping an audio file: nothing to download, works
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
      devLog(`Audio unavailable for timer ping: ${error?.message}`);
      return null;
    }
  }

  return sharedAudioContext;
};

/**
 * iOS keeps an AudioContext suspended until a user gesture touches it, so every
 * timer control runs this on the way through. By the time an alarm point arrives
 * the context is already awake and the ping can play.
 */
const primeAudio = () => {
  const context = getAudioContext();
  if (context?.state === "suspended") context.resume().catch(() => {});
};

const playAlarmPing = () => {
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
    devLog(`Timer ping failed: ${error?.message}`);
  }
};
