# Changelog: February 6-8, 2026

## 🎉 Major Feature: Strength Unwrapped - Your Yearly Recap

**The big one!** We've launched **Strength Unwrapped** — a Spotify Wrapped-style yearly recap for your lifting journey. Unwrap your year in beautiful, swipeable, shareable cards that celebrate your strength training achievements.

### What's Inside:

- **Portrait cards** optimized for Instagram sharing — show off your gains!
- **Swipeable carousel** with smooth animations powered by Motion
- **8 recap cards** covering your entire year:
  - **Title Card**: Staggered word reveals, gradient year display, confetti fireworks 🎆
  - **Sessions Card**: Your workout count with circular grade badges and streak highlights
  - **Tonnage Card**: Total volume lifted with Big Four breakdown bar chart
  - **Most-Trained Lift**: Deep dive into your favorite exercise (sets, reps, gym sessions)
  - **Consistency Card**: Your training consistency grade
  - **PR Highlights**: Notable lifts and lifetime PRs split into separate cards
  - **Seasonal Pattern Card**: See when you trained most throughout the year
  - **Closing Card**: Encouraging wrap-up message
- **Year selector** to browse multiple years of data
- **Previous year comparison** on Sessions and Tonnage cards (shows in December for current year)
- **Demo mode** with sign-in prompts for unauthenticated users
- **Skeleton loaders** for smooth loading experience
- **Empty state phrases** that encourage and motivate

This is a **beta feature** — we're iterating based on your feedback. Try it out at `/strength-year-in-review`!

---

## 🎨 UI & UX Improvements

### Session Analysis Card Overhaul

- **Visual hierarchy**: e1RM-based highlighting — PRs and highest e1RM sets stand out
- **Larger strength level text**: Your strength level is now more prominent
- **Improved layout**: Cleaner header, better exercise block grouping, session tonnage comparison
- **Tonnage range slider**: Filter sessions by volume range
- **Enhanced tooltips**:
  - Notes tooltip on StickyNote icon
  - Video tooltip with truncated URLs
  - Bold "Note:" prefix for workout notes
- **Better highlighting**: Highlighted sets get bigger fonts and padding
- **Session rating**: Now shown in card description with nuanced PR tiers and adlibs

### Consistency Card

- **Grade thresholds**: Extracted and improved calculation logic

### Visual Improvements

- **Big Four Lift Cards**: Updated grid layout for better responsiveness
- **Standards Slider**: Tooltips with tuple info, hover highlights, improved copy
- **Icon update**: Anvil icon in SectionTopCards
- **Plate animations**: Plates slide onto barbell with Motion library animations
- **Feature cards**: Scroll-triggered icon animations, theme chart colors
- **Big Four SVG**: Subtle rotation wobble when stats load

### Layout & Spacing

- **Carousel centering**: Restored proper centering when authenticated
- **Unified auth layouts**: Consistent layout for authenticated and demo states

---

## 🔧 Technical Improvements

### Code Organization

- **Component extraction**: `SessionExerciseBlock` component for reusable exercise displays
- **Local storage patterns**: Documented SSR-safe usage patterns
- **Year recap refactoring**: Decentralized cards, moved processing code out of `src/lib`

### Performance & Caching

- **Session rating cache**: Uses `useLocalStorage` for performance, invalidates on tuple count changes
- **Processing utils**: Enhanced with better date handling and session analysis

### Date & Timezone Fixes

- **Local date handling**: Fixed timezone issues across multiple components:
  - AI lifting assistant, heatmap, months highlights, visualizer-mini
  - Time range select, section-top-cards, use-timer, consistency-card
  - TODAY badge and cutoff dates (fixes Australia timezone issues)
- **Date formatting**: Migrated to `date-fns` library for consistent date handling

---

## 🐛 Bug Fixes

- **Heatmap card**: Fixed broken html2canvas-pro usage after recap migration
- **Seasonal Pattern Card**: Made bar chart visible (was hidden)
- **PR ranking**: Fixed tie-breaking — later dates rank worse when lifts tie
- **Year comparison**: Only shows previous year comparison in December for current year
- **Duplicate styles**: Fixed duplicate style props in seasonal-pattern-card
- **Grade jump calculation**: Fixed consistency grade jump calculation
- **Session momentum**: Fixed to count unique days (was double-counting)

---

## 📊 Data & Analytics Improvements

### Strength Ratings

- **Age-at-PR factor**: Historical lifts now factor in your age at the time of the PR for more accurate strength ratings
- **Bio data integration**: Added bio data support for strength rating calculations
- **Historical PRs**: Properly distinguished from notable lifts using `isHistoricalPR` flag

### Year Recap Data Processing

- **Deadlift multiplier**: Added 1.5x volume multiplier for deadlift in most-trained and favorite badges
- **Lifetime PRs**: Split into separate card from notable lifts
- **Previous year comparison**: Added to Sessions and Tonnage cards with proper date logic
- **Empty states**: Encouraging phrases for PR cards when no data available

### Session Analysis

- **PR tiers**: More nuanced PR classification
- **Strength level integration**: Better integration with strength level calculations
- **Tonnage filtering**: Range slider for filtering sessions by volume

---

## 🎯 Other Improvements

- **Momentum card**: Sessions move up, brackets move out, math shows up — visual glow-up!
- **Lifetime tonnage card**: Unit-aware stats display
- **Weekly streak card**: Improved logic and messaging
- **Training logging prompt**: Updated text in SectionTopCards
- **Carousel position**: Maintains position on year change, reanimates active card
- **Demo mode**: Improved sign-in card and empty states throughout year recap

---

## 📝 Developer Experience

- **Code quality**: Improved prop destructuring, better component separation
- **Local storage**: Documented patterns and SSR-safe usage

---

_Total changes: 44 files changed, 4,268 insertions(+), 950 deletions(-)_
