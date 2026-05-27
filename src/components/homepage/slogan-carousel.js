/**
 * Landing hero slogan carousel.
 * Keep slogans short enough to survive mobile wrapping inside the fixed-height
 * carousel while reinforcing data ownership and long-term training continuity.
 */

import { useEffect, useRef, useState } from "react";
import Autoplay from "embla-carousel-autoplay";

import {
  Carousel,
  CarouselContent,
  CarouselItem,
} from "@/components/ui/carousel";

const SLOGANS = [
  "See gains. Break records. Lift with confidence.",
  "Effortless tracking and insights for serious lifters.",
  "Built by lifters, for lifters.",
  "Your lifting data, secured forever, right in your Google Sheet.",
  "Free and open source.",
  "Lift for yourself. Build strength, not comparisons.",
  "More time lifting, less time logging.",
  "For barbell weirdos.",
  "Never lose your lifting data again. It's your Google Sheet.",
  "Train hard. Let your data tell the story.",
  "Your strength journey, visualized in minutes.",
  "Progress you can see, not just feel.",
  "From spreadsheet rows to PR momentum.",
  "Own your numbers. Own your training.",
  "Merge your fitness app exports into one Google Sheet you own.",
  "Hevy, Strong, Wodify, BTWB, spreadsheets: one lifting timeline.",
  "Your training history deserves a permanent home.",
  "Simple logging. Serious lifting insights.",
  "Turn every session into measurable progress.",
  "Clarity for your next block of training.",
  "The bar doesn't lie, and neither does your data.",
  "Built to keep lifters consistent for the long haul.",
];

function shuffleArray(items) {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Auto-playing carousel of marketing slogans for the landing page hero section.
 * Slogans are shuffled on mount (keeping the first item fixed) and cycle every 6 seconds.
 *
 * @param {Object} props - No props.
 */
export function SloganCarousel() {
  const plugin = useRef(Autoplay({ delay: 6000, stopOnInteraction: false }));
  const shuffledSlogansRef = useRef(null);
  const [slogans, setSlogans] = useState(SLOGANS);

  useEffect(() => {
    if (!shuffledSlogansRef.current) {
      const [firstSlogan, ...remainingSlogans] = SLOGANS;
      shuffledSlogansRef.current = [
        firstSlogan,
        ...shuffleArray(remainingSlogans),
      ];
    }
    setSlogans(shuffledSlogansRef.current);
  }, []);

  return (
    <Carousel
      plugins={[plugin.current]}
      className="w-full h-20"
      onMouseEnter={plugin.current.stop}
      onMouseLeave={plugin.current.reset}
      onFocusCapture={plugin.current.stop}
      onBlurCapture={plugin.current.reset}
      onPointerDownCapture={plugin.current.stop}
      onPointerUpCapture={plugin.current.reset}
    >
      <CarouselContent>
        {slogans.map((slogan) => (
          <CarouselItem key={slogan}>
            <p className="flex h-20 items-center justify-center px-2 text-balance text-center text-2xl leading-tight text-amber-500 md:text-3xl">
              {slogan}
            </p>
          </CarouselItem>
        ))}
      </CarouselContent>
    </Carousel>
  );
}
