import { create } from "zustand";
import type { Ship } from "../model/types";

interface SharedLinkState {
  /** The ship that arrived by a share link, while its banner is showing. */
  ship: Ship | null;
  /** True when the visitor's own ship was put safely in My Ships first. */
  isBackedUp: boolean;
  show: (ship: Ship, isBackedUp?: boolean) => void;
  dismiss: () => void;
}

/** Remembers that the ship on screen came from a friend's link. */
export const useSharedLinkStore = create<SharedLinkState>((set) => ({
  ship: null,
  isBackedUp: false,
  show: (ship, isBackedUp = false) => set({ ship, isBackedUp }),
  dismiss: () => set({ ship: null, isBackedUp: false }),
}));
