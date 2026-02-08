/** @format */

/**
 * Pick a quirky phrase from an array, persisting the choice in ref to avoid re-randomizing on re-render.
 * @param {string[]} phrases - Array of phrase options
 * @param {React.MutableRefObject<Object>} ref - useRef to persist choice
 * @param {string} key - Unique key for this card/context
 * @returns {string}
 */
export function pickQuirkyPhrase(phrases, ref, key) {
  if (!phrases || phrases.length === 0) return "";
  if (ref.current && ref.current[key] !== undefined) {
    return ref.current[key];
  }
  const chosen = phrases[Math.floor(Math.random() * phrases.length)];
  if (!ref.current) ref.current = {};
  ref.current[key] = chosen;
  return chosen;
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

export const SEASONAL_PHRASES = [
  "March was your month",
  "Summer grind paid off",
  "Winter warrior",
  "April showers, April gains",
  "Peak season",
  "That month hit different",
  "You owned that month",
  "Busiest month of the year",
  "When the iron called, you answered",
  "Peak performance",
  "That's when the magic happened",
  "Your strongest month",
  "The grind was real",
  "No slacking that month",
  "Peak lifting season",
  "You showed up big time",
  "That month defined your year",
  "Consistency king/queen",
  "The month you locked in",
  "Nothing could stop you",
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
