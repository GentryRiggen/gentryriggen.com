import type { LightSceneInfo } from "@/lib/ever-onward/universes/light";
import type { LastBuy } from "../../universes/types";
import {
  COTTAGE,
  DEPOT,
  FAR_LIGHT_GAP,
  FAR_LIGHT_X,
  GUARD_STATION,
  LAKE,
  AIM_DISH,
  LAMP,
  QUAY,
  RELAY_RADIUS,
  SUN,
  planetPoint,
  slotTop,
  type NightSlot,
  type Point,
} from "./anchors";

export interface Callout extends Point {
  text: string;
}

/** Places a callout; `n` is how many are owned now. */
type Place = (n: number, info: LightSceneInfo) => Callout;

const at = (x: number, y: number, text: string): Callout => ({ x, y, text });

const slot =
  (name: NightSlot, text: (n: number) => string): Place =>
  (n) => {
    const p = slotTop(name);
    return at(p.x, p.y, text(n));
  };

const rim =
  (angle: number, depth: number, text: string): Place =>
  () => {
    const p = planetPoint(angle, depth);
    return at(p.x, p.y, text);
  };

const fixed =
  (x: number, y: number, text: string): Place =>
  () =>
    at(x, y, text);

const farLight = (i: number): number => FAR_LIGHT_X + i * FAR_LIGHT_GAP;

const PLACES: Record<string, Place> = {
  // The Coast
  lens: (n) => at(LAMP.x + 18, LAMP.y, `Lens ${n}: wider beam`),
  keeper: () => at(COTTAGE.x, COTTAGE.y - 14, "Keeper hired"),
  lighthouse: (n) => at(farLight(n - 1), 154, `Lighthouse ${n + 1} lit!`),
  "wick-1": fixed(LAMP.x + 30, LAMP.y - 28, "Trimmed wick"),
  "wick-2": fixed(LAMP.x + 30, LAMP.y - 28, "Brass burner"),
  "fees-1": fixed(250, 232, "Ships pay more"),
  "fees-2": fixed(250, 232, "Pilot's tax"),
  "fees-3": fixed(250, 232, "Toll booth"),
  "dock-1": fixed(QUAY.market, QUAY.y + 10, "Fish market"),
  "dock-2": fixed(QUAY.ferry, QUAY.y + 10, "Ferry landing"),
  "dock-3": fixed(QUAY.terminal - 6, QUAY.y + 8, "Cruise terminal"),
  "tank-1": fixed(DEPOT.x + 10, DEPOT.y + 2, "Bigger tank"),
  "tank-2": fixed(DEPOT.x + 10, DEPOT.y, "Oil cistern"),
  "train-1": fixed(COTTAGE.x, COTTAGE.y - 28, "Crew drills"),
  "train-2": fixed(GUARD_STATION.x + 10, GUARD_STATION.y, "Coast guard"),
  "train-3": fixed(232, 266, "Rescue fleet"),
  "shutters-1": fixed(LAMP.x, LAMP.y - 34, "Storm shutters"),
  "shutters-2": fixed(LAMP.x, LAMP.y - 34, "Storm glass"),
  contract: fixed(304, 268, "Oil contract"),
  // No More Night
  crank: slot("crank", (n) => `Crank ${n}`),
  gen1: slot("gen1", (n) => `+1 generator (${n})`),
  gen2: slot("gen2", (n) => `+1 steam plant (${n})`),
  gen3: slot("gen3", (n) => `+1 river dam (${n})`),
  gen4: slot("gen4", (n) => `+1 wind farm (${n})`),
  "lines-1": rim(-0.6, 20, "Power line"),
  "lines-2": rim(-0.6, 38, "Second line"),
  "lines-3": rim(0.6, 56, "Ring of power"),
  "lines-4": rim(0, 40, "National grid"),
  "subs-1": rim(0.2, 10, "Substations"),
  "subs-2": rim(-0.3, 10, "Every town"),
  "bulbs-1": rim(-0.35, 4, "LED bulbs"),
  "bulbs-2": rim(0.35, 4, "Dimmer switches"),
  "bulbs-3": rim(0, 4, "Smart lights"),
  "batt-1": fixed(200, 206, "Battery cabinet"),
  "batt-2": fixed(200, 206, "Battery rack"),
  "batt-3": fixed(200, 206, "Battery shed"),
  "batt-4": fixed(200, 206, "Battery barn"),
  "batt-5": fixed(200, 206, "Battery hall"),
  "batt-6": fixed(200, 206, "Battery yard"),
  "batt-7": fixed(200, 206, "Battery farm"),
  "batt-8": fixed(200, 206, "Battery mountain"),
  "storm-crews": rim(-0.1, 2, "Storm crews"),
  "weather-vane": slot("grid", () => "Weather vane"),
  // The Sky
  aim: (n) => at(AIM_DISH.x, AIM_DISH.y - 24, `Aim ${n}`),
  collector: (n) => at(SUN.x, SUN.y - 104, `Collector ${n} / 6`),
  "mirror-1": fixed(SUN.x, SUN.y - 104, "Bigger mirrors"),
  "mirror-2": fixed(SUN.x, SUN.y - 56, "Ring of mirrors"),
  "mirror-3": fixed(LAKE.x, LAKE.y - 20, "Lake mirror"),
  probe: fixed(SUN.x + 40, SUN.y - 24, "First probe away!"),
  "copy-1": fixed(SUN.x + 60, SUN.y - 24, "Probes copy faster"),
  "copy-2": fixed(SUN.x + 60, SUN.y - 24, "Self-repairing"),
  "relay-1": fixed(SUN.x, SUN.y - RELAY_RADIUS - 8, "Relay stations"),
  "relay-2": fixed(SUN.x, SUN.y - RELAY_RADIUS - 8, "Ring of relays"),
  "relay-3": fixed(SUN.x, SUN.y - RELAY_RADIUS - 8, "Sky listening"),
  "nav-1": fixed(SUN.x + 70, SUN.y - 60, "Sun charts"),
  "nav-2": fixed(SUN.x + 70, SUN.y - 60, "Shield foundry"),
  "engines-1": fixed(SUN.x + 90, SUN.y - 8, "Quicker engines"),
  "engines-2": fixed(SUN.x + 90, SUN.y - 8, "Light sail"),
  "appetite-1": fixed(SUN.x + 70, SUN.y + 30, "Hungry probes"),
  "appetite-2": fixed(SUN.x + 70, SUN.y + 30, "Wider arms"),
};
// The Last Light
Object.assign(PLACES, {
  "hearth-1": fixed(200, 248, "A bigger log"),
  "hearth-2": fixed(200, 248, "Dry kindling"),
  "hearth-3": fixed(200, 248, "Stone hearth"),
  "hearth-4": fixed(200, 248, "Chimney draws"),
  "hearth-5": fixed(200, 248, "Banked fire"),
  "hearth-6": fixed(200, 248, "Iron stove"),
  "sail-1": fixed(320, 236, "Patched sail"),
  "sail-2": fixed(320, 236, "Taller mast"),
  "sail-3": fixed(320, 236, "Oars out"),
  "sail-4": fixed(320, 236, "Lookout at the bow"),
  "sail-5": fixed(320, 236, "Good crew"),
  "slowburn-1": fixed(90, 188, "Heavier glass"),
  "slowburn-2": fixed(90, 188, "Shutters closed"),
  "slowburn-3": fixed(90, 188, "Wool wraps"),
  "song-1": fixed(320, 224, "A hummed tune"),
  "song-2": fixed(320, 224, "Sea shanty"),
  "song-3": fixed(320, 224, "Lullaby for the water"),
  "song-4": fixed(320, 224, "The old song"),
  "company-1": fixed(300, 188, "Warm gold"),
  "company-2": fixed(300, 188, "Old stories"),
  "company-3": fixed(300, 188, "Patient hands"),
});

/** The callout for a purchase, or null for an id the scene has no spot for. */
export function calloutFor(
  buy: Pick<LastBuy, "upgradeId" | "n">,
  info: LightSceneInfo
): Callout | null {
  const place = PLACES[buy.upgradeId];
  return place ? place(buy.n, info) : null;
}

/** Upgrade ids with a callout (a test keeps this in step with the shop). */
export const CALLOUT_IDS: readonly string[] = Object.keys(PLACES);
