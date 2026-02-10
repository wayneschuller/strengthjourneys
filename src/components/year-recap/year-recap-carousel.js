"use client";

import { useRef, useState, useEffect } from "react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselPrevious,
  CarouselNext,
} from "@/components/ui/carousel";
import { useToast } from "@/hooks/use-toast";
import { trackShareCopy } from "@/lib/analytics";
import { ShareCopyButton } from "@/components/share-copy-button";
import { TitleCard } from "./cards/title-card";
import { SessionsCard } from "./cards/sessions-card";
import { TonnageCard } from "./cards/tonnage-card";
import { MostTrainedLiftCard } from "./cards/most-trained-lift-card";
import { LifetimePRsCard } from "./cards/lifetime-prs-card";
import { NotableLiftsCard } from "./cards/notable-lifts-card";
import { SeasonalPatternCard } from "./cards/seasonal-pattern-card";
import { ClosingCard } from "./cards/closing-card";

function fireTitleConfetti() {
  import("canvas-confetti").then((confetti) => {
    const fn = confetti.default;
    const opts = { origin: { x: 0.46, y: 0.6 }, spread: 70, zIndex: 9999 };
    fn({ ...opts, particleCount: 60 });
    fn({ ...opts, particleCount: 50, spread: 100, startVelocity: 30 });
    fn({ ...opts, particleCount: 40, spread: 120, startVelocity: 45 });
  });
}

export function YearRecapCarousel({ year, isDemo }) {
  const [api, setApi] = useState(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const shareRef = useRef(null);
  const [isSharing, setIsSharing] = useState(false);
  const { toast } = useToast();

  const hasFiredConfettiRef = useRef(false);

  useEffect(() => {
    if (!api) return;
    setSelectedIndex(api.selectedScrollSnap());
    api.on("select", () => setSelectedIndex(api.selectedScrollSnap()));
  }, [api]);

  useEffect(() => {
    if (year) hasFiredConfettiRef.current = false;
  }, [year]);

  useEffect(() => {
    if (selectedIndex === 0 && !hasFiredConfettiRef.current) {
      hasFiredConfettiRef.current = true;
      const timer = setTimeout(fireTitleConfetti, 600);
      return () => clearTimeout(timer);
    }
  }, [selectedIndex, year]);

  const cards = [
    { id: "title", Component: TitleCard },
    { id: "sessions", Component: SessionsCard },
    { id: "tonnage", Component: TonnageCard },
    { id: "most-trained", Component: MostTrainedLiftCard },
    { id: "lifetime-prs", Component: LifetimePRsCard },
    { id: "notable-lifts", Component: NotableLiftsCard },
    { id: "seasonal", Component: SeasonalPatternCard },
    { id: "closing", Component: ClosingCard },
  ];

  const handleShare = async () => {
    if (!shareRef.current) return;
    setIsSharing(true);
    try {
      const html2canvas = (await import("html2canvas-pro")).default;
      const slides = shareRef.current.querySelectorAll("[data-recap-slide]");
      const activeSlide = slides[selectedIndex];
      if (!activeSlide) {
        toast({ variant: "destructive", title: "Could not capture slide" });
        return;
      }

      let watermarkEl = null;
      try {
        watermarkEl = document.createElement("div");
        watermarkEl.textContent = "strengthjourneys.xyz";
        Object.assign(watermarkEl.style, {
          position: "absolute",
          right: "18px",
          bottom: "10px",
          padding: "4px 12px",
          borderRadius: "9999px",
          background: "rgba(15, 23, 42, 0.86)",
          color: "rgba(248, 250, 252, 0.98)",
          fontSize: "11px",
          fontWeight: "500",
          letterSpacing: "0.03em",
          textTransform: "none",
          fontFamily:
            'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
          boxShadow: "0 6px 16px rgba(15, 23, 42, 0.55)",
          pointerEvents: "none",
          zIndex: "10",
        });
        activeSlide.appendChild(watermarkEl);

        const canvas = await html2canvas(activeSlide, {
          backgroundColor: null,
          scale: 2,
        });

        canvas.toBlob((blob) => {
          navigator.clipboard
            .write([new ClipboardItem({ "image/png": blob })])
            .then(() => {
              toast({ title: "Copied to clipboard! Paste into Instagram or anywhere." });
              const slideId = cards[selectedIndex]?.id;
              trackShareCopy("year_recap", { page: "/strength-year-in-review", slide: slideId });
            })
            .catch((err) => {
              console.error("Copy error:", err);
              toast({ variant: "destructive", title: "Could not copy to clipboard" });
            });
        }, "image/png");
      } finally {
        if (watermarkEl && watermarkEl.parentNode) {
          watermarkEl.parentNode.removeChild(watermarkEl);
        }
      }
    } finally {
      setIsSharing(false);
    }
  };

  return (
    <div className="relative">
      <div ref={shareRef} className="mx-auto max-w-[360px] rounded-xl border bg-card">
        <Carousel setApi={setApi} className="w-full">
          <CarouselContent className="-ml-0">
            {cards.map(({ id, Component }, index) => (
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
          <CarouselNext className="-right-4 top-1/2 hidden md:flex" />
        </Carousel>

        <div
          id="ignoreCopy"
          className="flex items-center justify-between border-t px-4 py-3"
        >
          <span className="text-sm text-muted-foreground">
            {selectedIndex + 1} of {cards.length}
          </span>
          {isDemo ? (
            <span className="text-sm text-muted-foreground">Demo mode</span>
          ) : (
            <ShareCopyButton
              label="Copy this card"
              onClick={handleShare}
              isLoading={isSharing}
              disabled={isSharing}
            />
          )}
        </div>
      </div>
    </div>
  );
}
