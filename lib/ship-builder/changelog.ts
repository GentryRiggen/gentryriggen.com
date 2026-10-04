/**
 * What changed in each Ship Builder release, newest first. Shown on the
 * Versions page.
 *
 * Every bump of SHIP_BUILDER_VERSION needs a new entry at the top (a test
 * enforces it). Write the notes from the release's commits
 * (`git log <previous release>..HEAD -- lib/ship-builder components/ship-builder`),
 * in plain words a young builder or their parent would follow.
 */
export interface Release {
  version: string;
  /** ISO date, YYYY-MM-DD. */
  date: string;
  title: string;
  highlights: string[];
}

export const CHANGELOG: readonly Release[] = [
  {
    version: "2.1.1",
    date: "2026-10-04",
    title: "What's new",
    highlights: ["Tap the version number to see what changed in every release"],
  },
  {
    version: "2.1.0",
    date: "2026-10-04",
    title: "Decorations",
    highlights: [
      "Deck chairs, benches and lamps for every ship, plus Titanic-style ventilators on liners",
      "Stairs that climb up the side of a block to the deck above",
      "The Grand Staircase glass dome for ocean liners",
      "Searchlights on the bridge and masts, a crow's nest, and a stern flag that waves",
      "Wireless aerial wires strung between two masts",
    ],
  },
  {
    version: "2.0.0",
    date: "2026-10-04",
    title: "Ship types",
    highlights: [
      "Pick a ship type when you start: ocean liner, cruise ship, navy ship or cargo ship",
      "Cruise ships: balcony cabins, pools, a waterslide, a climbing wall, enclosed lifeboats, life rafts and azipods",
      "Navy ships: turning gun turrets, a radar mast, a helipad with a helicopter, and RIB boats",
      "Cargo ships: stackable containers, hatch covers, a turning crane, a free-fall lifeboat and a bridge at the back",
      "Each type compares your ship with a real one, like Wonder of the Seas or the Ever Given",
      "A Show all parts switch lets you mix parts from every type",
    ],
  },
  {
    version: "1.5.0",
    date: "2026-10-04",
    title: "Search, crew beds and waves",
    highlights: [
      "Search the parts list, even with typos",
      "The panel headers stay put while you scroll",
      "Crew quarters, with a warning when the crew don't have enough beds",
      "Calm, choppy or stormy seas: rough water rocks the ship, and top-heavy ships rock the most",
    ],
  },
  {
    version: "1.4.0",
    date: "2026-10-04",
    title: "Paint",
    highlights: [
      "A paint brush with 12 colours for every part and the hull",
      "The version number is shown next to the title",
    ],
  },
  {
    version: "1.3.0",
    date: "2026-10-03",
    title: "Bows, sterns and rudders",
    highlights: [
      "Choose the bow (straight, clipper, bulbous or icebreaker) and the stern (counter, cruiser, transom or canoe)",
      "A rudder, and a warning when a ship with propellers has none",
      "Portholes, deck railings and an anchor on the hull",
      "Cabins have windows, funnels have bands, lifeboats are rounded and davits are curved",
    ],
  },
  {
    version: "1.2.2",
    date: "2026-10-03",
    title: "Masts and animations",
    highlights: [
      "One mast part that goes on the bow, the stern or any deck block",
      "Bigger close buttons on the side panels",
      "Spinning propellers, funnel smoke, a gently rocking ship, parts that pop in, and bubbles underwater",
    ],
  },
  {
    version: "1.2.1",
    date: "2026-10-03",
    title: "Easier davits and bridges",
    highlights: [
      "Press and hold to delete works on the iPad",
      "Davits go on a single block; no need to stack two",
      "Bridges from 3 to 7 wide",
    ],
  },
  {
    version: "1.2.0",
    date: "2026-10-03",
    title: "Bigger ships and propellers",
    highlights: [
      "Ships up to 20 segments long",
      "Large funnels on a 2×2 of deck blocks, and large lifeboats between two davits",
      "A Below view under the water, and propellers that set the top speed",
      "Pictures for every part, button, stat and warning",
    ],
  },
  {
    version: "1.1.0",
    date: "2026-10-03",
    title: "Made for the iPad",
    highlights: [
      "Make the ship wider or narrower",
      "Blocks can hang off the side and build out past the hull",
      "Press and hold to delete, and two-finger pan",
      "Install it on the home screen and play offline",
    ],
  },
  {
    version: "1.0.0",
    date: "2026-10-03",
    title: "First voyage",
    highlights: [
      "Build a Titanic-style liner from deck blocks, cabins, a bridge, funnels, masts and lifeboats",
      "Live stats: passengers, crew, lifeboat seats, tonnage, top speed and stability",
      "Undo and redo, save to My Ships, and share a link to your ship",
    ],
  },
];
