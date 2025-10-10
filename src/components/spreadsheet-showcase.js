"use client";
import { useState, useEffect } from "react";
import Image from "next/image";

const IMAGE_FADE_DURATION = 900; // ms
const IMAGE_PAUSE_DURATION = 1800; // ms

const images = [
  { src: "/spreadsheet.png", alt: "Spreadsheet example" },
  { src: "/app1.png", alt: "App Screenshot A" },
  { src: "/spreadsheet.png", alt: "Spreadsheet example" },
  { src: "/app2.png", alt: "App Screenshot B" },
  { src: "/spreadsheet.png", alt: "Spreadsheet example" },
  { src: "/app3.png", alt: "App Screenshot C" },
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
        <div className="pointer-events-none absolute inset-0 rounded-3xl ring-4 ring-white/60 ring-offset-2 ring-offset-gray-100" />
      </div>
    </div>
  );
}
