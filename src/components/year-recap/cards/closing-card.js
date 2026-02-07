"use client";

import { useRef } from "react";
import { motion } from "motion/react";
import { pickQuirkyPhrase, CLOSING_PHRASES } from "../phrases";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ChevronRight } from "lucide-react";

export function ClosingCard({ year, isDemo, isActive = true }) {
  const phraseRef = useRef(null);
  const phrase = pickQuirkyPhrase(
    CLOSING_PHRASES,
    phraseRef,
    `closing-${year}`,
  );

  return (
    <div className="flex flex-col items-center justify-center text-center">
      <motion.p
        className="text-2xl font-semibold text-foreground md:text-3xl"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={isActive ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.95 }}
        transition={{ type: "spring", stiffness: 200, damping: 22 }}
      >
        {phrase}
      </motion.p>
      <motion.p
        className="mt-4 text-chart-2"
        initial={{ opacity: 0, y: 12 }}
        animate={isActive ? { opacity: 1, y: 0 } : { opacity: 0, y: 12 }}
        transition={{ type: "spring", stiffness: 180, damping: 20, delay: isActive ? 0.15 : 0 }}
      >
        Keep training. The next year awaits.
      </motion.p>
      <motion.p
        className="mt-2 text-sm text-chart-4"
        initial={{ opacity: 0, y: 8 }}
        animate={isActive ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 }}
        transition={{ delay: isActive ? 0.3 : 0 }}
      >
        Created with Strength Journeys
      </motion.p>
      {!isDemo && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isActive ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ type: "spring", stiffness: 180, damping: 20, delay: isActive ? 0.4 : 0 }}
        >
          <Link href="/">
            <Button variant="outline" className="mt-6">
              Back to dashboard
              <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </motion.div>
      )}
      {isDemo && (
        <motion.p
          className="mt-4 text-xs text-muted-foreground"
          initial={{ opacity: 0 }}
          animate={isActive ? { opacity: 1 } : { opacity: 0 }}
          transition={{ delay: isActive ? 0.45 : 0 }}
        >
          Sign in to see your own recap
        </motion.p>
      )}
    </div>
  );
}
