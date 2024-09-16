import { useRef } from "react";
import Autoplay from "embla-carousel-autoplay";

import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";

export function SloganCarousel() {
  const plugin = useRef(Autoplay({ delay: 6000, stopOnInteraction: false }));

  const slogans = [
    "See gains. Break records. Lift with confidence.",
    "Effortless tracking and insights for serious lifters.",
    "Built by lifters, for lifters.",
    `"I feel like I'm getting rewarded for going to the gym." - Stacey, 32, gym enthusiast.`,
    "Free and open source.",
    `"I trust putting my data into Google Sheets over other apps." - Jake, 28, powerlifter.`,
    "Lift for yourself. Build strength, not comparisons.",
    `"The instant visualizer is incredibly motivating." - Brian, 40, lifter.`,
    "More time lifting, less time logging.",
    `"I've never seen my strength progress so clearly." - John, 37, lifter.`,
    "For barbell weirdos.",
  ];

  return (
    <Carousel
      plugins={[plugin.current]}
      className="w-full"
      onMouseEnter={plugin.current.stop}
      onMouseLeave={plugin.current.reset}
    >
      <CarouselContent>
        {slogans.map((slogan, index) => (
          <CarouselItem key={index}>
            <h2 className="text-center text-3xl tracking-tighter text-amber-600 dark:text-amber-400">
              {slogan}
            </h2>
          </CarouselItem>
        ))}
      </CarouselContent>
    </Carousel>
  );
}
