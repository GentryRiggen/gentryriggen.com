export type SkyPhase = "dawn" | "day" | "dusk" | "evening" | "night";

/** The sky at a moment, from the iPad's own clock. */
export function skyPhase(ms: number): SkyPhase {
  const d = new Date(ms);
  const hour = d.getHours() + d.getMinutes() / 60;
  if (hour >= 6.5 && hour < 8) return "dawn";
  if (hour >= 8 && hour < 17) return "day";
  if (hour >= 17 && hour < 19.5) return "dusk";
  if (hour >= 19.5 && hour < 21) return "evening";
  return "night";
}
