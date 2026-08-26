/**
 * Reports whether the visitor is driving the page with a finger rather than a mouse.
 *
 * Radix tooltips deliberately ignore touch, so any UI that hides detail behind hover
 * needs a second path on phones and tablets. Starts false so the server render and
 * the first client render agree, then corrects on mount.
 */
import { useEffect, useState } from "react";

export function useHasCoarsePointer() {
  const [hasCoarsePointer, setHasCoarsePointer] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(hover: none), (pointer: coarse)");
    const update = () => setHasCoarsePointer(query.matches);

    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  return hasCoarsePointer;
}
