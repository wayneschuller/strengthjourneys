/** @format */

import { motion } from "motion/react";
import { Sheet, Link2, BarChart3 } from "lucide-react";

const steps = [
  {
    number: 1,
    title: "Log your lifts",
    description: "Simple spreadsheet: date, lift, reps, weight.",
    Icon: Sheet,
  },
  {
    number: 2,
    title: "Connect once",
    description: "Free Google sign-in. We never store your data.",
    Icon: Link2,
  },
  {
    number: 3,
    title: "Get insights",
    description: "PRs, consistency streaks, tonnage, strength levels.",
    Icon: BarChart3,
  },
];

const springTransition = {
  type: "spring",
  stiffness: 400,
  damping: 18,
};

export function HowItWorksStrip() {
  return (
    <section className="py-16 md:py-24">
      <motion.h2
        className="mb-12 text-center text-2xl font-bold tracking-tight md:text-3xl"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={springTransition}
      >
        How it works
      </motion.h2>

      <div className="relative mx-auto max-w-4xl">
        {/* Connecting line (desktop only) */}
        <div className="absolute top-10 right-[16%] left-[16%] hidden h-px border-t-2 border-dashed border-muted-foreground/30 md:block" />

        <div className="flex flex-col items-center gap-12 md:flex-row md:justify-between md:gap-4">
          {steps.map((step, index) => (
            <motion.div
              key={step.number}
              className="flex flex-col items-center text-center md:flex-1"
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ ...springTransition, delay: index * 0.12 }}
            >
              {/* Numbered circle with icon */}
              <div className="relative mb-4 flex h-20 w-20 items-center justify-center rounded-full border-2 border-muted-foreground/20 bg-card">
                <step.Icon
                  size={32}
                  strokeWidth={1.5}
                  className="text-amber-500"
                />
                <span className="absolute -top-2 -right-2 flex h-7 w-7 items-center justify-center rounded-full bg-amber-500 text-sm font-bold text-white">
                  {step.number}
                </span>
              </div>

              <h3 className="mb-1 text-lg font-semibold">{step.title}</h3>
              <p className="max-w-[200px] text-sm text-muted-foreground">
                {step.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
