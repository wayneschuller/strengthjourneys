import { useSyncExternalStore } from "react";

import { cn } from "@/lib/utils";

/*
 * Small "New" and "Updated" pills that retire themselves. Give each one the
 * day the feature launched or changed and it shows for one calendar month
 * after that date, then renders nothing, so a pill can never go stale on the
 * page. Old props left in the code are harmless; tidy them when convenient.
 *
 *   <NewPill date="2026-09-26" />
 *   <UpdatedPill date="2026-09-17" className="absolute top-2 right-2" />
 *
 * Pages are statically built, so the build clock cannot decide. The server
 * renders no pill and the browser adds it after hydration using its own date.
 */

const KIND_STYLES = {
  new: "bg-primary/10 text-primary border-primary/30",
  updated: "bg-transparent text-primary border-primary/30",
};

const KIND_LABELS = { new: "New", updated: "Updated" };

// Local midnight of a YYYY-MM-DD date, or null if it does not parse.
function parseLocalDate(isoDate) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate ?? "");
  if (!match) return null;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

/**
 * Whether a pill dated `isoDate` is still showing at `now`: from that day
 * until the same day next month.
 *
 * @param {string} isoDate - Launch or update day, YYYY-MM-DD.
 * @param {Date} [now]
 * @returns {boolean}
 */
export function isPillFresh(isoDate, now = new Date()) {
  const start = parseLocalDate(isoDate);
  if (!start) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(`FreshPill: date must be YYYY-MM-DD, got "${isoDate}"`);
    }
    return false;
  }
  const expires = new Date(start);
  expires.setMonth(expires.getMonth() + 1);
  return now >= start && now < expires;
}

const subscribe = () => () => {};

/**
 * A pill reading "New" or "Updated" that hides itself a month after `date`.
 *
 * @param {Object} props
 * @param {"new"|"updated"} props.kind
 * @param {string} props.date - Launch or update day, YYYY-MM-DD.
 * @param {string} [props.className]
 */
export function FreshPill({ kind, date, className }) {
  const fresh = useSyncExternalStore(
    subscribe,
    () => isPillFresh(date),
    () => false,
  );
  if (!fresh) return null;

  const label = KIND_LABELS[kind];
  const readableDate = parseLocalDate(date).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
  });

  return (
    <span
      title={`${label} ${readableDate}`}
      className={cn(
        "animate-in fade-in inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-xs leading-none font-semibold duration-500",
        KIND_STYLES[kind],
        className,
      )}
    >
      {label}
    </span>
  );
}

/** "New" pill that hides itself a month after `date` (YYYY-MM-DD). */
export function NewPill(props) {
  return <FreshPill kind="new" {...props} />;
}

/** "Updated" pill that hides itself a month after `date` (YYYY-MM-DD). */
export function UpdatedPill(props) {
  return <FreshPill kind="updated" {...props} />;
}
