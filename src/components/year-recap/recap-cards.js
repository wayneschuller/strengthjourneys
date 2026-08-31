// The Strength Unwrapped deck, in running order.
//
// Kept out of the carousel so the deck can be described in one place — the
// running order is content, not carousel plumbing, and the share code needs the
// card ids to name exported files.
//
// `label` is not rendered on the card itself; it is there for accessible names
// wherever a card has to be referred to outside its own slide.

import { TitleCard } from "@/components/year-recap/cards/title-card";
import { SessionsCard } from "@/components/year-recap/cards/sessions-card";
import { TonnageCard } from "@/components/year-recap/cards/tonnage-card";
import { MostTrainedLiftCard } from "@/components/year-recap/cards/most-trained-lift-card";
import { LifetimePRsCard } from "@/components/year-recap/cards/lifetime-prs-card";
import { NotableLiftsCard } from "@/components/year-recap/cards/notable-lifts-card";
import { SeasonalPatternCard } from "@/components/year-recap/cards/seasonal-pattern-card";
import { ClosingCard } from "@/components/year-recap/cards/closing-card";

export const RECAP_CARDS = [
  { id: "title", label: "Title", Component: TitleCard },
  { id: "sessions", label: "Sessions", Component: SessionsCard },
  { id: "tonnage", label: "Tonnage", Component: TonnageCard },
  { id: "most-trained", label: "Most trained lift", Component: MostTrainedLiftCard },
  { id: "lifetime-prs", label: "Lifetime PRs", Component: LifetimePRsCard },
  { id: "notable-lifts", label: "Notable lifts", Component: NotableLiftsCard },
  { id: "seasonal", label: "Seasonal pattern", Component: SeasonalPatternCard },
  { id: "closing", label: "Closing", Component: ClosingCard },
];
