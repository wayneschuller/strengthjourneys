/**
 * Development console timing logs for log-page sheet API operations.
 */

import { devLog } from "@/lib/processing-utils";

export function logSheetTimings(label, timings, totalMs) {
  const total = Math.round(totalMs);
  const color = total < 500 ? "#22c55e" : total < 1500 ? "#f59e0b" : "#ef4444";

  if (timings.length <= 1) {
    devLog(
      `%c📡 ${label}%c  %c${total}ms`,
      "font-weight:bold",
      "color:inherit",
      `color:${color};font-weight:bold`,
    );
  } else {
    const nameWidth = Math.max(...timings.map((timing) => timing.name.length));
    devLog(
      `%c📡 ${label}%c  %c${total}ms`,
      "font-weight:bold",
      "color:inherit",
      `color:${color};font-weight:bold`,
    );
    timings.forEach((timing) => {
      const ms = Math.round(timing.ms);
      const c = ms < 500 ? "#22c55e" : ms < 1500 ? "#f59e0b" : "#ef4444";
      devLog(
        `  %c${timing.name.padEnd(nameWidth)}%c  %c${String(ms).padStart(5)}ms`,
        "font-weight:bold",
        "color:inherit",
        `color:${c};font-weight:bold`,
      );
    });
    const divider = "─".repeat(nameWidth + 10);
    devLog(`  ${divider}`);
    devLog(
      `  %c${"Total".padEnd(nameWidth)}%c  %c${String(total).padStart(5)}ms`,
      "font-weight:bold",
      "color:inherit",
      `color:${color};font-weight:bold`,
    );
  }
}
