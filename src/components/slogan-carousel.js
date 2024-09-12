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
  const plugin = useRef(Autoplay({ delay: 3000, stopOnInteraction: true }));

  const slogans = [
    "Lift for yourself. Build strength, not comparisons.",
    `"I feel like I'm getting rewarded for going to the gym." - Stacey, 32, gym enthusiast.`,
    "Your data, our visualizations.",
    `"I trust putting my data into Google Sheets over other apps." - Jake, 28, powerlifter.`,
    "More time lifting, less time logging.",
    `"The instant visualizer is incredibly motivating." - Brian, 40, lifter.`,
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
