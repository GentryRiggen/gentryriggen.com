import type { ShipKind } from "../model/kinds";
import type { Ship } from "../model/types";

/** A ready-made ship offered in the New ship dialog. */
export interface ShipTemplate {
  /** Stable, unique across all templates, e.g. "titanic". */
  id: string;
  kind: ShipKind;
  /** Shown on the card and used as the new ship's name, e.g. "RMS Titanic". */
  name: string;
  year: number;
  /** One short line for the card, readable aloud to a child. */
  blurb: string;
  /** A fresh, valid ship (validateShip passes) of this template's kind. */
  build: () => Ship;
}
