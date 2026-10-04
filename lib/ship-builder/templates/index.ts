import type { ShipKind } from "../model/kinds";
import { CARGO_TEMPLATES } from "./cargo";
import { CRUISE_TEMPLATES } from "./cruise";
import { LINER_TEMPLATES } from "./liner";
import { NAVY_TEMPLATES } from "./navy";
import type { ShipTemplate } from "./types";

export type { ShipTemplate } from "./types";

export const TEMPLATES: Record<ShipKind, readonly ShipTemplate[]> = {
  liner: LINER_TEMPLATES,
  cruise: CRUISE_TEMPLATES,
  navy: NAVY_TEMPLATES,
  cargo: CARGO_TEMPLATES,
};

export function findTemplate(id: string): ShipTemplate | undefined {
  return Object.values(TEMPLATES)
    .flat()
    .find((template) => template.id === id);
}
