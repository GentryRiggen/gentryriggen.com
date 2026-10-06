import {
  CirclePlus,
  Factory,
  Fan,
  BedDouble,
  LifeBuoy,
  Navigation,
  Navigation2,
  Scale,
  TriangleAlert,
  Wind,
  type LucideIcon,
} from "lucide-react";
import type { WarningCode } from "@/lib/ship-builder/model/stats";

export const warningIcons: Record<WarningCode, LucideIcon> = {
  lifeboats: LifeBuoy,
  "no-bridge": Navigation,
  "no-funnels": Factory,
  "no-sails": Wind,
  "no-propellers": Fan,
  "needs-propellers": CirclePlus,
  "no-rudder": Navigation2,
  "crew-berths": BedDouble,
  "top-heavy": TriangleAlert,
  lopsided: Scale,
};
