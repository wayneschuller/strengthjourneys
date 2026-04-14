/** @format */

import { useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion, useScroll, useTransform } from "motion/react";

const features = [
  {
    title: "Your Training Dashboard",
    description:
      "Streaks, weekly coaching, and monthly highlights. Everything you need to see before your next session.",
    image: "/showcase-dashboard.png",
    href: null, // dashboard is the home page when logged in
  },
  {
    title: "Track Every PR Across Every Rep Range",
    description:
      "Explore your lifting history lift by lift. See personal records, training frequency, and your entire journey.",
    image: "/showcase-lift-explorer.png",
    href: "/lift-explorer",
  },
  {
    title: "Find Out Where You Stand",
    description:
      "See your percentile rank among lifters, from the general population to competitive powerlifters.",
    image: "/showcase-how-strong.png",
    href: "/how-strong-am-i",
  },
  {
    title: "Your Year of Iron, Unwrapped",
    description:
      "Sessions, tonnage, PRs, consistency streaks, and training milestones in a Spotify Wrapped-style recap.",
    image: "/showcase-unwrapped.png",
    href: "/strength-year-in-review",
  },
];

/**
 * Scroll-driven feature showcase for the landing page. The left column stays
 * sticky with the headline and CTA while the right column scrolls through
 * feature panels with motion animations.
 */
export function FeatureShowcase() {
  const containerRef = useRef(null);

  return (
    <div ref={containerRef} className="relative my-16">
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 lg:gap-16">
        {/* Left column: sticky headline */}
        <div className="lg:sticky lg:top-24 lg:self-start">
          <p className="text-primary mb-2 text-sm font-semibold tracking-wide uppercase">
            What you get
          </p>
          <h2 className="text-3xl font-extrabold tracking-tight lg:text-4xl">
            Powerful, visual insights from your lifting data.
          </h2>
          <p className="text-muted-foreground mt-4 text-lg">
            Connect your Google Sheet or import from another app. Your training
            transforms into dashboards, charts, and milestones instantly.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/import"
              className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center justify-center rounded-md px-6 py-3 text-sm font-medium transition-colors"
            >
              Try with your data
            </Link>
            <Link
              href="/lift-explorer"
              className="border-input bg-background hover:bg-accent hover:text-accent-foreground inline-flex items-center justify-center rounded-md border px-6 py-3 text-sm font-medium transition-colors"
            >
              Explore demo
            </Link>
          </div>
        </div>

        {/* Right column: scrolling feature panels */}
        <div className="flex flex-col gap-12 lg:gap-20">
          {features.map((feature, index) => (
            <FeaturePanel key={feature.title} feature={feature} index={index} />
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Single feature panel with scroll-triggered entrance animation.
 * Shows a screenshot with a title and description overlay.
 */
function FeaturePanel({ feature, index }) {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "center center"],
  });

  const opacity = useTransform(scrollYProgress, [0, 0.5], [0, 1]);
  const y = useTransform(scrollYProgress, [0, 0.5], [60, 0]);
  const scale = useTransform(scrollYProgress, [0, 0.5], [0.95, 1]);

  const Wrapper = feature.href ? Link : "div";
  const wrapperProps = feature.href
    ? { href: feature.href, className: "group block" }
    : { className: "group block" };

  return (
    <motion.div ref={ref} style={{ opacity, y, scale }}>
      <Wrapper {...wrapperProps}>
        <div className="ring-border/50 overflow-hidden rounded-xl shadow-lg ring-1 transition-shadow group-hover:shadow-xl">
          <div className="bg-muted relative aspect-[16/10] w-full">
            <Image
              src={feature.image}
              alt={feature.title}
              fill
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="object-cover object-top"
            />
          </div>
          <div className="bg-card p-5">
            <h3 className="text-lg font-bold">{feature.title}</h3>
            <p className="text-muted-foreground mt-1 text-sm">
              {feature.description}
            </p>
          </div>
        </div>
      </Wrapper>
    </motion.div>
  );
}
