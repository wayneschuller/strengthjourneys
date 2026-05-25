/**
 * Development timing logs for log-page sheet API operations.
 */

const isDev = process.env.NEXT_PUBLIC_STRENGTH_JOURNEYS_ENV === "development";

export function logSheetTimings(label, timings, totalMs, addLogEntry) {
  if (!isDev) return;
  const total = Math.round(totalMs);
  const color = total < 500 ? "#22c55e" : total < 1500 ? "#f59e0b" : "#ef4444";

  if (timings.length <= 1) {
    console.log(
      `%c📡 ${label}%c  %c${total}ms`,
      "font-weight:bold",
      "color:inherit",
      `color:${color};font-weight:bold`,
    );
  } else {
    const nameWidth = Math.max(...timings.map((timing) => timing.name.length));
    console.groupCollapsed(
      `%c📡 ${label}%c  %c${total}ms`,
      "font-weight:bold",
      "color:inherit",
      `color:${color};font-weight:bold`,
    );
    timings.forEach((timing) => {
      const ms = Math.round(timing.ms);
      const c = ms < 500 ? "#22c55e" : ms < 1500 ? "#f59e0b" : "#ef4444";
      console.log(
        `  %c${timing.name.padEnd(nameWidth)}%c  %c${String(ms).padStart(5)}ms`,
        "font-weight:bold",
        "color:inherit",
        `color:${c};font-weight:bold`,
      );
    });
    const divider = "─".repeat(nameWidth + 10);
    console.log(`  ${divider}`);
    console.log(
      `  %c${"Total".padEnd(nameWidth)}%c  %c${String(total).padStart(5)}ms`,
      "font-weight:bold",
      "color:inherit",
      `color:${color};font-weight:bold`,
    );
    console.groupEnd();
  }

  if (addLogEntry) {
    const detail =
      timings.length > 1
        ? timings
            .map((timing) => `${timing.name} ${Math.round(timing.ms)}ms`)
            .join(" → ")
        : "";
    addLogEntry({ type: "timing", label, total, detail, color });
  }
}
