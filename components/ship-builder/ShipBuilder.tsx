"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import ThemeToggle from "@/components/ThemeToggle";
import useCollapsedPanels from "./hooks/useCollapsedPanels";
import useKeyboardShortcuts from "./hooks/useKeyboardShortcuts";
import useServiceWorker from "./hooks/useServiceWorker";
import useShipPersistence from "./hooks/useShipPersistence";
import useTestHook from "./hooks/useTestHook";
import useWebGLSupport from "./hooks/useWebGLSupport";
import CatalogPanel from "./ui/CatalogPanel";
import Drawer from "./ui/Drawer";
import Notice from "./ui/Notice";
import PlacementHint from "./ui/PlacementHint";
import RemovalConfirm from "./ui/RemovalConfirm";
import StatsPanel from "./ui/StatsPanel";
import Toolbar from "./ui/Toolbar";
import WebGLFallback from "./ui/WebGLFallback";

type DrawerSide = "left" | "right";

const Scene = dynamic(() => import("./scene/Scene"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-sm text-slate-500 dark:text-slate-400">
      Launching the shipyard…
    </div>
  ),
});

export default function ShipBuilder() {
  useTestHook();
  useShipPersistence();
  useKeyboardShortcuts();
  useServiceWorker();
  const webgl = useWebGLSupport();
  const collapsed = useCollapsedPanels();
  const [openDrawer, setOpenDrawer] = useState<DrawerSide | null>(null);

  function handleDrawerOpenChange(side: DrawerSide, open: boolean) {
    setOpenDrawer((current) =>
      open ? side : current === side ? null : current
    );
  }

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden overscroll-none select-none bg-slate-100 [-webkit-touch-callout:none] text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <header className="flex items-center gap-4 border-b border-slate-200 bg-white pt-[calc(0.75rem+env(safe-area-inset-top))] pb-3 pl-4 pr-20 dark:border-slate-800 dark:bg-slate-900">
        <Link
          href="/"
          className="text-sm text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
        >
          ← gentryriggen.com
        </Link>
        <h1 className="text-lg font-semibold">Ship Builder</h1>
      </header>
      <ThemeToggle />

      <div className="relative flex min-h-0 flex-1">
        {openDrawer && (
          <div
            data-testid="drawer-backdrop"
            aria-hidden="true"
            onClick={() => setOpenDrawer(null)}
            className="absolute inset-0 z-20 bg-slate-950/40 lg:hidden"
          />
        )}
        <Drawer
          side="left"
          label="Parts"
          open={openDrawer === "left"}
          onOpenChange={(open) => handleDrawerOpenChange("left", open)}
          collapsed={collapsed.left}
          onCollapsedChange={() => collapsed.toggle("left")}
        >
          <CatalogPanel
            onPick={() => setOpenDrawer((d) => (d === "left" ? null : d))}
          />
        </Drawer>
        <main className="relative min-w-0 flex-1">
          {webgl === false ? <WebGLFallback /> : webgl ? <Scene /> : null}
          <Notice />
          <RemovalConfirm />
          <PlacementHint />
        </main>
        <Drawer
          side="right"
          label="Stats"
          open={openDrawer === "right"}
          onOpenChange={(open) => handleDrawerOpenChange("right", open)}
          collapsed={collapsed.right}
          onCollapsedChange={() => collapsed.toggle("right")}
        >
          <StatsPanel />
        </Drawer>
      </div>
      <Toolbar />
    </div>
  );
}
