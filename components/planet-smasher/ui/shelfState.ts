import { create } from "zustand";

/** Whether the trophy shelf is open (the toast waits until it closes). */
export const useShelfOpen = create<{
  open: boolean;
  setOpen(open: boolean): void;
}>((set) => ({ open: false, setOpen: (open) => set({ open }) }));
