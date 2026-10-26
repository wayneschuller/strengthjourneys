/** @format */

// Phrases for the Strength Unwrapped cards.
//
// Picks are hashed rather than random. A random pick changed every time a card
// mounted, so the phrase on screen and the phrase in the saved image could
// disagree, and "save all cards" renders a second copy of the deck. Seeding by
// card, year and the size of the log keeps one lifter's deck stable while two
// lifters still read different lines.

/**
 * Pick a phrase deterministically from a set.
 * @param {string[]} phrases - Phrase options
 * @param {...(string|number)} seedParts - Anything that should change the pick
 * @returns {string}
 */
export function pickRecapPhrase(phrases, ...seedParts) {
  if (!phrases || phrases.length === 0) return "";
  const seed = seedParts.join("|");
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  return phrases[Math.abs(hash) % phrases.length];
}

export const SESSIONS_PHRASES = [
  "Actually showed up",
  "Did the thing",
  "Mission accomplished",
  "Zero regrets",
  "Future you approves",
  "Crushing it",
  "No excuses",
  "Living the dream",
  "Today's winner",
  "Checked off",
  "Done and dusted",
  "You did it",
  "On it",
  "Showed up",
  "Tick tick tick",
  "No procrastinating",
  "Adulting",
  "Today's hero",
  "Done the thing",
  "Keep showing up",
];

export const MOST_TRAINED_LIFT_LABELS = [
  "Most popular lift",
  "Favourite lift",
  "Your go-to lift",
  "Most trained lift",
  "Your signature lift",
  "Top of the list",
  "Your most beloved lift",
  "The one you kept coming back to",
  "Your number one lift",
  "Your ride-or-die lift",
];

export const MOST_TRAINED_LIFT_PHRASES = [
  "Your beloved",
  "Your ride or die",
  "The one you showed up for",
  "Your precious",
  "Can't get enough",
  "Your main squeeze",
  "The chosen one",
  "Your true love",
  "The one you love",
  "Top of the pile",
  "Your heart's desire",
  "Your pride and joy",
  "Can't stay away",
  "Your favourite",
  "The one you crave",
  "Your go-to",
  "Always gets first",
  "Your darling",
  "Your number one",
  "The one you show up for",
];

export const CONSISTENCY_PHRASES = [
  "Go have a beer.",
  "You've earned couch time.",
  "You're on track.",
  "Winner winner chicken dinner.",
  "Crushing it. Keep going.",
  "Consistency looks good on you.",
  "This is how PR streaks start.",
  "Text a friend and brag a little.",
  "You showed up. That matters most.",
  "Momentum is on your side.",
  "Future you is very grateful.",
  "Your streak graph would be proud.",
  "Log it, then relax. You did work.",
  "Tiny habits, big results.",
  "You vs. last week: you're winning.",
  "Banked another week. Nice.",
  "Coach brain: approved.",
  "Solid work. Sleep like an athlete.",
  "You did the hard part today.",
  "Bookmark this feeling.",
];

export const NOTABLE_LIFTS_PHRASES = [
  "More solid work",
  "Other peaks worth noting",
  "Still impressive",
  "Nice supporting cast",
  "The full picture",
  "More highlights",
  "Round out the year",
  "Other strong lifts",
  "More to celebrate",
  "The rest of the story",
];

/** Encouraging phrases when there are no lifetime PRs this year */
export const PR_EMPTY_PHRASES = [
  "Next year's PRs are waiting",
  "The bar is patient",
  "Building the foundation",
  "This is how comebacks start",
  "The iron never forgets",
  "Your next PR is out there",
  "Every rep counts",
  "Foundation year",
  "The journey continues",
  "Keep showing up",
  "Your future self will thank you",
  "One rep at a time",
  "The best is yet to come",
  "Patience and persistence",
  "Warming up for greatness",
];

/** Encouraging phrases when there are no notable lifts this year */
export const NOTABLE_LIFTS_EMPTY_PHRASES = [
  "More highlights incoming",
  "The full picture is forming",
  "Building blocks",
  "Story still unfolding",
  "More to come",
  "Every session adds up",
  "The grind continues",
  "Next year's highlights are brewing",
  "Keep stacking",
  "Foundation work",
  "Consistency is the real win",
  "The best chapters are ahead",
  "More to celebrate soon",
  "Your data is growing",
  "Stay the course",
];

export const PR_HIGHLIGHTS_PHRASES = [
  "Look at this champion",
  "Someone get this hero some beers",
  "Big kahuna energy",
  "Top banana (or other fruit)",
  "You truly are the savage",
  "The big cheese",
  "Bigshot over here",
  "The big wheel",
  "Top dog",
  "Boss status",
  "Professional mode",
  "Hero energy",
  "Winner vibes",
  "Champion material",
  "The victor",
  "Big wig",
  "Top of the heap",
  "Crushing it",
  "Living legend",
  "The main event",
];

// "{month}" is replaced with the busiest month's name.
export const SEASONAL_PHRASES = [
  "{month} was your month",
  "You owned {month}",
  "{month} hit different",
  "The month you locked in",
  "When the iron called, you answered",
  "Peak season",
  "{month} set the tone",
  "That's when the magic happened",
  "Nothing could stop you in {month}",
  "You showed up big time",
];

export const CLOSING_PHRASES = [
  "Here's to another year",
  "The journey continues",
  "Next year's PRs are waiting",
  "Keep showing up",
  "Onwards and upwards",
  "See you in the gym",
  "The best is yet to come",
  "Another year of gains ahead",
  "Keep the momentum going",
  "Your future self will thank you",
  "Stay strong",
  "One rep at a time",
  "The iron never lies",
  "Here's to more plates",
  "Until next year",
  "Keep lifting",
  "The bar is waiting",
  "More PRs incoming",
  "Stay consistent",
  "Cheers to the next chapter",
];

export const STRENGTH_GAINS_PHRASES = [
  "Stronger than last year you",
  "The work shows",
  "Every session paid in",
  "Proof it adds up",
  "Strength, banked",
  "The bar noticed",
  "Built, not bought",
  "Slow and heavy wins",
];

export const STRENGTH_BESTS_PHRASES = [
  "Your top sets this year",
  "The heaviest work you did",
  "Your strongest sets",
  "Where the year peaked",
  "The numbers you earned",
];

export const SUMMARY_PHRASES = [
  "A year well lifted",
  "One year, one card",
  "The whole year at a glance",
  "Your year in strength",
  "Every rep, summed up",
];
