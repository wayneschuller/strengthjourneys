/**
 * Swipe sideways on a phone to turn to the next or previous session, like the
 * pages of a training diary: finger right to left goes forward in time, the
 * same way the header's chevrons read.
 *
 * The session follows the finger from the moment the drag is clearly
 * sideways. Let go past a quarter of the screen, or with a flick, and it
 * slides away and the next session slides in from the other side; anything
 * less springs back. With no session that way (the first one, or today) the
 * page stretches and gives, so the edge is felt rather than nothing
 * happening.
 *
 * A drag that starts in a field, a dialog, anything marked data-no-swipe, a
 * strip that scrolls sideways, or the screen edges (where iPhone keeps its
 * own back and forward swipe) is left alone. A mostly vertical drag is a
 * scroll and is never taken over.
 *
 * Every date change slides in from the side it came from, chevron or swipe,
 * as long as `slideDirection` says which way it went.
 */

import { useCallback, useEffect, useRef } from "react";
import { animate, useMotionValue, useTransform } from "motion/react";
import { useIsomorphicLayoutEffect } from "usehooks-ts";

import { buzz, HAPTIC } from "@/lib/haptics";

// Movement before the drag picks a direction, and how much more sideways
// than vertical it must be to count as a page turn.
const LOCK_DISTANCE_PX = 10;
const LOCK_RATIO = 1.2;
// Let go past this share of the screen, or faster than this, and it turns.
const COMMIT_SHARE = 0.25;
const FLICK_PX_PER_MS = 0.45;
const FLICK_MIN_PX = 40;
// Where an incoming session starts, and how far one with nowhere to go gives.
const ENTER_OFFSET_PX = 140;
const EDGE_RESISTANCE = 0.2;
const EDGE_GUTTER_PX = 24;
const OUT_TRANSITION = { duration: 0.16, ease: "easeIn" };
const SPRING = { type: "spring", stiffness: 520, damping: 42, mass: 0.8 };
const IGNORED_TARGETS =
  "input, textarea, select, [contenteditable], [role='slider'], [role='dialog'], [data-no-swipe]";

const screenWidth = () =>
  typeof window === "undefined" ? 400 : window.innerWidth || 400;

/**
 * @param {object} options
 * @param {(() => void)|null} options.onPrevious Older session, or null at the start.
 * @param {(() => void)|null} options.onNext Newer session, or null at today.
 * @param {string} options.sessionDate The session on screen.
 * @param {number} options.slideDirection 1 forward, -1 back, 0 for a date
 *   that changed by itself (which then just appears).
 * @param {boolean} options.reducedMotion Turn pages without moving them.
 * @returns {{ handlers: object, style: object }} Touch handlers for the
 *   element that takes the swipe, and the style for the one that moves.
 */
export function useSessionSwipe({
  onPrevious,
  onNext,
  sessionDate,
  slideDirection,
  reducedMotion,
}) {
  const x = useMotionValue(0);
  const opacity = useTransform(
    x,
    (value) => 1 - Math.min(Math.abs(value) / screenWidth(), 1) * 0.6,
  );
  const gestureRef = useRef(null);
  const turningRef = useRef(false);
  const handlersRef = useRef({ onPrevious, onNext });
  useEffect(() => {
    handlersRef.current = { onPrevious, onNext };
  }, [onPrevious, onNext]);

  // The new session is in the DOM but not yet painted: start it off to the
  // side it came from and bring it home.
  const lastDateRef = useRef(sessionDate);
  useIsomorphicLayoutEffect(() => {
    if (lastDateRef.current === sessionDate) return;
    lastDateRef.current = sessionDate;
    turningRef.current = false;
    if (reducedMotion || !slideDirection) {
      x.jump(0);
      return;
    }
    x.jump(slideDirection * ENTER_OFFSET_PX);
    animate(x, 0, SPRING);
  }, [sessionDate, slideDirection, reducedMotion, x]);

  const springBack = useCallback(() => {
    animate(x, 0, SPRING);
  }, [x]);

  const onTouchStart = useCallback(
    (event) => {
      gestureRef.current = null;
      if (turningRef.current || event.touches.length !== 1) return;
      const touch = event.touches[0];
      if (
        touch.clientX < EDGE_GUTTER_PX ||
        touch.clientX > screenWidth() - EDGE_GUTTER_PX
      ) {
        return;
      }
      const target = event.target;
      if (target.closest?.(IGNORED_TARGETS)) return;
      if (startsInSideScroller(target, event.currentTarget)) return;
      x.stop();
      gestureRef.current = {
        x: touch.clientX,
        y: touch.clientY,
        at: event.timeStamp,
        from: x.get(),
        locked: null,
      };
    },
    [x],
  );

  const onTouchMove = useCallback(
    (event) => {
      const gesture = gestureRef.current;
      if (!gesture) return;
      if (event.touches.length !== 1) {
        gestureRef.current = null;
        springBack();
        return;
      }
      const touch = event.touches[0];
      const dx = touch.clientX - gesture.x;
      const dy = touch.clientY - gesture.y;
      if (!gesture.locked) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) < LOCK_DISTANCE_PX) return;
        if (Math.abs(dx) < Math.abs(dy) * LOCK_RATIO) {
          // A scroll. Leave it to the browser for the rest of this touch.
          gestureRef.current = null;
          return;
        }
        gesture.locked = true;
      }
      if (reducedMotion) return;
      const { onPrevious: previous, onNext: next } = handlersRef.current;
      const hasTurn = dx < 0 ? Boolean(next) : Boolean(previous);
      x.set(gesture.from + (hasTurn ? dx : dx * EDGE_RESISTANCE));
    },
    [reducedMotion, springBack, x],
  );

  const onTouchEnd = useCallback(
    (event) => {
      const gesture = gestureRef.current;
      gestureRef.current = null;
      if (!gesture?.locked) return;
      const touch = event.changedTouches[0];
      const dx = touch ? touch.clientX - gesture.x : 0;
      const elapsed = Math.max(1, event.timeStamp - gesture.at);
      const turn =
        dx < 0 ? handlersRef.current.onNext : handlersRef.current.onPrevious;
      const farEnough = Math.abs(dx) > screenWidth() * COMMIT_SHARE;
      const flicked =
        Math.abs(dx) > FLICK_MIN_PX && Math.abs(dx) / elapsed > FLICK_PX_PER_MS;
      // Dragging out a text selection is not a page turn.
      const selecting = Boolean(window.getSelection?.()?.toString());
      if (!turn || selecting || !(farEnough || flicked)) {
        springBack();
        return;
      }

      buzz(HAPTIC.page);
      turningRef.current = true;
      if (reducedMotion) {
        turn();
        return;
      }
      animate(x, Math.sign(dx) * screenWidth(), OUT_TRANSITION).then(() => {
        turn();
        // The date effect brings the new session in. Should the turn not
        // change the date after all, bring this one back rather than leave
        // the page empty.
        setTimeout(() => {
          if (!turningRef.current) return;
          turningRef.current = false;
          springBack();
        }, 150);
      });
    },
    [reducedMotion, springBack, x],
  );

  const onTouchCancel = useCallback(() => {
    if (!gestureRef.current) return;
    gestureRef.current = null;
    springBack();
  }, [springBack]);

  return {
    handlers: { onTouchStart, onTouchMove, onTouchEnd, onTouchCancel },
    style: { x, opacity },
  };
}

function startsInSideScroller(target, boundary) {
  for (let el = target; el && el !== boundary; el = el.parentElement) {
    if (el.scrollWidth <= el.clientWidth + 1) continue;
    const { overflowX } = window.getComputedStyle(el);
    if (overflowX === "auto" || overflowX === "scroll") return true;
  }
  return false;
}
