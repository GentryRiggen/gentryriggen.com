"use client";

import { createContext, useContext, type ReactNode } from "react";
import { EMPTY_SHIPPED, type ShippedSummary } from "./releases";

const ShippedContext = createContext<ShippedSummary>(EMPTY_SHIPPED);

export function useShipped(): ShippedSummary {
  return useContext(ShippedContext);
}

interface ShippedProviderProps {
  shipped: ShippedSummary;
  children: ReactNode;
}

export function ShippedProvider({ shipped, children }: ShippedProviderProps) {
  return (
    <ShippedContext.Provider value={shipped}>
      {children}
    </ShippedContext.Provider>
  );
}
