"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useShipBuilderStore } from "@/lib/ship-builder/state/store";
import useCollapsedPanels from "./hooks/useCollapsedPanels";
import useKeyboardShortcuts from "./hooks/useKeyboardShortcuts";
import useServiceWorker from "./hooks/useServiceWorker";
import useShipPersistence from "./hooks/useShipPersistence";
import useTestHook from "./hooks/useTestHook";
import useWebGLSupport from "./hooks/useWebGLSupport";
import AppHeader from "./ui/AppHeader";
import CatalogPanel from "./ui/CatalogPanel";
import Drawer from "./ui/Drawer";
import HelpButton from "./ui/HelpButton";
import Notice from "./ui/Notice";
import PlacementHint from "./ui/PlacementHint";
import RemovalConfirm from "./ui/RemovalConfirm";
import BelowDeckInset from "./ui/BelowDeckInset";
import IcebergAimHint from "./ui/IcebergAimHint";
import SeaTrialButton from "./ui/SeaTrialButton";
import SeaTrialResult from "./ui/SeaTrialResult";
import SeaTrialStatus from "./ui/SeaTrialStatus";
import SelectionBar from "./ui/SelectionBar";
import StatsHud from "./ui/StatsHud";
import StatsPanel from "./ui/StatsPanel";
import UndoRedo from "./ui/UndoRedo";
import ViewControls from "./ui/ViewControls";
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
  const isTrialActive = useShipBuilderStore((s) => s.trial.status !== "idle");
  // The sinking is the show: clear everything that is not part of it.
  const inFocus = useShipBuilderStore(
    (s) => s.trial.status === "running" || s.trial.status === "result"
  );

  // Adjusting state during render (not in an effect) so no frame shows a
  // drawer left open behind the trial.
  if (inFocus && openDrawer !== null) setOpenDrawer(null);

  // The trial plays in the 3D scene: without WebGL, or once the builder is
  // gone, nothing could end it and building would stay paused.
  useEffect(() => {
    if (webgl === false) useShipBuilderStore.getState().endTrial();
  }, [webgl]);
  useEffect(() => () => useShipBuilderStore.getState().endTrial(), []);

  function handleDrawerOpenChange(side: DrawerSide, open: boolean) {
    setOpenDrawer((current) =>
      open ? side : current === side ? null : current
    );
  }

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden overscroll-none select-none bg-slate-100 [-webkit-touch-callout:none] text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div hidden={inFocus}>
        <AppHeader />
      </div>

      <div className="relative flex min-h-0 flex-1">
        {openDrawer && !inFocus && (
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
          hidden={inFocus}
          collapsed={collapsed.left}
          onCollapsedChange={() => collapsed.toggle("left")}
        >
          {isTrialActive && (
            <p
              role="note"
              className="m-3 rounded-lg bg-sky-50 p-3 text-sm text-sky-900 dark:bg-sky-950 dark:text-sky-200"
            >
              Building is paused during the sea trial.
            </p>
          )}
          {/* Inert, not hidden: the parts stay in view but cannot be picked. */}
          <div
            inert={isTrialActive}
            className={isTrialActive ? "opacity-50" : undefined}
          >
            <CatalogPanel
              onPick={() => setOpenDrawer((d) => (d === "left" ? null : d))}
            />
          </div>
        </Drawer>
        <main className="relative isolate min-w-0 flex-1">
          {webgl === false ? <WebGLFallback /> : webgl ? <Scene /> : null}
          {!inFocus && <ViewControls />}
          <Notice />
          <RemovalConfirm />
          <SelectionBar />
          <PlacementHint onOpenColours={() => setOpenDrawer("left")} />
          {/* The trial plays in the 3D scene, so it needs WebGL. */}
          {webgl && <SeaTrialButton />}
          {webgl && <IcebergAimHint />}
          <SeaTrialStatus />
          {webgl && <BelowDeckInset />}
          <SeaTrialResult />
          {!inFocus && <HelpButton />}
          {!inFocus && <UndoRedo />}
        </main>
        <Drawer
          side="right"
          label="Stats"
          toggleContent={<StatsHud />}
          open={openDrawer === "right"}
          onOpenChange={(open) => handleDrawerOpenChange("right", open)}
          hidden={inFocus}
          collapsed={collapsed.right}
          onCollapsedChange={() => collapsed.toggle("right")}
        >
          <StatsPanel />
        </Drawer>
      </div>
    </div>
  );
}
