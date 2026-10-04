import {
  CirclePlus,
  Factory,
  Fan,
  LifeBuoy,
  Navigation,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";
import type { WarningCode } from "@/lib/ship-builder/model/stats";

export const warningIcons: Record<WarningCode, LucideIcon> = {
  lifeboats: LifeBuoy,
  "no-bridge": Navigation,
  "no-funnels": Factory,
  "no-propellers": Fan,
  "needs-propellers": CirclePlus,
  "top-heavy": TriangleAlert,
};
