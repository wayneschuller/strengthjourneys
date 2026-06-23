
import Link from "next/link";
import { useRouter } from "next/router";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  AppBanner,
  AppBannerContent,
  AppBannerDescription,
  AppBannerIconBadge,
  AppBannerLeading,
  AppBannerTitle,
} from "@/components/ui/app-banner";
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
      <Link href={href} className="block">
        <AppBanner as="div" layout="card" tint="primary">
          <AppBannerContent density="card">
            <AppBannerLeading>
              <AppBannerIconBadge>
                <Sparkles className="h-6 w-6 text-primary" />
              </AppBannerIconBadge>
              <div>
                <AppBannerTitle>Strength Unwrapped</AppBannerTitle>
                <AppBannerDescription>
                  Your {currentYear} in strength. See your recap.
                </AppBannerDescription>
              </div>
            </AppBannerLeading>
            <Button variant="default" size="sm" className="shrink-0">
              View my recap
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </AppBannerContent>
        </AppBanner>
      </Link>
    </div>
  );
}
