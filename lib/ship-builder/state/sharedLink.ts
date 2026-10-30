import { create } from "zustand";
import type { Ship } from "../model/types";

interface SharedLinkState {
  /** The ship that arrived by a share link, while its banner is showing. */
  ship: Ship | null;
  show: (ship: Ship) => void;
  dismiss: () => void;
}

/** Remembers that the ship on screen came from a friend's link. */
export const useSharedLinkStore = create<SharedLinkState>((set) => ({
  ship: null,
  show: (ship) => set({ ship }),
  dismiss: () => set({ ship: null }),
}));
