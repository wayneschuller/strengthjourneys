
import Link from "next/link";
import { useRouter } from "next/router";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sparkles, ChevronRight } from "lucide-react";

/**
 * December promo banner for Strength Unwrapped (yearly recap).
 * Shows in December or when ?showRecapBanner=1. Returns null otherwise.
 * @param {Object} props
 * @param {string} [props.className] - Additional CSS classes for the wrapper element.
 * @param {boolean} [props.hidden] - When true, forces the banner to be hidden regardless of date or query params.
 */
export function StrengthUnwrappedDecemberBanner({ className, hidden }) {
  const router = useRouter();
  const forceShow = router.query?.showRecapBanner === "1";
  const isDecember = new Date().getMonth() === 11;
  const shouldShow = !hidden && (isDecember || forceShow);

  if (!shouldShow) return null;

  const currentYear = new Date().getFullYear();
  const href = `/strength-year-in-review?year=${currentYear}`;

  return (
    <div className={cn("w-full", className)}>
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
    </div>
  );
}
