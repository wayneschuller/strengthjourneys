/**
 * Swipe sideways on a phone to turn to the next or previous session, like the
 * pages of a training diary: finger right to left goes forward in time, the
 * same way the header's chevrons read.
 *
 * Only a quick, clearly sideways flick counts, so scrolling the log never
 * turns a page. A swipe that starts in a field, a dialog, anything marked
 * data-no-swipe, a strip that scrolls sideways, or the screen edges (where
 * iPhone keeps its own back and forward swipe) is left alone.
 */

import { useCallback, useEffect, useRef } from "react";

import { buzz, HAPTIC } from "@/lib/haptics";

const MIN_DISTANCE_PX = 70;
const MAX_DURATION_MS = 600;
const EDGE_GUTTER_PX = 24;
const IGNORED_TARGETS =
  "input, textarea, select, [contenteditable], [role='slider'], [role='dialog'], [data-no-swipe]";

/**
 * @param {object} options
 * @param {(() => void)|null} options.onPrevious Older session, or null at the start.
 * @param {(() => void)|null} options.onNext Newer session, or null at today.
 * @returns Touch handlers to spread on the element that takes the swipe.
 */
export function useSessionSwipe({ onPrevious, onNext }) {
  const startRef = useRef(null);
  const handlersRef = useRef({ onPrevious, onNext });
  useEffect(() => {
    handlersRef.current = { onPrevious, onNext };
  }, [onPrevious, onNext]);

  const onTouchStart = useCallback((event) => {
    startRef.current = null;
    if (event.touches.length !== 1) return;
    const touch = event.touches[0];
    if (
      touch.clientX < EDGE_GUTTER_PX ||
      touch.clientX > window.innerWidth - EDGE_GUTTER_PX
    ) {
      return;
    }
    const target = event.target;
    if (target.closest?.(IGNORED_TARGETS)) return;
    if (startsInSideScroller(target, event.currentTarget)) return;
    startRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      at: event.timeStamp,
    };
  }, []);

  const onTouchEnd = useCallback((event) => {
    const start = startRef.current;
    startRef.current = null;
    if (!start) return;
    const touch = event.changedTouches[0];
    if (!touch) return;
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    if (event.timeStamp - start.at > MAX_DURATION_MS) return;
    if (Math.abs(dx) < MIN_DISTANCE_PX || Math.abs(dx) < 2 * Math.abs(dy)) {
      return;
    }
    // Dragging out a text selection is not a page turn.
    if (window.getSelection?.()?.toString()) return;
    const turn =
      dx < 0 ? handlersRef.current.onNext : handlersRef.current.onPrevious;
    if (!turn) return;
    buzz(HAPTIC.page);
    turn();
  }, []);

  const onTouchCancel = useCallback(() => {
    startRef.current = null;
  }, []);

  return { onTouchStart, onTouchEnd, onTouchCancel };
}

function startsInSideScroller(target, boundary) {
  for (let el = target; el && el !== boundary; el = el.parentElement) {
    if (el.scrollWidth <= el.clientWidth + 1) continue;
    const { overflowX } = window.getComputedStyle(el);
    if (overflowX === "auto" || overflowX === "scroll") return true;
  }
  return false;
}
