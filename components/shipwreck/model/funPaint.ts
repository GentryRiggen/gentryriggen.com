import type { FunPaint } from "@/lib/shipwreck/ships/types";
import { COLORS } from "./buildShip";
import { TITANIC_HULL_PAINT } from "./materials";
import type { ShipPaint, ShipRecipe } from "./titanicRecipe";

/** The Titanic's paint as the recipes' defaults draw it (no `paint`). */
const TITANIC_PAINT: ShipPaint = {
  funnel: COLORS.buff,
  funnelTop: COLORS.black,
  sheerLine: TITANIC_HULL_PAINT.sheerLine,
  name: "TITANIC",
};

/** The liners' black topsides when a recipe names none (the shader's). */
const BLACK_TOPSIDES = 0x121315;

/**
 * A fun paint (1.7) on `base`, her recipe in the livery it is painted over:
 * the same shape, so a swap stays colours only (shipModel's liveries). The
 * hull's topsides, bottom, boot-top and the line under the sheer, the
 * funnels, masts and boats change; walls painted her topsides' colour (a
 * laker's deck edge) follow it; the dazzle is off. Everything else (the
 * white houses, the names) stays hers.
 */
export function withFunPaint(base: ShipRecipe, fun: FunPaint): ShipRecipe {
  const own = base.paint ?? TITANIC_PAINT;
  const oldTopsides = own.hull?.topsides ?? BLACK_TOPSIDES;
  const paint: ShipPaint = {
    ...own,
    funnel: fun.funnel,
    funnelTop: fun.funnelTop,
    sheerLine: fun.sheerLine,
    mast: fun.mast ?? own.mast,
    boat: fun.boat ?? own.boat,
    hull: {
      ...own.hull,
      topsides: fun.topsides,
      bottom: fun.bottom,
      boot: fun.boot ?? own.hull?.boot,
    },
    dazzle: false,
  };
  // A mark only her real paint carries (the Concordia's "C", the
  // Poseidon's gold wave) comes off.
  const marked = base.funnels.some(
    (f) => f.emblem?.realOnly || f.wave?.realOnly
  );
  return {
    ...base,
    paint,
    blocks: base.blocks?.map((b) =>
      b.wallColor === oldTopsides ? { ...b, wallColor: fun.topsides } : b
    ),
    ...(marked && {
      funnels: base.funnels.map((f) => {
        if (!f.emblem?.realOnly && !f.wave?.realOnly) return f;
        const rest = { ...f };
        if (rest.emblem?.realOnly) delete rest.emblem;
        // The Poseidon's gold wave.
        if (rest.wave?.realOnly) delete rest.wave;
        return rest;
      }),
    }),
  };
}
