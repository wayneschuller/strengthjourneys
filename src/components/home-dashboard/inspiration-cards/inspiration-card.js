import { motion } from "motion/react";

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

  return (
    <motion.div
      className="flex flex-col gap-0.5 py-1.5"
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
        <Icon className={`h-3.5 w-3.5 shrink-0 ${iconColor}`} />
        <span className="text-muted-foreground text-xs">{description}</span>
        {action && <span className="ml-1">{action}</span>}
      </div>
      <div className="text-sm leading-snug font-semibold tabular-nums sm:text-base">
        {title}
      </div>
      {footer && (
        <motion.div
          className={`text-muted-foreground text-[11px] leading-tight ${
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
