import { useRef, useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
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
import { gaTrackShareCopy } from "@/lib/analytics/analytics";
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
import {
  Copy,
  Download,
  GalleryHorizontal,
  Loader2,
  MoreHorizontal,
  Share2,
  Type,
  X,
} from "lucide-react";

// How long the recap sits untouched before the next arrow points out that there
// are more cards behind the title. Long enough to read the title card, short
// enough to catch someone before they leave.
const NUDGE_DELAY_MS = 4500;

// Cards that open with confetti: the title, and the lifter type reveal.
const CONFETTI_CARD_IDS = new Set(["title", "lifter-type"]);

// The hidden deck plays every card's entrance at once; the slowest (the lifter
// type) settles at about 1.5s, so capture waits a little past that.
const BATCH_SETTLE_MS = 1900;

// Downloads fired back to back get collapsed or blocked by some browsers.
const BATCH_DOWNLOAD_GAP_MS = 300;

function fireConfetti() {
  import("canvas-confetti").then((confetti) => {
    const fn = confetti.default;
    const opts = { origin: { x: 0.46, y: 0.6 }, spread: 70, zIndex: 9999 };
    fn({ ...opts, particleCount: 60 });
    fn({ ...opts, particleCount: 50, spread: 100, startVelocity: 30 });
    fn({ ...opts, particleCount: 40, spread: 120, startVelocity: 45 });
  });
}

/**
 * Story-style carousel of Strength Unwrapped recap slides for a given year.
 * Segments across the top show progress and jump to a card; tapping the right
 * of a card moves on and the left goes back, like a story. Confetti greets the
 * title and the lifter type reveal. Sharing covers the active card (native
 * share sheet, clipboard, 1080x1920 PNG), every card at once, and a plain-text
 * summary for text-first places like Reddit or X.
 * @param {Object} props
 * @param {number|string} props.year - The recap year to display across all slide cards.
 * @param {boolean} props.isDemo - When true, suppresses confetti and hides sharing in favour of a "Demo mode" label.
 */
export function YearRecapCarousel({ year, isDemo }) {
  const [api, setApi] = useState(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const shareRef = useRef(null);
  const [isSharing, setIsSharing] = useState(false);
  const { isSuccess: isCopied, triggerSuccess: triggerCopied } =
    useTransientSuccess();
  const { toast } = useToast();

  const { parsedData, meetDays } = useUserLiftingData();
  const { isMetric } = useAthleteBio();

  // Feature-detected after mount: navigator.canShare must not run during render
  // or the server and client markup disagree about which button to draw.
  const [canNativeShare, setCanNativeShare] = useState(false);
  useEffect(() => {
    setCanNativeShare(canNativeShareFiles());
  }, []);

  const firedConfettiRef = useRef(new Set());

  // The carousel is the whole page here: nothing else on screen says there are
  // more cards. If nobody has touched it after a few seconds, the next arrow
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
    firedConfettiRef.current = new Set();
  }, [year]);

  const activeSlideId = RECAP_CARDS[selectedIndex]?.id;

  useEffect(() => {
    if (isDemo || !CONFETTI_CARD_IDS.has(activeSlideId)) return;
    if (firedConfettiRef.current.has(activeSlideId)) return;
    firedConfettiRef.current.add(activeSlideId);
    // The lifter type lands its title at about 0.7s; the title card sooner.
    const timer = setTimeout(
      fireConfetti,
      activeSlideId === "lifter-type" ? 900 : 600,
    );
    return () => clearTimeout(timer);
  }, [activeSlideId, year, isDemo]);

  // Embla swallows the click that ends a swipe, so this only sees real taps.
  const handleSlideTap = (event) => {
    if (!api) return;
    if (event.target.closest("a, button")) return;
    const rect = event.currentTarget.getBoundingClientRect();
    if (event.clientX - rect.left < rect.width / 3) api.scrollPrev();
    else api.scrollNext();
  };

  const trackShare = (action) =>
    gaTrackShareCopy("year_recap", {
      page: "/strength-year-in-review",
      slide: action === "share_all" ? "all" : activeSlideId,
      action,
    });

  const summaryText = useMemo(
    () => buildRecapSummaryText({ parsedData, year, isMetric, meetDays }),
    [parsedData, year, isMetric, meetDays],
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
      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": blob }),
      ]);
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

  // --- Every card at once ---
  //
  // A second copy of the deck renders hidden with every card active, so all the
  // entrances play together and finish together. Once it settles, each card is
  // captured in turn. On a phone the share sheet then needs a fresh tap: the
  // captures take longer than a browser keeps a tap's permission alive, so the
  // footer offers "Share all" rather than calling share straight away.
  const [batch, setBatch] = useState(null); // { status, done, files }
  const batchRef = useRef(null);

  useEffect(() => {
    if (batch?.status !== "rendering") return;
    let cancelled = false;

    const run = async () => {
      await new Promise((resolve) => setTimeout(resolve, BATCH_SETTLE_MS));
      const slides =
        batchRef.current?.querySelectorAll("[data-recap-slide]") ?? [];
      const files = [];
      for (let i = 0; i < slides.length; i++) {
        if (cancelled) return;
        const blob = await captureRecapSlideBlob(slides[i]);
        const name = recapImageFileName(
          year,
          `${String(i + 1).padStart(2, "0")}-${RECAP_CARDS[i].id}`,
        );
        files.push(new File([blob], name, { type: "image/png" }));
        setBatch((prev) => prev && { ...prev, done: i + 1 });
      }
      if (cancelled) return;

      const canShareAll =
        canNativeShare && navigator.canShare?.({ files }) === true;
      if (canShareAll) {
        setBatch({ status: "ready", done: files.length, files });
        return;
      }
      for (const file of files) {
        downloadBlob(file, file.name);
        await new Promise((resolve) =>
          setTimeout(resolve, BATCH_DOWNLOAD_GAP_MS),
        );
      }
      setBatch(null);
      toast({ title: `Saved ${files.length} images` });
    };

    run().catch((error) => {
      console.error("Save all error:", error);
      if (!cancelled) {
        setBatch(null);
        toast({ variant: "destructive", title: "Could not save the cards" });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [batch?.status, year, canNativeShare, toast]);

  const handleShareAllReady = async () => {
    const files = batch?.files;
    if (!files) return;
    try {
      await navigator.share({
        files,
        title: `Strength Unwrapped ${year}`,
      });
      setBatch(null);
    } catch (error) {
      if (error?.name === "AbortError") return;
      console.error("Share all error:", error);
      for (const file of files) {
        downloadBlob(file, file.name);
        await new Promise((resolve) =>
          setTimeout(resolve, BATCH_DOWNLOAD_GAP_MS),
        );
      }
      setBatch(null);
      toast({ title: `Saved ${files.length} images` });
    }
  };

  const runShareAction = (action, handler) => {
    trackShare(action);
    handler();
  };

  const isBatchBusy = batch?.status === "rendering";

  return (
    <div className="relative">
      <div
        ref={shareRef}
        className="bg-card mx-auto max-w-[360px] rounded-xl border"
      >
        <nav className="flex gap-1 px-3 pt-3 pb-2" aria-label="Recap cards">
          {RECAP_CARDS.map(({ id, label }, index) => (
            <button
              key={id}
              type="button"
              aria-current={index === selectedIndex ? "step" : undefined}
              aria-label={`Card ${index + 1}: ${label}`}
              className="group flex h-4 flex-1 items-center"
              onClick={() => api?.scrollTo(index)}
            >
              <span className="bg-muted-foreground/20 block h-1 w-full overflow-hidden rounded-full">
                <span
                  className={cn(
                    "bg-primary block h-full rounded-full transition-[width] duration-500 ease-out",
                    index <= selectedIndex ? "w-full" : "w-0",
                  )}
                />
              </span>
            </button>
          ))}
        </nav>

        <Carousel setApi={setApi} className="w-full">
          <CarouselContent className="-ml-0">
            {RECAP_CARDS.map((card, index) => (
              <CarouselItem key={card.id} className="pl-0">
                <RecapSlide
                  card={card}
                  year={year}
                  isDemo={isDemo}
                  isActive={selectedIndex === index}
                  onClick={handleSlideTap}
                />
              </CarouselItem>
            ))}
          </CarouselContent>
          <CarouselPrevious className="top-1/2 -left-4 hidden md:flex" />
          <CarouselNext
            className={cn(
              "top-1/2 -right-4 hidden md:flex",
              showNudge && "recap-next-nudge",
            )}
          />
        </Carousel>

        <div
          id="ignoreCopy"
          className="flex items-center justify-between gap-2 border-t px-4 py-3"
        >
          <span className="text-muted-foreground text-sm">
            {selectedIndex + 1} of {RECAP_CARDS.length}
          </span>
          {isDemo ? (
            <DemoModeBadge size="sm" />
          ) : batch ? (
            <BatchStatus
              batch={batch}
              total={RECAP_CARDS.length}
              onShare={handleShareAllReady}
              onCancel={() => setBatch(null)}
            />
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
                  <DropdownMenuItem
                    onSelect={() =>
                      runShareAction("share_all", () =>
                        setBatch({ status: "rendering", done: 0 }),
                      )
                    }
                  >
                    <GalleryHorizontal className="mr-2 h-4 w-4" />
                    {canNativeShare ? "Share all cards" : "Save all cards"}
                  </DropdownMenuItem>
                  {canNativeShare && (
                    <DropdownMenuItem
                      onSelect={() =>
                        runShareAction("copy_image", handleCopyImage)
                      }
                    >
                      <Copy className="mr-2 h-4 w-4" />
                      Copy image
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem
                    onSelect={() =>
                      runShareAction("download_png", handleDownload)
                    }
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

      {isBatchBusy &&
        createPortal(
          <div
            ref={batchRef}
            data-recap-capture-hidden
            aria-hidden
            className="pointer-events-none fixed top-0 left-0 w-[360px]"
            style={{ visibility: "hidden" }}
          >
            {RECAP_CARDS.map((card) => (
              <div key={card.id} className="absolute inset-x-0 top-0">
                <RecapSlide card={card} year={year} isDemo={isDemo} isActive />
              </div>
            ))}
          </div>,
          document.body,
        )}
    </div>
  );
}

/**
 * One 9:16 recap slide: the theme glow behind, the card on top. Shared by the
 * carousel and the hidden deck that "save all cards" captures, so the saved
 * images match the screen.
 */
function RecapSlide({ card, year, isDemo, isActive, onClick }) {
  const { id, accent, Component } = card;
  return (
    <div
      data-recap-slide
      onClick={onClick}
      className="border-border bg-card relative flex aspect-[9/16] w-full items-center justify-center overflow-hidden rounded-xl border p-6"
    >
      <RecapBackdrop accent={accent} />
      <div className="relative flex w-full justify-center">
        <Component
          key={`${id}-${year}`}
          year={year}
          isDemo={isDemo}
          isActive={isActive}
        />
      </div>
    </div>
  );
}

// Two soft pools of the theme's chart colours in opposite corners. Plain
// radial gradients with element opacity, because html2canvas paints those
// faithfully where blur filters and masks come out wrong.
function RecapBackdrop({ accent = [1, 2] }) {
  const [first, second] = accent;
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      <div
        className="absolute -top-1/4 -left-1/3 h-3/4 w-[140%] opacity-30"
        style={{
          background: `radial-gradient(closest-side, var(--chart-${first}), transparent)`,
        }}
      />
      <div
        className="absolute -right-1/3 -bottom-1/4 h-3/4 w-[140%] opacity-25"
        style={{
          background: `radial-gradient(closest-side, var(--chart-${second}), transparent)`,
        }}
      />
    </div>
  );
}

function BatchStatus({ batch, total, onShare, onCancel }) {
  if (batch.status === "ready") {
    return (
      <div className="flex items-center gap-1.5">
        <Button size="sm" onClick={onShare}>
          <Share2 className="mr-1.5 h-4 w-4" />
          Share all {batch.files.length}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9"
          aria-label="Cancel sharing all cards"
          onClick={onCancel}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    );
  }
  return (
    <span className="text-muted-foreground flex items-center gap-2 text-sm">
      <Loader2 className="h-4 w-4 animate-spin" />
      {batch.done > 0 ? `Preparing ${batch.done} of ${total}` : "Preparing"}
    </span>
  );
}
