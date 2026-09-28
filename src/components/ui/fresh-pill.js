import { useSyncExternalStore } from "react";
import { motion } from "motion/react";
import { RefreshCw, Sparkles } from "lucide-react";

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

// Each kind takes a theme chart color for its fill, border and icon, so the
// pills pick up every theme's palette. The label stays in the foreground color
// because some themes' chart colors are too light to read as text. The icon
// plays when the pill or its surrounding card (a `group`) is hovered.
const KINDS = {
  new: {
    label: "New",
    Icon: Sparkles,
    pillClass: "bg-chart-1/15 border-chart-1/40",
    iconClass:
      "text-chart-1 group-hover:scale-125 group-hover:rotate-12 group-hover/pill:scale-125 group-hover/pill:rotate-12",
  },
  updated: {
    label: "Updated",
    Icon: RefreshCw,
    pillClass: "bg-chart-2/15 border-chart-2/40",
    iconClass: "text-chart-2 group-hover:rotate-180 group-hover/pill:rotate-180",
  },
};

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

  const { label, Icon, pillClass, iconClass } = KINDS[kind];
  const readableDate = parseLocalDate(date).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
  });

  return (
    // Pops in the first time it scrolls into view, like the landing cards' icons.
    <motion.span
      initial={{ opacity: 0, scale: 0.6 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true, margin: "-40px", amount: 0.5 }}
      transition={{ type: "spring", stiffness: 400, damping: 16, delay: 0.15 }}
      title={`${label} ${readableDate}`}
      className={cn(
        "group/pill text-foreground inline-flex shrink-0 items-center gap-1 rounded-full border py-0.5 pr-2 pl-1.5 text-xs leading-none font-semibold",
        pillClass,
        className,
      )}
    >
      <Icon
        aria-hidden
        className={cn(
          "size-3 transition-transform duration-500 ease-out",
          iconClass,
        )}
      />
      {label}
    </motion.span>
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
