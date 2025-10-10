"use client";
import { useState, useEffect } from "react";
import Image from "next/image";

const IMAGE_FADE_DURATION = 500; // ms
const IMAGE_PAUSE_DURATION = 2200; // ms

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
    caption: "No subscriptions",
  },
  {
    src: "/app3.png",
    alt: "App Screenshot C",
    caption: "Lift consistently to get strong ",
  },
];

export default function SpreadsheetShowcase() {
  const [index, setIndex] = useState(0);
  const [fade, setFade] = useState(true);

  useEffect(() => {
    const timeout = setTimeout(() => setFade(false), IMAGE_PAUSE_DURATION);
    return () => clearTimeout(timeout);
  }, [index]);

  useEffect(() => {
    if (!fade) {
      const timeout = setTimeout(() => {
        setFade(true);
        setIndex((i) => (i + 1) % images.length);
      }, IMAGE_FADE_DURATION);
      return () => clearTimeout(timeout);
    }
  }, [fade]);

  return (
    <div className="flex justify-center py-8">
      <div className="relative aspect-video w-full max-w-2xl overflow-hidden rounded-3xl border-4 border-white bg-gradient-to-br from-gray-200 via-white to-gray-100 shadow-2xl">
        <Image
          src={images[index].src}
          alt={images[index].alt}
          fill
          sizes="(max-width: 900px) 100vw, 900px"
          className={`object-cover transition-all duration-[${IMAGE_FADE_DURATION}] ease-in-out ${fade ? "opacity-100 blur-0" : "opacity-0 blur-md"} `}
          priority
        />
        {/* Floating caption */}
        <div className="pointer-events-none absolute bottom-6 left-1/2 max-w-[80%] -translate-x-1/2">
          <div
            className={`transition-all duration-[${IMAGE_FADE_DURATION}] rounded-full bg-white/80 px-5 py-2 text-lg font-semibold text-gray-900 shadow-lg ease-in-out ${fade ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"} `}
            style={{ backdropFilter: "blur(3px)" }}
          >
            {images[index].caption}
          </div>
        </div>
        <div className="pointer-events-none absolute inset-0 rounded-3xl ring-4 ring-white/60 ring-offset-2 ring-offset-gray-100" />
      </div>
    </div>
  );
}
