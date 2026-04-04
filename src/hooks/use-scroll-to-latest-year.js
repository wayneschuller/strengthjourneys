/**
 * Keeps long year-stacked heatmap containers focused on the newest year.
 * Only scrolls overflowed containers after the yearly rows have rendered.
 */

import { useEffect } from "react";

export function useScrollToLatestYear(containerRef, dependencyKey, isEnabled) {
  useEffect(() => {
    if (!isEnabled) return;
    const container = containerRef?.current;
    if (!container) return;

    let frameId = requestAnimationFrame(() => {
      const maxScrollTop = container.scrollHeight - container.clientHeight;
      if (maxScrollTop > 0) {
        container.scrollTop = maxScrollTop;
      }
    });

    return () => cancelAnimationFrame(frameId);
  }, [containerRef, dependencyKey, isEnabled]);
}
