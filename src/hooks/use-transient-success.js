import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Tracks a short-lived success state (for UI confirmations like "Copied").
 *
 * @param {number} durationMs
 */
export function useTransientSuccess(durationMs = 1600) {
  const [isSuccess, setIsSuccess] = useState(false);
  const timeoutRef = useRef(null);

  const clearSuccess = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setIsSuccess(false);
  }, []);

  const triggerSuccess = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    setIsSuccess(true);
    timeoutRef.current = setTimeout(() => {
      timeoutRef.current = null;
      setIsSuccess(false);
    }, durationMs);
  }, [durationMs]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return {
    isSuccess,
    triggerSuccess,
    clearSuccess,
  };
}
