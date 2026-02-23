import { useState, useEffect } from "react";
import Image from "next/image";
import { useRouter } from "next/router";
import { useSession, signIn } from "next-auth/react";
import { gaTrackSignInClick } from "@/lib/analytics";
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
            Free barbell lifting analysis tools that turn your Google Sheet into
            powerful, visual insights.
          </h1>
          <GoogleSignInButton />
        </div>
        <SpreadsheetShowcase />
      </div>
    </div>
  );
}

// Internal helper: paragraph describing the app's core value proposition with links.
const PageDescription = () => (
  <p className="mb-10 mt-2 text-center text-xl tracking-tight md:text-left md:text-2xl lg:w-4/5">
    Track PRs, visualize E1RM progress, and analyze your strength — all from a
    simple{" "}
    <a
      className="text-blue-600 underline visited:text-purple-600 hover:text-blue-800"
      target="_blank"
      href="https://docs.google.com/spreadsheets/d/14J9z9iJBCeJksesf3MdmpTUmo2TIckDxIQcTx1CPEO0/edit#gid=0"
    >
      Google Sheet
    </a>
    .{" "}
    <a
      className="text-blue-600 underline visited:text-purple-600 hover:text-blue-800"
      target="_blank"
      href="https://github.com/wayneschuller/strengthjourneys"
    >
      Free and open source
    </a>
    .
  </p>
);

// Internal helper: prominent Google sign-in button shown only to unauthenticated visitors.
function GoogleSignInButton() {
  const router = useRouter();
  const { data: session, status: authStatus } = useSession();

  if (authStatus !== "authenticated")
    return (
      <div className="flex flex-col items-center gap-2 md:items-start">
        <Button
          className="w-2/3 hover:ring-2"
          onClick={() => {
            gaTrackSignInClick(router.pathname);
            signIn("google");
          }}
        >
          <GoogleLogo />
          <div className="hidden md:block">Start Your Strength Journey —</div>
          Free Google Sign-in
        </Button>
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

        {/* Floating caption */}
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

/**
 * Inline SVG rendering of the Google "G" logo in its official four-color form.
 *
 * @param {Object} props
 * @param {number} [props.size] - Width and height in pixels (default 20).
 * @param {string} [props.className] - Additional CSS classes for the svg element.
 */
export function GoogleLogo({ size = 20, className = "" }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 48 48"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.69 1.22 9.18 3.61l6.83-6.83C35.46 2.45 30.12 0 24 0 14.62 0 6.5 5.48 2.56 13.41l7.96 6.18C12.14 13.38 17.58 9.5 24 9.5z"
      />
      <path
        fill="#34A853"
        d="M46.13 24.5c0-1.57-.14-3.08-.4-4.5H24v9h12.65c-.55 2.96-2.23 5.47-4.72 7.18l7.36 5.72C43.98 37.54 46.13 31.43 46.13 24.5z"
      />
      <path
        fill="#4A90E2"
        d="M9.52 28.59c-1.09-3.23-1.09-6.95 0-10.18L1.56 12.23C-1.7 18.18-1.7 25.82 1.56 31.77l7.96-3.18z"
      />
      <path
        fill="#FBBC05"
        d="M24 48c6.12 0 11.46-2.02 15.28-5.5l-7.36-5.72c-2.05 1.39-4.65 2.22-7.92 2.22-6.42 0-11.86-3.88-14.48-9.09l-7.96 3.18C6.5 42.52 14.62 48 24 48z"
      />
    </svg>
  );
}
