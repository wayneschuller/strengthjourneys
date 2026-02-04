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

  // FIXME: these should be on the landing somewhere not just hidden in the carousel
  const slogans = [
    "See gains. Break records. Lift with confidence.",
    "Effortless tracking and insights for serious lifters.",
    "Built by lifters, for lifters.",
    "Your lifting data, secured forever—right in your Google Sheet.",
    "Free and open source.",
    "Lift for yourself. Build strength, not comparisons.",
    "More time lifting, less time logging.",
    "For barbell weirdos.",
    "Never lose your lifting data again. It's your Google Sheet.",
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
            <h2 className="text-balance text-center text-3xl tracking-tighter text-amber-500">
              {slogan}
            </h2>
          </CarouselItem>
        ))}
      </CarouselContent>
    </Carousel>
  );
}
