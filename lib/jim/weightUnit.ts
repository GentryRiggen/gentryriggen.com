/** lb or kg for the weights on the Training page (stored in lb). */

export type WeightUnit = "lb" | "kg";

const UNIT_KEY = "jim:weight-unit";
const KG_PER_LB = 0.45359237;

export function loadWeightUnit(): WeightUnit {
  try {
    return window.localStorage.getItem(UNIT_KEY) === "kg" ? "kg" : "lb";
  } catch {
    return "lb";
  }
}

export function saveWeightUnit(unit: WeightUnit): void {
  try {
    window.localStorage.setItem(UNIT_KEY, unit);
  } catch {
    // Not remembered; the toggle still works for this visit.
  }
}

/** 1 decimal under 100, whole numbers above, with thousands separators. */
export function fmtNum(v: number): string {
  return (
    Math.abs(v) >= 100 ? Math.round(v) : Number(v.toFixed(1))
  ).toLocaleString("en-US");
}

/** Pounds as kilograms, to the nearest half. */
export function lbToKg(lb: number): number {
  return Math.round((lb * KG_PER_LB) / 0.5) * 0.5;
}

/** The number to show for `lb` in `unit`: whole pounds as given, kg to the half. */
export function fmtWeightValue(lb: number, unit: WeightUnit): string {
  if (unit === "lb") return fmtNum(lb);
  return lbToKg(lb).toLocaleString("en-US", { maximumFractionDigits: 1 });
}

/** "225 lb" or "102 kg". */
export function fmtWeight(lb: number, unit: WeightUnit): string {
  return `${fmtWeightValue(lb, unit)} ${unit}`;
}
