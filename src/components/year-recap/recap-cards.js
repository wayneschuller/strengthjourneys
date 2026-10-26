// The Strength Unwrapped deck, in running order.
//
// Kept out of the carousel so the deck can be described in one place — the
// running order is content, not carousel plumbing, and the share code needs the
// card ids to name exported files.
//
// `label` is not rendered on the card itself; it is there for accessible names
// wherever a card has to be referred to outside its own slide. `accent` picks
// the two theme chart colours that glow behind the card, so the deck changes
// colour as it plays, the way a Wrapped story does, in every theme.

import { TitleCard } from "@/components/year-recap/cards/title-card";
import { SessionsCard } from "@/components/year-recap/cards/sessions-card";
import { TrainingCalendarCard } from "@/components/year-recap/cards/training-calendar-card";
import { TonnageCard } from "@/components/year-recap/cards/tonnage-card";
import { MostTrainedLiftCard } from "@/components/year-recap/cards/most-trained-lift-card";
import { StrengthGainsCard } from "@/components/year-recap/cards/strength-gains-card";
import { LifetimePRsCard } from "@/components/year-recap/cards/lifetime-prs-card";
import { NotableLiftsCard } from "@/components/year-recap/cards/notable-lifts-card";
import { LifterTypeCard } from "@/components/year-recap/cards/lifter-type-card";
import { SummaryCard } from "@/components/year-recap/cards/summary-card";
import { ClosingCard } from "@/components/year-recap/cards/closing-card";

export const RECAP_CARDS = [
  { id: "title", label: "Title", accent: [4, 1], Component: TitleCard },
  {
    id: "sessions",
    label: "Sessions",
    accent: [1, 2],
    Component: SessionsCard,
  },
  {
    id: "calendar",
    label: "Training calendar",
    accent: [3, 5],
    Component: TrainingCalendarCard,
  },
  { id: "tonnage", label: "Tonnage", accent: [3, 4], Component: TonnageCard },
  {
    id: "most-trained",
    label: "Most trained lift",
    accent: [1, 5],
    Component: MostTrainedLiftCard,
  },
  {
    id: "strength-gains",
    label: "Strength gains",
    accent: [2, 3],
    Component: StrengthGainsCard,
  },
  {
    id: "lifetime-prs",
    label: "Lifetime PRs",
    accent: [1, 4],
    Component: LifetimePRsCard,
  },
  {
    id: "notable-lifts",
    label: "Notable lifts",
    accent: [5, 2],
    Component: NotableLiftsCard,
  },
  {
    id: "lifter-type",
    label: "Lifter type",
    accent: [1, 3],
    Component: LifterTypeCard,
  },
  { id: "summary", label: "Your year", accent: [4, 2], Component: SummaryCard },
  { id: "closing", label: "Closing", accent: [2, 5], Component: ClosingCard },
];
