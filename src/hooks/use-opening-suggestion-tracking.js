/**
 * Reports the AI coach's opening suggestions to /api/chat/openers, so the
 * chips that start chats can be shown more (lib/ai/opening-suggestions.js).
 *
 * A blank-page view's chips are counted as shown once, at whichever comes
 * first: the chat starting, or the tab being hidden or closed. That way an
 * athlete who looks and leaves still counts. What started the chat (a chip,
 * or their own words) is counted when it happens. Reports go by sendBeacon,
 * which never holds up the page, even as it unloads.
 *
 * A chat started any other way, such as a review link from the dashboard,
 * is not counted: its blank page was never really seen.
 */
import { useCallback, useEffect, useRef } from "react";

import { CELEBRATION_KEY } from "@/lib/ai/opening-suggestions";

const ENDPOINT = "/api/chat/openers";

/**
 * @param {Object} args
 * @param {boolean} args.isActive The blank page is showing its chips.
 * @param {string} args.audience
 * @param {{ text: string, key: string }[]|null} args.suggestions
 * @param {{ prompt: string }|null} [args.celebration] The PR chip, if shown.
 * @returns {(text: string) => void} Call as a chat starts from the blank page,
 *   with the text sent.
 */
export function useOpeningSuggestionTracking({
  isActive,
  audience,
  suggestions,
  celebration,
}) {
  const viewRef = useRef(null);

  // A fresh view each time the blank page comes back (first load, New chat).
  useEffect(() => {
    if (!isActive) {
      viewRef.current = null;
      return;
    }
    viewRef.current ??= { counted: false };
  }, [isActive]);

  // What the chips are now. Until the view is counted, the latest set is the
  // one that counts, so a reshuffle while the log loads is not counted twice.
  useEffect(() => {
    const view = viewRef.current;
    if (!isActive || !view || view.counted || !suggestions) return;
    view.audience = audience;
    view.chips = [
      ...(celebration
        ? [{ text: celebration.prompt, key: CELEBRATION_KEY }]
        : []),
      ...suggestions,
    ];
  }, [isActive, audience, suggestions, celebration]);

  useEffect(() => {
    if (!isActive) return;
    const handleHide = (event) => {
      if (
        event.type === "visibilitychange" &&
        document.visibilityState !== "hidden"
      ) {
        return;
      }
      const view = viewRef.current;
      if (!view?.chips || view.counted) return;
      view.counted = true;
      report({ audience: view.audience, shown: keysOf(view.chips) });
    };
    document.addEventListener("visibilitychange", handleHide);
    window.addEventListener("pagehide", handleHide);
    return () => {
      document.removeEventListener("visibilitychange", handleHide);
      window.removeEventListener("pagehide", handleHide);
    };
  }, [isActive]);

  return useCallback((text) => {
    const view = viewRef.current;
    if (!view?.chips) return;
    const chip = view.chips.find((item) => item.text === text.trim());
    report({
      audience: view.audience,
      ...(view.counted ? {} : { shown: keysOf(view.chips) }),
      ...(chip ? { picked: chip.key } : { typed: true }),
    });
    view.counted = true;
    view.chips = null;
  }, []);
}

function keysOf(chips) {
  return chips.map((chip) => chip.key);
}

// Best effort: a lost count is not worth anything the athlete would notice.
function report(body) {
  try {
    const payload = JSON.stringify(body);
    if (navigator.sendBeacon?.(ENDPOINT, payload)) return;
    fetch(ENDPOINT, { method: "POST", body: payload, keepalive: true }).catch(
      () => {},
    );
  } catch {
    // Nothing to do.
  }
}
