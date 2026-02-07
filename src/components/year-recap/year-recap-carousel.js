"use client";

import { useRef, useState, useEffect } from "react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselPrevious,
  CarouselNext,
} from "@/components/ui/carousel";
import { Button } from "@/components/ui/button";
import { Share2, LoaderCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { TitleCard } from "./cards/title-card";
import { SessionsCard } from "./cards/sessions-card";
import { TonnageCard } from "./cards/tonnage-card";
import { MostTrainedLiftCard } from "./cards/most-trained-lift-card";
import { ConsistencyCard } from "./cards/consistency-card";
import { PRHighlightsCard } from "./cards/pr-highlights-card";
import { SeasonalPatternCard } from "./cards/seasonal-pattern-card";
import { ClosingCard } from "./cards/closing-card";

function fireTitleConfetti() {
  import("canvas-confetti").then((confetti) => {
    const fn = confetti.default;
    const opts = { origin: { y: 0.6 }, spread: 70, zIndex: 9999 };
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
    if (api) {
      api.scrollTo(0);
      setSelectedIndex(0);
    }
  }, [api, year]);

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

  const handleShare = async () => {
    if (!shareRef.current) return;
    setIsSharing(true);
    try {
      const html2canvas = (await import("html2canvas")).default;
      const slides = shareRef.current.querySelectorAll("[data-recap-slide]");
      const activeSlide = slides[selectedIndex];
      if (!activeSlide) {
        toast({ variant: "destructive", title: "Could not capture slide" });
        return;
      }
      const canvas = await html2canvas(activeSlide, {
        backgroundColor: null,
        scale: 2,
      });
      canvas.toBlob((blob) => {
        navigator.clipboard
          .write([new ClipboardItem({ "image/png": blob })])
          .then(() => {
            toast({ title: "Copied to clipboard! Paste into Instagram or anywhere." });
          })
          .catch((err) => {
            console.error("Copy error:", err);
            toast({ variant: "destructive", title: "Could not copy to clipboard" });
          });
      }, "image/png");
    } finally {
      setIsSharing(false);
    }
  };

  const cards = [
    { id: "title", Component: TitleCard },
    { id: "sessions", Component: SessionsCard },
    { id: "tonnage", Component: TonnageCard },
    { id: "most-trained", Component: MostTrainedLiftCard },
    { id: "consistency", Component: ConsistencyCard },
    { id: "pr-highlights", Component: PRHighlightsCard },
    { id: "seasonal", Component: SeasonalPatternCard },
    { id: "closing", Component: ClosingCard },
  ];

  return (
    <div className="relative">
      {isSharing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
          <div className="flex flex-col items-center gap-4 rounded-lg border bg-background p-6 shadow-lg">
            <LoaderCircle className="h-8 w-8 animate-spin" />
            <p className="text-sm text-muted-foreground">Generating image...</p>
          </div>
        </div>
      )}

      <div ref={shareRef} className="mx-auto max-w-[360px] rounded-xl border bg-card">
        <Carousel setApi={setApi} className="w-full">
          <CarouselContent className="-ml-0">
            {cards.map(({ id, Component }, index) => (
              <CarouselItem key={id} className="pl-0">
                <div
                  data-recap-slide
                  className="flex aspect-[9/16] w-full items-center justify-center rounded-xl border border-border bg-card p-6"
                >
                  <Component
                    key={id === "title" ? `${id}-${year}` : id}
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
          <Button variant="outline" size="sm" onClick={handleShare} disabled={isSharing}>
            {isSharing ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <Share2 className="h-4 w-4" />
            )}
            <span className="ml-2">Copy this card</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
