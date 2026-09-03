/** @format */
// pages/timer.js
//
// The gym timer page: a giant clock built to be read from arm's length while
// standing at a rack. It always counts forward, with optional alarm points a
// lifter can arm for a ping and a visual alert on the way past. Everything about
// the timing itself (wall-clock accuracy, screen wake lock, the ping) lives in
// the shared TimerProvider so the nav bar MiniTimer keeps counting when a lifter
// navigates away mid-set.

import React, { useCallback, useEffect, useRef } from "react";

import { Volume2, VolumeX } from "lucide-react";
import { NextSeo } from "next-seo";

import { RelatedArticles } from "@/components/article-cards";
import { PageContainer } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatAlarmLabel, formatTime, useTimer } from "@/hooks/use-timer";
import { fetchRelatedArticles } from "@/lib/sanity-io.js";
import { cn } from "@/lib/utils";

const PAGE_TITLE = "Gym Timer | Strength Journeys";

// Optional alarm points. The clock never stops at one of these: it pings, shows
// the alert, and keeps counting, because how long a lifter needs between sets is
// a decision for the lifter rather than for the timer.
const ALARM_PRESETS = [
  { label: "0:45", seconds: 45 },
  { label: "1:00", seconds: 60 },
  { label: "1:30", seconds: 90 },
  { label: "2:00", seconds: 120 },
  { label: "3:00", seconds: 180 },
  { label: "5:00", seconds: 300 },
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
        <h1 className="scroll-m-20 text-center text-4xl font-extrabold tracking-tight md:sr-only lg:text-5xl">
          Lifting Set Timer
        </h1>
        <LargeTimer />
        <RelatedArticles articles={relatedArticles} />
      </section>
    </PageContainer>
  );
}

/**
 * Full-screen timer display with a giant forward-running clock, optional alarm
 * points and restart/start-stop/reset controls. Starts counting on mount and
 * supports spacebar restart via a keyboard listener.
 */
function LargeTimer() {
  const {
    time,
    isRunning,
    armedAlarms,
    activeAlarmSeconds,
    isMuted,
    setIsMuted,
    toggleAlarm,
    ensureRunning,
    handleStartStop,
    handleReset,
    handleRestart,
  } = useTimer();

  const readoutRef = useRef(null);
  const display = formatTime(time);
  const isAlerting = activeAlarmSeconds !== null;

  useEffect(() => {
    // Start the timer on first mount of this page
    ensureRunning();
  }, [ensureRunning]); // It only needs to run on [] mount but eslint wants the dependency put in

  // Digit widths vary by theme font, viewport and how many characters the clock
  // is showing, so rather than guessing a size per breakpoint we measure what the
  // readout wants and shrink it until it fits. The CSS sizes below stay the
  // ideal; this only ever scales down.
  useEffect(() => {
    const node = readoutRef.current;
    if (!node) return;

    const fitToWidth = () => {
      node.style.fontSize = ""; // Back to the CSS ideal before measuring
      const available = node.clientWidth;
      const wanted = node.scrollWidth;
      if (!available || !wanted || wanted <= available) return;

      const idealSize = parseFloat(window.getComputedStyle(node).fontSize);
      node.style.fontSize = `${Math.floor(idealSize * (available / wanted))}px`;
    };

    fitToWidth();
    window.addEventListener("resize", fitToWidth);

    // Theme fonts land after first paint and change every digit width with them.
    document.fonts?.ready?.then(fitToWidth).catch(() => {});

    return () => window.removeEventListener("resize", fitToWidth);
  }, [display.length]);

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
    <div className="flex w-full flex-col items-center">
      <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
        <span className="text-muted-foreground mr-1 text-sm">Ping me at</span>
        {ALARM_PRESETS.map((preset) => {
          const isArmed = armedAlarms.includes(preset.seconds);

          return (
            <Button
              key={preset.seconds}
              variant={isArmed ? "default" : "outline"}
              size="sm"
              aria-pressed={isArmed}
              className="tabular-nums"
              onClick={() => toggleAlarm(preset.seconds)}
            >
              {preset.label}
            </Button>
          );
        })}
        {armedAlarms.length > 0 && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsMuted(!isMuted)}
            title={
              isMuted ? "Turn the alarm ping on" : "Turn the alarm ping off"
            }
          >
            {isMuted ? <VolumeX /> : <Volume2 />}
            <span className="sr-only">
              {isMuted ? "Turn the alarm ping on" : "Turn the alarm ping off"}
            </span>
          </Button>
        )}
      </div>

      <Card
        className={cn(
          "bg-muted focus-visible:ring-primary my-6 w-full ring-4 transition-colors hover:cursor-pointer hover:ring-blue-900 focus-visible:outline-none md:my-5",
          // Inverting the whole card is the only alert that reads the same in
          // every theme: primary and its foreground are guaranteed to contrast,
          // while a colour change on the digits alone disappears in the default
          // theme, where primary and foreground are both near black.
          isAlerting && "bg-primary ring-primary animate-pulse",
        )}
        role="button"
        tabIndex={0}
        aria-label="Restart the set timer"
        onClick={handleRestart}
        onKeyDown={handleCardKeyDown}
      >
        <CardContent className="px-4 py-6">
          <div
            ref={readoutRef}
            role="timer"
            aria-live="off"
            className={cn(
              "w-full overflow-hidden text-center leading-none font-bold whitespace-nowrap tabular-nums",
              "text-8xl md:text-[11rem] lg:text-[15rem] xl:text-[19rem] 2xl:text-[22rem]",
              isAlerting && "text-primary-foreground",
            )}
          >
            {display}
          </div>
        </CardContent>
      </Card>

      {/* Doubles as the screen-reader announcement, so an alarm point reaches
          everyone the same way. Height is reserved to keep the page steady. */}
      <p
        className="text-primary min-h-6 text-center text-lg font-semibold"
        role="status"
        aria-live="assertive"
      >
        {isAlerting ? `${formatAlarmLabel(activeAlarmSeconds)} reached` : ""}
      </p>

      <Button
        className="my-2 text-xl tracking-tight hover:ring md:px-6 md:py-8 md:text-3xl lg:text-6xl xl:my-4 xl:px-10 xl:py-20 xl:text-9xl"
        onClick={handleRestart}
      >
        Restart
      </Button>
      <div className="mt-2 flex gap-2">
        <Button variant="secondary" onClick={handleStartStop}>
          {isRunning ? "Stop" : "Start"}
        </Button>
        <Button variant="destructive" onClick={handleReset}>
          Reset
        </Button>
      </div>
      <p className="text-muted-foreground mt-4 text-center text-sm md:hidden">
        Tap the clock to restart your set timer.
      </p>
      <p className="text-muted-foreground mt-4 hidden text-center text-sm md:block">
        Press the space bar or click the clock to restart your set timer.
      </p>
    </div>
  );
}
