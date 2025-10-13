"use client";
import { useState, useEffect } from "react";
import Image from "next/image";
import { useSession, signIn } from "next-auth/react";
import { SloganCarousel } from "./slogan-carousel";
import { Button } from "./ui/button";

export function HeroSection() {
  return (
    <div>
      <div className="mb-8 flex flex-row justify-center">
        <SloganCarousel />
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-2">
        <div>
          <h1 className="mb-4 mt-4 space-x-2 text-balance text-center text-5xl font-extrabold leading-tight tracking-tight md:mb-8 md:mt-8 lg:text-left lg:text-6xl xl:text-7xl">
            Welcome to Strength Journeys
          </h1>

          <PageDescription />
          <GoogleSignInButton />
        </div>
        <SpreadsheetShowcase />
      </div>
    </div>
  );
}

const PageDescription = () => (
  <h2 className="mb-10 mt-2 text-center text-xl tracking-tight md:text-left md:text-3xl lg:w-4/5">
    A free{" "}
    <a
      className="text-blue-600 underline visited:text-purple-600 hover:text-blue-800"
      target="_blank"
      href="https://github.com/wayneschuller/strengthjourneys"
    >
      open source
    </a>{" "}
    dashboard that turns your{" "}
    <a
      className="text-blue-600 underline visited:text-purple-600 hover:text-blue-800"
      target="_blank"
      href="https://docs.google.com/spreadsheets/d/14J9z9iJBCeJksesf3MdmpTUmo2TIckDxIQcTx1CPEO0/edit#gid=0"
    >
      Google Sheet lifting log
    </a>{" "}
    into powerful, visual insights for barbell training.
  </h2>
);

function GoogleSignInButton() {
  const { data: session, status: authStatus } = useSession();

  if (authStatus !== "authenticated")
    return (
      <Button variant="outline" onClick={() => signIn("google")}>
        Start Your Strength Journey — Free Google Sign-in
      </Button>
    );
}

const IMAGE_FADE_DURATION = 500; // ms
const IMAGE_PAUSE_DURATION = 2800; // ms
const CAPTION_FADE_DELAY = 400;
const CAPTION_FADE_DURATION = 400;
const CAPTION_ON_PERCENT = 0.2; //
const CAPTION_OFF_PERCENT = 0.8; //

const images = [
  {
    src: "/spreadsheet.png",
    alt: "Spreadsheet example",
    caption: "📊 Raw data",
  },
  {
    src: "/app1.png",
    alt: "App Screenshot A",
    caption: "📈 Beautiful insights",
  },
  {
    src: "/spreadsheet.png",
    alt: "Spreadsheet example",
    caption: "📊 Own your data forever",
  },
  {
    src: "/app2.png",
    alt: "App Screenshot B",
    caption: "Instant feedback on progress ",
  },
  {
    src: "/spreadsheet.png",
    alt: "Spreadsheet example",
    caption: "No subscriptions. Ever.",
  },
  {
    src: "/app3.png",
    alt: "App Screenshot C",
    caption: "Lift. Track. Repeat. ",
  },
];

export default function SpreadsheetShowcase() {
  const [index, setIndex] = useState(0);
  const [fade, setFade] = useState(true);
  const [captionVisible, setCaptionVisible] = useState(true);

  useEffect(() => {
    if (fade) {
      // When the image is fully visible, set up timers for caption
      const captionIn = setTimeout(
        () => setCaptionVisible(true),
        IMAGE_PAUSE_DURATION * CAPTION_ON_PERCENT,
      );
      const captionOut = setTimeout(
        () => setCaptionVisible(false),
        IMAGE_PAUSE_DURATION * CAPTION_OFF_PERCENT,
      );
      const imageOut = setTimeout(() => setFade(false), IMAGE_PAUSE_DURATION);
      return () => {
        clearTimeout(captionIn);
        clearTimeout(captionOut);
        clearTimeout(imageOut);
      };
    } else {
      // When fading out, run normal fade-out cycle
      const timeout = setTimeout(() => {
        setIndex((i) => (i + 1) % images.length);
        setFade(true);
      }, IMAGE_FADE_DURATION);
      return () => clearTimeout(timeout);
    }
  }, [fade, images.length]);

  return (
    <div className="flex justify-center md:py-8">
      <div className="relative aspect-video w-full max-w-2xl overflow-hidden rounded-3xl border-4 border-white bg-gradient-to-br from-gray-200 via-white to-gray-100 shadow-2xl">
        <Image
          src={images[index].src}
          alt={images[index].alt}
          fill
          sizes="(max-width: 900px) 100vw, 900px"
          className={`object-cover transition-all duration-[${IMAGE_FADE_DURATION}ms] ease-in-out ${fade ? "opacity-100 blur-0" : "opacity-0 blur-md"} `}
          priority
        />
        {/* Floating Label with new timing */}
        <div className="absolute bottom-2 left-1/2 z-10 -translate-x-1/2 md:bottom-4">
          <div
            className={`rounded-full border border-border bg-card px-6 py-3 shadow-lg transition-all duration-[${CAPTION_FADE_DURATION}ms] ease-in-out ${captionVisible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"} `}
          >
            <p className="text-xs font-semibold text-foreground md:text-sm">
              {images[index].caption}
            </p>
          </div>
        </div>
        <div className="pointer-events-none absolute inset-0 rounded-3xl ring-2 ring-white/60 ring-offset-2 ring-offset-gray-100" />
      </div>
    </div>
  );
}
