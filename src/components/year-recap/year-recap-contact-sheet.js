// Desktop "all cards" view of the recap deck.
//
// The story carousel is the right shape on a phone, but on a 1900px monitor it
// is a 360px column in an otherwise empty page and it asks the viewer for eight
// clicks to see their own year. This lays the whole deck out at once.
//
// Each tile renders the real card at its full 360px source width and then scales
// the rendered result down, rather than re-laying-out the card at thumbnail
// width. That keeps typography, spacing, and every animation identical to the
// story view — the tile is a true miniature, not a second design to maintain.
//
// Cards contain their own links and buttons (the closing card has one), so the
// card layer is inert and a transparent overlay button carries the click. That
// avoids nesting interactive elements and gives each tile one accessible name.

import {
  RECAP_CARDS,
  RECAP_CARD_HEIGHT,
  RECAP_CARD_WIDTH,
} from "@/components/year-recap/recap-cards";

// Tile size as a fraction of a real story card. 0.66 keeps the big numbers
// legible at a glance while fitting four or five tiles across a wide screen.
const TILE_SCALE = 0.66;
const TILE_WIDTH = Math.round(RECAP_CARD_WIDTH * TILE_SCALE);
const TILE_HEIGHT = Math.round(RECAP_CARD_HEIGHT * TILE_SCALE);

/**
 * Grid of every recap card for a year. Clicking a tile hands its index back so
 * the page can open that slide in the story carousel.
 * @param {Object} props
 * @param {number|string} props.year - The recap year to render across all cards.
 * @param {boolean} props.isDemo - Whether the deck is showing demo data.
 * @param {Function} props.onOpenCard - Called with the card's index when a tile is clicked.
 */
export function YearRecapContactSheet({ year, isDemo, onOpenCard }) {
  return (
    <div className="w-full">
      <ul className="grid list-none grid-cols-[repeat(auto-fill,minmax(15rem,1fr))] justify-items-center gap-4 p-0">
        {RECAP_CARDS.map(({ id, label, Component }, index) => (
          <li key={id} className="relative">
            <div
              aria-hidden
              className="pointer-events-none overflow-hidden rounded-xl"
              style={{ width: TILE_WIDTH, height: TILE_HEIGHT }}
            >
              <div
                className="flex items-center justify-center rounded-xl border border-border bg-card p-6"
                style={{
                  width: RECAP_CARD_WIDTH,
                  height: RECAP_CARD_HEIGHT,
                  transform: `scale(${TILE_SCALE})`,
                  transformOrigin: "top left",
                }}
              >
                <Component
                  key={`${id}-${year}`}
                  year={year}
                  isDemo={isDemo}
                  isActive
                />
              </div>
            </div>
            <button
              type="button"
              onClick={() => onOpenCard?.(index)}
              className="absolute inset-0 rounded-xl ring-offset-background transition-all hover:bg-foreground/5 hover:ring-2 hover:ring-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <span className="sr-only">
                Open the {label} card for {year}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
