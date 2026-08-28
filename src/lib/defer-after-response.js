/**
 * Runs founder-notification work after the response has gone out instead of
 * in front of it.
 *
 * The sheet flow's activation notifications are founder-side bookkeeping:
 * cancel a scheduled "stalled" email, schedule the replacement, write the
 * result back to KV. None of it is anything the lifter is waiting to see, but
 * all of it used to sit between "your sheet exists" and the confirmation
 * screen rendering.
 *
 * Vercel exposes the per-invocation `waitUntil` on a well-known global symbol —
 * this is the same handle `@vercel/functions` resolves internally, and reading
 * it directly avoids pulling twenty transitive packages (execa, jose, the CLI
 * config) into the bundle for one three-line call.
 *
 * The care is in the fallback. The Vercel SDK calls `waitUntil?.()`, so with no
 * request context it accepts the promise and does nothing — the work would be
 * abandoned when the invocation freezes, and nothing would say so. That silent
 * shape is how the restricted-Resend-key incident stayed hidden. So when no
 * context is present we await the task inline, exactly as the call sites did
 * before this helper existed: slower, but never silently skipped. If the symbol
 * ever changes shape, this degrades to today's behaviour rather than to
 * dropped email.
 *
 * Tasks must not touch `res` — the response is on its way out.
 */
const VERCEL_REQUEST_CONTEXT = Symbol.for("@vercel/request-context");

let hasReportedInlineFallback = false;

function getPlatformWaitUntil() {
  const context = globalThis[VERCEL_REQUEST_CONTEXT]?.get?.();
  return typeof context?.waitUntil === "function"
    ? context.waitUntil.bind(context)
    : null;
}

export async function deferAfterResponse(label, task) {
  const waitUntil = getPlatformWaitUntil();

  if (!waitUntil) {
    // Say so once per instance. If deferral is silently unavailable in
    // production, this line is the only way to find out without waiting for a
    // founder email to go missing.
    if (!hasReportedInlineFallback) {
      hasReportedInlineFallback = true;
      console.log(
        "[defer] no platform waitUntil; founder work runs inline (pre-deferral behaviour)",
      );
    }
    try {
      await task();
    } catch (error) {
      console.error(`[defer:${label}] inline task failed:`, error);
    }
    return;
  }

  waitUntil(
    Promise.resolve()
      .then(task)
      .catch((error) => {
        console.error(`[defer:${label}] deferred task failed:`, error);
      }),
  );
}
