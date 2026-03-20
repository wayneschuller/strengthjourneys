import { useState, useEffect } from "react";
import Image from "next/image";
import { useSession } from "next-auth/react";
import { GoogleSignInButton } from "@/components/google-sign-in";
import { GOOGLE_SHEETS_ICON_URL } from "@/lib/google-sheets-icon";
import { openSheetSetupDialog } from "@/lib/open-sheet-setup";
import { useUserLiftingData } from "@/hooks/use-userlift-data";
import { SloganCarousel } from "./slogan-carousel";
import { Button } from "./ui/button";
import { motion, AnimatePresence } from "motion/react";

/**
 * Landing page hero section. Renders the slogan carousel, headline, Google sign-in
 * button, and the animated spreadsheet/app screenshot showcase side by side.
 *
 * @param {Object} props - No props.
 */
export function HeroSection() {
  return (
    <div>
      <div className="mb-8 flex flex-row justify-center">
        <SloganCarousel />
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div>
          <p className="mt-4 text-center text-2xl font-bold tracking-tight md:text-3xl lg:text-left">
            Welcome to Strength Journeys
          </p>
          <h1 className="mb-4 mt-2 text-balance text-center text-3xl font-extrabold leading-tight tracking-tight md:mb-8 lg:text-left lg:text-4xl xl:text-5xl">
            Free barbell lifting analysis tools that turn your Google Sheet
            into powerful, visual insights.
          </h1>
          <PageDescription />
          <HeroPrimaryCta />
        </div>
        <SpreadsheetShowcase />
      </div>
    </div>
  );
}

// Internal helper: paragraph describing the app's core value proposition with links.
const PageDescription = () => (
  <></>
);

// Internal helper: prominent hero CTA for unauthenticated visitors and
// authenticated demo-mode users who still need to set up a sheet.
function HeroPrimaryCta() {
  const { status: authStatus } = useSession();
  const { sheetInfo } = useUserLiftingData();

  if (authStatus === "authenticated" && sheetInfo?.ssid) return null;

  return (
    <div className="flex flex-col items-center gap-2 md:items-start">
      {authStatus === "authenticated" ? (
        <Button
          className="w-2/3 hover:ring-2"
          onClick={() => {
            openSheetSetupDialog("bootstrap");
          }}
        >
          <img
            src={GOOGLE_SHEETS_ICON_URL}
            alt=""
            className="h-5 w-5 shrink-0"
            aria-hidden
          />
          <div className="hidden md:block">Set Up Your Free Lifting Log</div>
          <div className="md:hidden">Set up your log</div>
        </Button>
      ) : (
        <GoogleSignInButton
          className="w-2/3 hover:ring-2"
          cta="hero"
        >
          <div className="hidden md:block">
            Start Your Strength Journey — Free Google Sign-in
          </div>
          <div className="md:hidden">Free Google Sign-in</div>
        </GoogleSignInButton>
      )}
      <p className="mt-2 text-xs italic text-slate-500">
        We never copy or store your data.
      </p>
    </div>
  );
}

const SLIDE_DURATION = 4000; // ms per slide

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
    caption: "Instant feedback on progress",
  },
  {
    src: "/spreadsheet.png",
    alt: "Spreadsheet example",
    caption: "No subscriptions. Ever.",
  },
  {
    src: "/app3.png",
    alt: "App Screenshot C",
    caption: "Lift. Track. Repeat.",
  },
];

/**
 * Animated slideshow cycling through spreadsheet and app screenshot images with
 * a fade/scale transition and a floating caption overlay.
 *
 * @param {Object} props - No props.
 */
export default function SpreadsheetShowcase() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setIndex((i) => (i + 1) % images.length);
    }, SLIDE_DURATION);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="flex justify-center md:py-8">
      <div className="relative aspect-video w-full max-w-2xl overflow-hidden rounded-2xl">
        <AnimatePresence mode="wait">
          <motion.div
            key={index}
            initial={{ opacity: 0, scale: 1.05 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.6, ease: "easeInOut" }}
            className="absolute inset-0"
          >
            <Image
              src={images[index].src}
              alt={images[index].alt}
              fill
              sizes="(max-width: 900px) 100vw, 900px"
              className="object-cover"
              priority
            />
          </motion.div>
        </AnimatePresence>
        <div className="absolute bottom-2 left-1/2 z-10 -translate-x-1/2 md:bottom-4">
          <AnimatePresence mode="wait">
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{
                duration: 0.4,
                delay: 0.3,
                ease: "easeOut",
              }}
              className="rounded-full border border-border bg-card px-6 py-3 shadow-lg"
            >
              <p className="text-xs font-semibold text-foreground md:text-sm">
                {images[index].caption}
              </p>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
