/**
 * One headline stat for the home dashboard hero: icon and label, a title, and
 * an optional footer. The story-of-the-day hero shows one at a time and wraps
 * it in InspirationCardSizeContext set to "spotlight", which enlarges every
 * card without each one having to know where it is shown.
 */
import { createContext, useContext } from "react";
import { motion } from "motion/react";

export const InspirationCardSizeContext = createContext("strip");

const SIZE_CLASSES = {
  strip: {
    root: "gap-0.5 py-1.5",
    icon: "h-3.5 w-3.5",
    description: "text-xs",
    title: "text-sm leading-snug sm:text-base",
    footer: "text-[11px] leading-tight",
  },
  spotlight: {
    root: "gap-1 py-1",
    icon: "h-4 w-4",
    description: "text-sm",
    title: "text-xl leading-tight sm:text-2xl",
    footer: "text-sm leading-snug",
  },
};

const ACCENTS = {
  primary: "text-primary",
  amber: "text-amber-500",
  emerald: "text-emerald-500",
  violet: "text-violet-500",
  orange: "text-orange-500",
};

export function InspirationCard({
  accent,
  icon: Icon,
  description,
  title,
  footer,
  footerMultiline = false,
  action,
  animationDelay,
}) {
  const iconColor = ACCENTS[accent] ?? ACCENTS.primary;
  const size =
    SIZE_CLASSES[useContext(InspirationCardSizeContext)] ?? SIZE_CLASSES.strip;

  return (
    <motion.div
      className={`flex min-w-0 flex-col ${size.root}`}
      initial={{ opacity: 0, x: -16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{
        type: "spring",
        stiffness: 220,
        damping: 22,
        delay: animationDelay / 1000,
      }}
    >
      <div className="flex items-center gap-2">
        <Icon className={`${size.icon} shrink-0 ${iconColor}`} />
        <span
          className={`text-muted-foreground blueprint:font-mono blueprint:tracking-wider blueprint:uppercase ${size.description}`}
        >
          {description}
        </span>
        {action && <span className="ml-1">{action}</span>}
      </div>
      <div
        className={`blueprint:font-mono font-semibold tabular-nums ${size.title}`}
      >
        {title}
      </div>
      {footer && (
        <motion.div
          className={`text-muted-foreground ${size.footer} ${
            footerMultiline ? "" : "line-clamp-1"
          }`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{
            duration: 0.3,
            delay: animationDelay / 1000 + 0.1,
          }}
        >
          {footer}
        </motion.div>
      )}
    </motion.div>
  );
}
