"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Sparkles, ChevronRight } from "lucide-react";

export function StrengthUnwrappedBanner() {
  const currentYear = new Date().getFullYear();
  const href = `/strength-year-in-review?year=${currentYear}`;

  return (
    <Link href={href}>
      <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 transition-colors hover:bg-primary/10 md:p-6">
        <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/20 p-2">
              <Sparkles className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">Strength Unwrapped</h3>
              <p className="text-sm text-muted-foreground">
                Your {currentYear} in strength. See your recap.
              </p>
            </div>
          </div>
          <Button variant="default" size="sm" className="shrink-0">
            View my recap
            <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
      </div>
    </Link>
  );
}
