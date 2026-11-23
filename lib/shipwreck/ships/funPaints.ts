import type { FunPaint, Livery } from "./types";

/**
 * Paints just for fun (1.7): colours real ships of her kind wore in her
 * day, never hers. The liners' come from the big passenger lines of
 * 1900–1920 (Cunard's red funnels, White Star's buff, Blue Funnel's blue,
 * Union-Castle's lavender hull, Orient's corn hull, a royal yacht's white,
 * wartime grey); the laker's from Great Lakes fleets of the 1950s–70s
 * (black, grey, blue or green hulls; red, silver or orange stacks). Each
 * changes only colours: her hull, her funnels and their tops and bands,
 * her masts and boats (sRGB, plain numbers).
 */
interface FunDef {
  id: string;
  label: string;
  /** The year the look is of (for the save and the words). */
  year: number;
  paint: FunPaint;
}

const BLACK = 0x121315;
const TOP = 0x141416;
const RED_BOTTOM = 0x6a2419;
const GOLD = 0xc9a03a;
const BUFF = 0xbb7f3a;

/** Liners (the Titanic, Lusitania, Carpathia and Britannic). */
const LINER_FUN: readonly FunDef[] = [
  {
    id: "fun-cunard",
    label: "Cunard red funnels",
    year: 1912,
    paint: {
      topsides: BLACK,
      bottom: RED_BOTTOM,
      sheerLine: null,
      funnel: 0xcc5a28,
      funnelTop: TOP,
    },
  },
  {
    id: "fun-white-star",
    label: "White Star buff funnels",
    year: 1912,
    paint: {
      topsides: BLACK,
      bottom: RED_BOTTOM,
      sheerLine: GOLD,
      funnel: BUFF,
      funnelTop: TOP,
      mast: 0xa9835a,
    },
  },
  {
    id: "fun-blue-funnel",
    label: "Blue Funnel blue funnels",
    year: 1912,
    paint: {
      topsides: BLACK,
      bottom: 0x5a2a22,
      sheerLine: null,
      funnel: 0x4a7fb5,
      funnelTop: TOP,
    },
  },
  {
    id: "fun-lavender",
    label: "Union-Castle lavender hull",
    year: 1912,
    paint: {
      topsides: 0xa198ad,
      bottom: 0x7a2a22,
      boot: 0xe8e4d8,
      sheerLine: null,
      funnel: 0xc8452c,
      funnelTop: TOP,
    },
  },
  {
    id: "fun-orient",
    label: "Orient Line corn-coloured hull",
    year: 1912,
    paint: {
      topsides: 0xc2a46c,
      bottom: 0x6a2419,
      sheerLine: null,
      funnel: BUFF,
      funnelTop: TOP,
    },
  },
  {
    id: "fun-yacht",
    label: "All white, like a royal yacht",
    year: 1912,
    paint: {
      topsides: 0xe3dfd3,
      bottom: 0x2e4d2c,
      sheerLine: GOLD,
      funnel: 0xc9a24a,
      funnelTop: TOP,
      mast: 0xa9835a,
    },
  },
  {
    id: "fun-war-grey",
    label: "Wartime grey",
    year: 1917,
    paint: {
      topsides: 0x737980,
      bottom: 0x4a2a24,
      boot: 0x2c2f33,
      sheerLine: null,
      funnel: 0x7d8289,
      funnelTop: 0x6e737a,
      mast: 0x7d8289,
      boat: { hull: 0x9a9fa5, bottom: 0x7d8289 },
    },
  },
];

const LAKER_BOAT = (bottom: number) => ({ hull: 0xf1efe8, bottom });

/** Lake freighters (the Edmund Fitzgerald). */
const LAKER_FUN: readonly FunDef[] = [
  {
    id: "fun-silver-stack",
    label: "Red hull, silver stack",
    year: 1970,
    paint: {
      topsides: 0x611f1f,
      bottom: 0x4a1818,
      sheerLine: null,
      funnel: 0xb4b8bc,
      funnelTop: 0x161616,
      boat: LAKER_BOAT(0x611f1f),
    },
  },
  {
    id: "fun-black-hull",
    label: "Black hull, red stack",
    year: 1970,
    paint: {
      topsides: 0x1a1b1d,
      bottom: 0x4a1818,
      sheerLine: null,
      funnel: 0xa8261e,
      funnelTop: 0x161616,
      boat: LAKER_BOAT(0x1a1b1d),
    },
  },
  {
    id: "fun-grey-hull",
    label: "Grey hull, black stack",
    year: 1970,
    paint: {
      topsides: 0x686e75,
      bottom: 0x4a1818,
      sheerLine: null,
      funnel: 0x1f2022,
      funnelTop: 0x161616,
      boat: LAKER_BOAT(0x686e75),
    },
  },
  {
    id: "fun-blue-hull",
    label: "Blue hull, buff stack",
    year: 1970,
    paint: {
      topsides: 0x23426a,
      bottom: 0x4a1818,
      sheerLine: null,
      funnel: 0xc9a24a,
      funnelTop: 0x161616,
      boat: LAKER_BOAT(0x23426a),
    },
  },
  {
    id: "fun-green-hull",
    label: "Green hull, green stack",
    year: 1970,
    paint: {
      topsides: 0x2c4a37,
      bottom: 0x4a1818,
      sheerLine: null,
      funnel: 0x2c4a37,
      funnelTop: 0x161616,
      boat: LAKER_BOAT(0x2c4a37),
    },
  },
  {
    id: "fun-orange-stack",
    label: "Black hull, orange stack",
    year: 1970,
    paint: {
      topsides: 0x1a1b1d,
      bottom: 0x4a1818,
      sheerLine: null,
      funnel: 0xcf6a2b,
      funnelTop: 0x161616,
      boat: LAKER_BOAT(0x1a1b1d),
    },
  },
];

/** A cruise ship's lifeboats: orange (SOLAS) over a lower hull. */
const CRUISE_BOAT = (bottom: number) => ({
  hull: 0xe8801f,
  bottom,
  cover: 0xe8801f,
});
const CRUISE_BOTTOM = 0x5e2219;
const CRUISE_WHITE = 0xeeeeea;
const CRUISE_TOP = 0x18191b;

/**
 * Modern cruise ships (the Costa Concordia): hull colours and funnels the
 * big cruise fleets of the 1990s–2010s wore, by look, not by company. The
 * superstructure stays white in every one (only her hull to deck 3, its
 * bottom and boot-top, the funnel and its top, and the boats change).
 */
const CRUISE_FUN: readonly FunDef[] = [
  {
    id: "fun-navy-hull",
    label: "Navy blue hull",
    year: 2010,
    paint: {
      topsides: 0x1d2a47,
      bottom: CRUISE_BOTTOM,
      boot: 0xe8e6df,
      sheerLine: null,
      funnel: 0x1d2a47,
      funnelTop: CRUISE_TOP,
      boat: CRUISE_BOAT(0x1d2a47),
    },
  },
  {
    id: "fun-black-red",
    label: "Black hull, red funnel",
    year: 2010,
    paint: {
      topsides: 0x18191b,
      bottom: CRUISE_BOTTOM,
      boot: 0xd9d6cc,
      sheerLine: null,
      funnel: 0xb3342a,
      funnelTop: CRUISE_TOP,
      boat: CRUISE_BOAT(0x18191b),
    },
  },
  {
    id: "fun-blue-white",
    label: "Dark blue hull, white funnel",
    year: 2010,
    paint: {
      topsides: 0x223a63,
      bottom: CRUISE_BOTTOM,
      boot: 0xe8e6df,
      sheerLine: null,
      funnel: 0xeeede8,
      funnelTop: 0x2a2c30,
      boat: CRUISE_BOAT(0x223a63),
    },
  },
  {
    id: "fun-white-blue",
    label: "White hull, blue funnel",
    year: 2010,
    paint: {
      topsides: CRUISE_WHITE,
      bottom: CRUISE_BOTTOM,
      boot: 0x2f5c9e,
      sheerLine: null,
      funnel: 0x2f5c9e,
      funnelTop: CRUISE_TOP,
      boat: CRUISE_BOAT(0xf1efe8),
    },
  },
  {
    id: "fun-white-red",
    label: "White hull, red funnel",
    year: 2010,
    paint: {
      topsides: CRUISE_WHITE,
      bottom: CRUISE_BOTTOM,
      boot: 0x8e2a22,
      sheerLine: null,
      funnel: 0xb8382c,
      funnelTop: CRUISE_TOP,
      boat: CRUISE_BOAT(0xf1efe8),
    },
  },
  {
    id: "fun-green-hull",
    label: "Green hull",
    year: 2010,
    paint: {
      topsides: 0x2e4f3c,
      bottom: CRUISE_BOTTOM,
      boot: 0xe8e6df,
      sheerLine: null,
      funnel: 0xe9e7df,
      funnelTop: 0x2e4f3c,
      boat: CRUISE_BOAT(0x2e4f3c),
    },
  },
];

function toLivery(d: FunDef, from?: string): Livery {
  return {
    id: d.id,
    label: d.label,
    year: d.year,
    sources: ["Just for fun: colours real ships of her kind wore"],
    swatches: [d.paint.topsides, d.paint.funnel],
    funnelPaint: { funnel: d.paint.funnel, top: d.paint.funnelTop },
    look: {
      hull: d.paint.topsides,
      funnel: d.paint.funnel,
      top: d.paint.funnelTop,
    },
    fun: { ...(from && { from }), paint: d.paint },
  };
}

/**
 * The liners' fun paints for one ship: all but `skip` (the ones that are
 * really hers), each painted over livery `from`.
 */
export function linerFun(
  skip: readonly string[],
  from?: string
): readonly Livery[] {
  return LINER_FUN.filter((d) => !skip.includes(d.id)).map((d) =>
    toLivery(d, from)
  );
}

/** The laker's fun paints. */
export function lakerFun(): readonly Livery[] {
  return LAKER_FUN.map((d) => toLivery(d));
}

/** A modern cruise ship's fun paints (the Costa Concordia's). */
export function cruiseFun(): readonly Livery[] {
  return CRUISE_FUN.map((d) => toLivery(d));
}
