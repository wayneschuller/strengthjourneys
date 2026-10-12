/**
 * The app's main tools, one entry each, as the mobile nav lists them.
 * It lives on its own, away from any page, so that a menu on every route can
 * import it without bundling a page along with it.
 */

import {
  Calculator,
  Timer,
  LineChart,
  Layers,
  BicepsFlexed,
  Music,
  LibraryBig,
  Bot,
  Anvil,
  Bus,
  Flame,
  Sparkles,
  CircleDashed,
  Plus,
  Mountain,
  Upload,
  Disc,
} from "lucide-react";

import { GorillaIcon } from "@/components/gorilla-icon";

// The feature pages are the main tools, with one card each on the landing page
export const featurePages = [
  {
    href: "/log",
    title: "Log & Session Browser",
    description:
      "Log your lifting session or browse past workouts in detail with strength tracking and warm-up suggestions.",
    IconComponent: Plus,
    pill: { kind: "updated", date: "2026-09-28" },
  },
  {
    href: "/calculator",
    title: "One Rep Max Calculator",
    description: "The greatest e1rm multi-formula one rep max calculations.",
    IconComponent: Calculator,
  },
  {
    href: "/how-strong-am-i",
    title: "How Strong Am I?",
    description:
      "See your percentile rank across four groups, from the general population to powerlifting culture.",
    IconComponent: CircleDashed,
    pill: { kind: "updated", date: "2026-09-17" },
  },
  {
    href: "/1000lb-club-calculator",
    title: "1000lb Club Calculator",
    description:
      "Are you in the 1000lb club? Track your progress to this milestone.",
    IconComponent: Anvil,
  },
  {
    href: "/strength-levels",
    title: "Strength Levels",
    description:
      "Check beginner, intermediate, advanced, and elite benchmarks for squat, bench press, deadlift, and strict press.",
    IconComponent: BicepsFlexed,
  },
  {
    href: "/lift-explorer",
    title: "Lift Explorer",
    description:
      "Explore your lifting history lift by lift. PRs across every rep range, your journey, and training frequency.",
    IconComponent: Layers,
    pill: { kind: "updated", date: "2026-09-14" },
  },
  {
    href: "/warm-up-sets-calculator",
    title: "Warm Ups Calculator",
    description:
      "Generate warmup sets for your barbell workouts using progressive warmup methodology.",
    IconComponent: Flame,
  },
  {
    href: "/200-300-400-500-strength-club-calculator",
    title: "200/300/400/500 Strength Club",
    description:
      "Track your progress toward the classic barbell milestones: 200 press, 300 bench, 400 squat, 500 deadlift.",
    IconComponent: Mountain,
  },
  {
    href: "/plate-milestones",
    title: "Plate Milestones",
    description:
      "How many plates can you lift? Track your 1/2/3/4 plate club progress. Plates get dates.",
    IconComponent: Disc,
  },
  {
    href: "/articles",
    title: "Strength Articles Library",
    description:
      "A collection of our articles, common questions, plus curated lifting content.",
    IconComponent: LibraryBig,
    pill: { kind: "updated", date: "2026-09-26" },
  },
  {
    href: "/ai-lifting-assistant",
    title: "AI Lifting Assistant",
    description:
      "A strength expert chatbot. Talk to your lifting data. A coach who loves you.",
    IconComponent: Bot,
    pill: { kind: "updated", date: "2026-09-26" },
  },
  {
    href: "/visualizer",
    title: "Strength Visualizer",
    description:
      "Chart lifts beyond the Big Four with full-range E1RM history over time.",
    IconComponent: LineChart,
  },
  {
    href: "/strength-year-in-review",
    title: "Strength Unwrapped - Yearly Recap",
    description:
      "Your year of strength training in a Spotify Wrapped-style recap. Sessions, tonnage, PRs, and more.",
    IconComponent: Sparkles,
  },
  {
    href: "/import",
    title: "Import / Export Data",
    description:
      "Import from any supported app or spreadsheet, merge everything into your own Sheet, or export it whenever you like.",
    IconComponent: Upload,
  },
  {
    href: "/tonnage",
    title: "Tonnage Metrics",
    description:
      "Ever wondered how many buses you've lifted? Your lifting volume, visualized.",
    IconComponent: Bus,
  },
  {
    href: "/timer",
    title: "Lifting Set Timer",
    description: "A set timer for phones or large gym screens.",
    IconComponent: Timer,
  },
  {
    href: "/how-strong-is-a-gorilla",
    title: "How Strong Is a Gorilla?",
    description:
      "Compare your bench press to a silverback. Find out how badly you'd lose.",
    IconComponent: GorillaIcon,
  },
  {
    href: "/gym-playlist-leaderboard",
    title: "Gym Music Leaderboard",
    description: "Discover and share new motivational music playlists.",
    IconComponent: Music,
  },
];
