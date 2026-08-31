// The Strength Unwrapped deck, in running order.
//
// Shared by the story carousel and the desktop contact sheet so the two views
// can never drift out of sync — the grid index is also the carousel index, which
// is what lets a click on a grid tile open that exact slide in the story.
//
// `label` is not rendered on the card itself; it exists for accessible names on
// the contact-sheet tiles, where all eight cards are on screen at once.

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

// Source dimensions of one story card. The carousel renders at this width and
// the contact sheet renders at this width then scales the whole card down, so
// typography and spacing stay identical between the two views.
export const RECAP_CARD_WIDTH = 360;
export const RECAP_CARD_HEIGHT = (RECAP_CARD_WIDTH * 16) / 9;
