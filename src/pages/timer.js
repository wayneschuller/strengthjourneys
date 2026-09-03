/** @format */
// pages/timer.js
//
// The gym timer page: a giant clock built to be read from arm's length while
// standing at a rack. It always counts forward, with an optional repeating ping
// that nudges the lifter without ever telling them their rest is over.
// Layout intent: the clock takes every pixel it can get, and everything else is
// a single control deck underneath it. On a phone that deck stacks; on a desktop
// it runs transport buttons on the left and ping tools on the right, so the
// whole timer sits inside one screen with nothing to scroll past.
//
// Everything about the timing itself (wall-clock accuracy, screen wake lock, the
// ping) lives in the shared TimerProvider so the nav bar MiniTimer keeps
// counting when a lifter navigates away mid-set.

import React, { useCallback, useEffect, useRef } from "react";

import {
  Pause,
  Play,
  RotateCcw,
  TimerReset,
  Volume2,
  VolumeX,
} from "lucide-react";
import { NextSeo } from "next-seo";
import { useTheme } from "next-themes";

import { RelatedArticles } from "@/components/article-cards";
import { PageContainer } from "@/components/page-header";
import { TimerDigits } from "@/components/timer-digits";
import { TimerPingHistory } from "@/components/timer-ping-history";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatAlarmLabel, formatTime, useTimer } from "@/hooks/use-timer";
import { fetchRelatedArticles } from "@/lib/sanity-io.js";
import { cn } from "@/lib/utils";

const PAGE_TITLE = "Gym Timer | Strength Journeys";

// A repeating ping rather than a one-shot alarm: a lifter who misses one still
// gets the next, and the numbers match how rest between working sets actually
// runs. The clock never stops at any of them.
const PING_INTERVALS = [
  { label: "Off", shortLabel: "Off", seconds: 0 },
  { label: "2 min", shortLabel: "2m", seconds: 120 },
  { label: "3 min", shortLabel: "3m", seconds: 180 },
  { label: "5 min", shortLabel: "5m", seconds: 300 },
  { label: "7 min", shortLabel: "7m", seconds: 420 },
  { label: "10 min", shortLabel: "10m", seconds: 600 },
];

export async function getStaticProps() {
  const RELATED_ARTICLES_CATEGORY = "Gym Timer";
  const relatedArticles = await fetchRelatedArticles(RELATED_ARTICLES_CATEGORY);

  return {
    props: {
      relatedArticles,
    },
    revalidate: 60 * 60,
  };
}

/**
 * Lifting Set Timer page. Renders SEO metadata and a full-screen countdown/stopwatch timer
 * suitable for use at the gym on phones or large displays.
 * @param {Object} props
 * @param {Array} props.relatedArticles - CMS articles related to the Gym Timer topic, fetched via ISR.
 */
export default function Timer({ relatedArticles }) {
  // OG Meta Tags
  const canonicalURL = "https://www.strengthjourneys.xyz/timer";
  const title = PAGE_TITLE;
  const ogImageURL =
    "https://www.strengthjourneys.xyz/strength_journeys_timer_og.png";
  const description =
    "World's greatest gym timer app. Perfect for tracking lifting sets, rest periods, and overall workout duration. Hulk lift big. Hulk smash timer space bar.";
  const keywords =
    "gym timer, workout timer, lifting set timer, rest period tracker, strength training app, fitness timer, exercise timer, workout management, interval timer, weight lifting timer, strength journeys, fitness app";

  return (
    <PageContainer>
      <NextSeo
        title={title}
        description={description}
        canonical={canonicalURL}
        openGraph={{
          url: canonicalURL,
          title: title,
          description: description,
          type: "website",
          images: [
            {
              url: ogImageURL,
              alt: "Strength Journeys Lifting Set Timer",
            },
          ],
          site_name: "Strength Journeys",
        }}
        twitter={{
          handle: "@wayneschuller",
          site: "@wayneschuller",
          cardType: "summary_large_image",
        }}
        additionalMetaTags={[
          {
            name: "keywords",
            content: keywords,
          },
        ]}
      />

      <section className="flex flex-col items-center">
        {/* The clock itself is the desktop headline, so the h1 goes screen-reader
            only above md rather than disappearing from the page entirely. */}
        <h1 className="mb-5 scroll-m-20 text-center text-4xl font-extrabold tracking-tight md:sr-only lg:text-5xl">
          Lifting Set Timer
        </h1>
        <LargeTimer />
        <RelatedArticles articles={relatedArticles} />
      </section>
    </PageContainer>
  );
}

/**
 * The timer itself: a clock sized to fill its card, a progress line running to
 * the next ping, and a control deck of transport buttons and ping tools. Starts
 * counting on mount and supports spacebar restart via a keyboard listener.
 */
function LargeTimer() {
  const {
    time,
    isRunning,
    pingIntervalSeconds,
    pingCount,
    activePingSeconds,
    nudgeSeed,
    isMuted,
    setIsMuted,
    setPingInterval,
    ensureRunning,
    handleStartStop,
    handleReset,
    handleRestart,
  } = useTimer();

  const wrapperRef = useRef(null);
  const readoutRef = useRef(null);
  // Each theme brings its own font, and the digit slots are sized in ch units,
  // so a theme change resizes the clock underneath us.
  const { resolvedTheme } = useTheme();
  const display = formatTime(time);
  const isAlerting = activePingSeconds !== null;
  const hasPingHistory = pingCount > 0;

  // How far the clock has travelled between the last ping and the next one.
  const pingProgress =
    pingIntervalSeconds > 0
      ? ((time % pingIntervalSeconds) / pingIntervalSeconds) * 100
      : 0;

  useEffect(() => {
    // Start the timer on first mount of this page
    ensureRunning();
  }, [ensureRunning]); // It only needs to run on [] mount but eslint wants the dependency put in

  // Size the clock to fill the space it actually has. Digit widths vary by theme
  // font and by how many characters are showing, so we measure at a known size
  // and scale once rather than predicting a size per breakpoint. The height
  // budget is whatever the viewport has left once the control deck below has
  // taken its share, which is what keeps the whole timer on one screen.
  useEffect(() => {
    const node = readoutRef.current;
    const wrapper = wrapperRef.current;
    if (!node || !wrapper) return;

    // Our own font-size changes resize the very box we are watching, so the
    // observer below has to sit out a frame while we work.
    let isFitting = false;

    const fitToBox = () => {
      const inner = node.firstElementChild;
      if (!inner || isFitting) return;

      const availableWidth = node.clientWidth;
      if (!availableWidth) return;

      isFitting = true;

      // Measure everything with the clock at a known size, so the leftover space
      // below it can be worked out without the two chasing each other.
      node.style.fontSize = `${PROBE_FONT_PX}px`;

      const probeWidth = inner.getBoundingClientRect().width;
      const wrapperBox = wrapper.getBoundingClientRect();
      const readoutHeight = node.getBoundingClientRect().height;

      if (probeWidth) {
        const heightOfEverythingElse = wrapperBox.height - readoutHeight;
        const spaceBelowTheNav =
          window.innerHeight - (wrapperBox.top + window.scrollY);
        const heightLimit =
          spaceBelowTheNav - heightOfEverythingElse - CLOCK_BOTTOM_GUTTER_PX;
        // A whisker under the full width, because a display font's ink can sit
        // wider than the character box it is measured in.
        const widthLimit =
          (availableWidth / probeWidth) * PROBE_FONT_PX * CLOCK_WIDTH_SAFETY;

        const size = Math.min(widthLimit, heightLimit, CLOCK_MAX_PX);
        node.style.fontSize = `${Math.floor(Math.max(size, CLOCK_MIN_PX))}px`;
      }

      requestAnimationFrame(() => {
        isFitting = false;
      });
    };

    fitToBox();
    window.addEventListener("resize", fitToBox);

    // The clock's own box changing size is the one signal that catches every
    // cause at once: a theme swapping the font, a late font download, or the
    // browser zooming. Watching it beats trying to enumerate the triggers.
    const observer = new ResizeObserver(fitToBox);
    if (node.firstElementChild) observer.observe(node.firstElementChild);

    // Theme fonts land after first paint and change every digit width with them.
    document.fonts?.ready?.then(fitToBox).catch(() => {});
    document.fonts?.addEventListener?.("loadingdone", fitToBox);

    return () => {
      window.removeEventListener("resize", fitToBox);
      observer.disconnect();
      document.fonts?.removeEventListener?.("loadingdone", fitToBox);
    };
    // The ping tools change how much room is left, and a theme change brings a
    // new font with new digit widths, so a refit follows both.
  }, [display.length, pingIntervalSeconds, hasPingHistory, resolvedTheme]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.code !== "Space") return;

      // Space belongs to whatever the lifter is actually focused on: typing in a
      // field, or activating a button. We only claim it when it would otherwise
      // just scroll the page.
      const target = event.target;
      const tagName = target?.tagName;
      const isInteractiveTarget =
        target?.isContentEditable ||
        tagName === "INPUT" ||
        tagName === "TEXTAREA" ||
        tagName === "SELECT" ||
        tagName === "BUTTON" ||
        tagName === "A";

      if (isInteractiveTarget) return;

      // Prevent the default action to avoid scrolling the page
      event.preventDefault();
      handleRestart();
    };

    // Add event listener for 'keydown' on window
    window.addEventListener("keydown", handleKeyDown);

    // Cleanup function to remove the event listener
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleRestart]);

  // Put the live clock in the tab title so a lifter who switches tabs mid-set
  // can still see where they are up to.
  useEffect(() => {
    if (!isRunning) return;

    document.title = `${display} · Gym Timer`;

    return () => {
      document.title = PAGE_TITLE;
    };
  }, [display, isRunning]);

  const handleCardKeyDown = useCallback(
    (event) => {
      // Space is already handled globally above; Enter needs its own path so the
      // clock behaves like the button it looks like.
      if (event.key === "Enter") {
        event.preventDefault();
        handleRestart();
      }
    },
    [handleRestart],
  );

  return (
    <div
      ref={wrapperRef}
      className="flex w-full flex-col items-center gap-6 md:gap-6"
    >
      <Card
        className={cn(
          "focus-visible:ring-primary bg-muted w-full ring-4 transition-colors hover:cursor-pointer hover:ring-blue-900 focus-visible:outline-none",
          // Inverting the whole card is the only alert that reads the same in
          // every theme: primary and its foreground are guaranteed to contrast,
          // while a colour change on the digits alone disappears in the default
          // theme, where primary and foreground are both near black.
          isAlerting && "bg-primary ring-primary",
        )}
        role="button"
        tabIndex={0}
        aria-label="Restart the set timer"
        onClick={handleRestart}
        onKeyDown={handleCardKeyDown}
      >
        <CardContent className="p-4 md:p-5">
          <div
            ref={readoutRef}
            role="timer"
            aria-live="off"
            className={cn(
              // The vw/vh sizes are a first-paint approximation only. The fitter
              // above replaces them with a measured size a frame later.
              "flex w-full items-center justify-center text-[30vw] leading-none font-bold tabular-nums md:text-[26vh]",
              isAlerting && "text-primary-foreground",
            )}
          >
            <TimerDigits value={display} />
          </div>

          {pingIntervalSeconds > 0 && (
            <div
              className={cn(
                "mt-3 h-1.5 w-full overflow-hidden rounded-full",
                isAlerting ? "bg-primary-foreground/25" : "bg-foreground/10",
              )}
            >
              {/* Runs to the next ping, then starts over. The one second
                  transition matches the tick, so it slides rather than jumps. */}
              <div
                className={cn(
                  "h-full rounded-full transition-[width] duration-1000 ease-linear",
                  // A chart token rather than primary, because that is where the
                  // themes keep their second colour: neo-brutalism's yellow,
                  // the default theme's teal.
                  isAlerting ? "bg-primary-foreground" : "bg-chart-2",
                )}
                style={{ width: `${pingProgress}%` }}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Announced when a ping lands. The clock stays silent for screen readers
          because reading out every second is unusable. */}
      <p className="sr-only" role="status" aria-live="assertive">
        {isAlerting ? `${formatAlarmLabel(activePingSeconds)} reached` : ""}
      </p>

      <div className="flex w-full flex-col items-center gap-6 md:flex-row md:justify-center md:gap-8">
        <div className="flex items-center gap-3">
          <Button
            className="h-14 rounded-full px-8 text-lg tracking-tight transition-transform active:scale-95 md:h-16 md:px-10 md:text-xl [&_svg]:size-5"
            onClick={handleRestart}
          >
            <RotateCcw />
            Restart
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-12 w-12 rounded-full transition-transform active:scale-95 [&_svg]:size-5"
            onClick={handleStartStop}
            title={isRunning ? "Stop the clock" : "Start the clock"}
          >
            {isRunning ? <Pause /> : <Play />}
            <span className="sr-only">
              {isRunning ? "Stop the clock" : "Start the clock"}
            </span>
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-12 w-12 rounded-full transition-transform active:scale-95 [&_svg]:size-5"
            onClick={handleReset}
            title="Reset to zero"
          >
            <TimerReset />
            <span className="sr-only">Reset to zero</span>
          </Button>
        </div>

        <div className="bg-border hidden h-16 w-px md:block" />

        <div className="flex w-full flex-col items-center gap-2 md:w-auto md:items-start">
          {/* On a phone the intervals become a full-width row of thumb-sized
              targets, because this is a control people press with chalk on
              their hands. On a desktop they collapse back to inline pills. */}
          <div className="flex w-full flex-col items-center gap-2 md:w-auto md:flex-row md:gap-3">
            <div className="flex items-center gap-1">
              <span className="text-muted-foreground text-sm">Ping every</span>
              {pingIntervalSeconds > 0 && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-full"
                  onClick={() => setIsMuted(!isMuted)}
                  title={
                    isMuted
                      ? "Turn the ping sound on"
                      : "Turn the ping sound off"
                  }
                >
                  {isMuted ? <VolumeX /> : <Volume2 />}
                  <span className="sr-only">
                    {isMuted
                      ? "Turn the ping sound on"
                      : "Turn the ping sound off"}
                  </span>
                </Button>
              )}
            </div>

            <div className="grid w-full grid-cols-6 gap-1.5 md:flex md:w-auto md:items-center">
              {PING_INTERVALS.map((interval) => {
                const isChosen = pingIntervalSeconds === interval.seconds;

                return (
                  <Button
                    key={interval.seconds}
                    variant={isChosen ? "default" : "outline"}
                    size="sm"
                    aria-pressed={isChosen}
                    className="h-11 w-full rounded-full px-1 tabular-nums md:h-9 md:w-auto md:px-3"
                    onClick={() => setPingInterval(interval.seconds)}
                  >
                    <span className="md:hidden">{interval.shortLabel}</span>
                    <span className="hidden md:inline">{interval.label}</span>
                  </Button>
                );
              })}
            </div>
          </div>

          <TimerPingHistory
            pingIntervalSeconds={pingIntervalSeconds}
            pingCount={pingCount}
            seed={nudgeSeed}
            isAlerting={isAlerting}
          />
        </div>
      </div>

      <p className="text-muted-foreground text-center text-sm">
        <span className="md:hidden">Tap the clock to restart your set.</span>
        <span className="hidden md:inline">
          Press the space bar or click the clock to restart your set.
        </span>
      </p>
    </div>
  );
}

// Measuring at a known font size and scaling once beats guessing, and 100px is
// large enough that rounding in the measurement does not matter.
const PROBE_FONT_PX = 100;

// A little air under the clock so it never sits flush against the fold.
const CLOCK_BOTTOM_GUTTER_PX = 16;

// Display fonts paint ink outside the character box they are measured in, so
// the clock stops a whisker short of the full width.
const CLOCK_WIDTH_SAFETY = 0.97;

// Bounds of sanity: big enough to read across a gym, never so big that a short
// window renders a single unreadable digit.
const CLOCK_MAX_PX = 640;
const CLOCK_MIN_PX = 48;
