import { useRef, useState, useEffect, useMemo } from "react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselPrevious,
  CarouselNext,
} from "@/components/ui/carousel";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useTransientSuccess } from "@/hooks/use-transient-success";
import { useUserLiftingData } from "@/hooks/use-userlift-data";
import { useAthleteBio } from "@/hooks/use-athlete-biodata";
import { gaTrackShareCopy } from "@/lib/analytics";
import {
  captureRecapSlideBlob,
  canNativeShareFiles,
  downloadBlob,
  recapImageFileName,
} from "@/lib/recap-share-image";
import { buildRecapSummaryText } from "@/lib/year-recap-stats";
import { ShareCopyButton } from "@/components/share-copy-button";
import { DemoModeBadge } from "@/components/demo-mode-badge";
import { RECAP_CARDS } from "@/components/year-recap/recap-cards";
import { cn } from "@/lib/utils";
import { Copy, Download, MoreHorizontal, Type } from "lucide-react";

// How long the recap sits untouched before the next arrow points out that there
// are seven more cards behind the title. Long enough to read the title card,
// short enough to catch someone before they leave.
const NUDGE_DELAY_MS = 4500;

function fireTitleConfetti() {
  import("canvas-confetti").then((confetti) => {
    const fn = confetti.default;
    const opts = { origin: { x: 0.46, y: 0.6 }, spread: 70, zIndex: 9999 };
    fn({ ...opts, particleCount: 60 });
    fn({ ...opts, particleCount: 50, spread: 100, startVelocity: 30 });
    fn({ ...opts, particleCount: 40, spread: 120, startVelocity: 45 });
  });
}

/**
 * Full-screen carousel of Strength Unwrapped recap slides for a given year.
 * Fires confetti on the title slide and offers four ways to share the active
 * slide: the native share sheet (mobile), clipboard image, a 1080x1920 PNG
 * download, and a plain-text summary for text-first places like Reddit or X.
 * @param {Object} props
 * @param {number|string} props.year - The recap year to display across all slide cards.
 * @param {boolean} props.isDemo - When true, suppresses confetti and hides sharing in favour of a "Demo mode" label.
 */
export function YearRecapCarousel({ year, isDemo }) {
  const [api, setApi] = useState(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const shareRef = useRef(null);
  const [isSharing, setIsSharing] = useState(false);
  const { isSuccess: isCopied, triggerSuccess: triggerCopied } = useTransientSuccess();
  const { toast } = useToast();

  const { parsedData } = useUserLiftingData();
  const { isMetric } = useAthleteBio();

  // Feature-detected after mount: navigator.canShare must not run during render
  // or the server and client markup disagree about which button to draw.
  const [canNativeShare, setCanNativeShare] = useState(false);
  useEffect(() => {
    setCanNativeShare(canNativeShareFiles());
  }, []);

  const hasFiredConfettiRef = useRef(false);

  // The carousel is the whole page here: nothing else on screen says there are
  // eight cards. If nobody has touched it after a few seconds, the next arrow
  // starts nudging and keeps nudging (see .recap-next-nudge in globals.css).
  // Any interaction at all retires it for the rest of the visit — once someone
  // knows the deck moves, pointing at the arrow is just noise.
  const hasInteractedRef = useRef(false);
  const [showNudge, setShowNudge] = useState(false);

  useEffect(() => {
    if (!api) return;
    setSelectedIndex(api.selectedScrollSnap());

    const markInteracted = () => {
      hasInteractedRef.current = true;
      setShowNudge(false);
    };
    const onSelect = () => {
      setSelectedIndex(api.selectedScrollSnap());
      markInteracted();
    };

    api.on("select", onSelect);
    // Counts a swipe or a drag that lands back on the same card as interaction.
    api.on("pointerDown", markInteracted);
    return () => {
      api.off("select", onSelect);
      api.off("pointerDown", markInteracted);
    };
  }, [api]);

  useEffect(() => {
    if (hasInteractedRef.current) return;
    const timer = setTimeout(() => {
      if (!hasInteractedRef.current) setShowNudge(true);
    }, NUDGE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [year]);

  useEffect(() => {
    if (year) hasFiredConfettiRef.current = false;
  }, [year]);

  useEffect(() => {
    if (isDemo) return;
    if (selectedIndex === 0 && !hasFiredConfettiRef.current) {
      hasFiredConfettiRef.current = true;
      const timer = setTimeout(fireTitleConfetti, 600);
      return () => clearTimeout(timer);
    }
  }, [selectedIndex, year, isDemo]);

  const activeSlideId = RECAP_CARDS[selectedIndex]?.id;

  const trackShare = (action) =>
    gaTrackShareCopy("year_recap", {
      page: "/strength-year-in-review",
      slide: activeSlideId,
      action,
    });

  const summaryText = useMemo(
    () => buildRecapSummaryText({ parsedData, year, isMetric }),
    [parsedData, year, isMetric],
  );

  // Capture whichever slide is currently on screen. Every image path goes
  // through here so the clipboard, the download, and the native share sheet all
  // hand over the same 1080x1920 asset.
  const captureActiveSlide = async () => {
    if (!shareRef.current) return null;
    const slides = shareRef.current.querySelectorAll("[data-recap-slide]");
    const activeSlide = slides[selectedIndex];
    if (!activeSlide) {
      toast({ variant: "destructive", title: "Could not capture slide" });
      return null;
    }
    return captureRecapSlideBlob(activeSlide);
  };

  const handleCopyImage = async () => {
    setIsSharing(true);
    try {
      const blob = await captureActiveSlide();
      if (!blob) return;
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      triggerCopied();
    } catch (error) {
      console.error("Copy error:", error);
      toast({ variant: "destructive", title: "Could not copy to clipboard" });
    } finally {
      setIsSharing(false);
    }
  };

  const handleDownload = async () => {
    setIsSharing(true);
    try {
      const blob = await captureActiveSlide();
      if (!blob) return;
      downloadBlob(blob, recapImageFileName(year, activeSlideId));
      toast({ title: "Image saved" });
    } catch (error) {
      console.error("Download error:", error);
      toast({ variant: "destructive", title: "Could not save the image" });
    } finally {
      setIsSharing(false);
    }
  };

  const handleNativeShare = async () => {
    setIsSharing(true);
    try {
      const blob = await captureActiveSlide();
      if (!blob) return;
      const file = new File([blob], recapImageFileName(year, activeSlideId), {
        type: "image/png",
      });
      await navigator.share({
        files: [file],
        title: `Strength Unwrapped ${year}`,
      });
    } catch (error) {
      // The user dismissing the share sheet is not a failure.
      if (error?.name === "AbortError") return;
      // Safari can drop the user-gesture permission across the await while the
      // canvas renders. Saving the file still gets the image onto their phone.
      if (error?.name === "NotAllowedError") {
        try {
          const blob = await captureActiveSlide();
          if (blob) {
            downloadBlob(blob, recapImageFileName(year, activeSlideId));
            toast({ title: "Image saved" });
            return;
          }
        } catch {
          // fall through to the generic message below
        }
      }
      console.error("Share error:", error);
      toast({ variant: "destructive", title: "Could not share this card" });
    } finally {
      setIsSharing(false);
    }
  };

  const handleCopyText = async () => {
    try {
      await navigator.clipboard.writeText(summaryText);
      toast({ title: "Summary copied", description: "Paste it anywhere." });
    } catch (error) {
      console.error("Copy text error:", error);
      toast({ variant: "destructive", title: "Could not copy the summary" });
    }
  };

  const runShareAction = (action, handler) => {
    trackShare(action);
    handler();
  };

  return (
    <div className="relative">
      <div ref={shareRef} className="mx-auto max-w-[360px] rounded-xl border bg-card">
        <Carousel setApi={setApi} className="w-full">
          <CarouselContent className="-ml-0">
            {RECAP_CARDS.map(({ id, Component }, index) => (
              <CarouselItem key={id} className="pl-0">
                <div
                  data-recap-slide
                  className="relative flex aspect-[9/16] w-full items-center justify-center rounded-xl border border-border bg-card p-6"
                >
                  <Component
                    key={`${id}-${year}`}
                    year={year}
                    isDemo={isDemo}
                    isActive={selectedIndex === index}
                  />
                </div>
              </CarouselItem>
            ))}
          </CarouselContent>
          <CarouselPrevious className="-left-4 top-1/2 hidden md:flex" />
          <CarouselNext
            className={cn(
              "-right-4 top-1/2 hidden md:flex",
              showNudge && "recap-next-nudge",
            )}
          />
        </Carousel>

        <div
          id="ignoreCopy"
          className="flex items-center justify-between gap-2 border-t px-4 py-3"
        >
          <span className="text-sm text-muted-foreground">
            {selectedIndex + 1} of {RECAP_CARDS.length}
          </span>
          {isDemo ? (
            <DemoModeBadge size="sm" />
          ) : (
            <div className="flex items-center gap-1.5">
              <ShareCopyButton
                label={canNativeShare ? "Share" : "Copy this card"}
                successLabel="Copied"
                isSuccess={isCopied}
                onClick={
                  canNativeShare
                    ? () => runShareAction("native_share", handleNativeShare)
                    : () => runShareAction("copy_image", handleCopyImage)
                }
                isLoading={isSharing}
                disabled={isSharing}
                className={canNativeShare ? "min-w-[92px]" : "min-w-[124px]"}
              />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-9 w-9 shrink-0"
                    aria-label="More sharing options"
                    disabled={isSharing}
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {canNativeShare && (
                    <DropdownMenuItem
                      onSelect={() => runShareAction("copy_image", handleCopyImage)}
                    >
                      <Copy className="mr-2 h-4 w-4" />
                      Copy image
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem
                    onSelect={() => runShareAction("download_png", handleDownload)}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Save image (1080&times;1920)
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() => runShareAction("copy_text", handleCopyText)}
                  >
                    <Type className="mr-2 h-4 w-4" />
                    Copy text summary
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
