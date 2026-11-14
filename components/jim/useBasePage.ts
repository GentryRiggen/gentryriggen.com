"use client";

import { useState } from "react";
import { homePageOf, type JimRoute, type NotesPage } from "@/lib/jim/routes";

/**
 * The list page a profile, card or note sits over: the last list shown, or
 * (opened straight from its address) the list it belongs to. It keeps the
 * list mounted underneath and lights its entry in the navigation.
 */
export default function useBasePage(route: JimRoute): NotesPage {
  const [base, setBase] = useState<NotesPage>(() => homePageOf(route));
  if (route.kind === "page" && route.page !== base) setBase(route.page);
  return route.kind === "page" ? route.page : base;
}
