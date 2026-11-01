"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import UpdatePill from "@/components/update/UpdatePill";
import { useAppUpdate } from "@/components/update/useAppUpdate";
import { saveAutosave } from "@/lib/ship-builder/persist/local";
import { useShipBuilderStore } from "@/lib/ship-builder/state/store";
import useCollapsedPanels from "./hooks/useCollapsedPanels";
import useKeyboardShortcuts from "./hooks/useKeyboardShortcuts";
import useServiceWorker from "./hooks/useServiceWorker";
import usePhotoStore from "./hooks/usePhotoStore";
import useShipPersistence from "./hooks/useShipPersistence";
import { useShipBoardSync } from "./hooks/shipBoardSync";
import useTestHook from "./hooks/useTestHook";
import useWebGLSupport from "./hooks/useWebGLSupport";
import AppHeader from "./ui/AppHeader";
import CatalogPanel from "./ui/CatalogPanel";
import DriveButton from "./ui/DriveButton";
import DriveHud from "./ui/DriveHud";
import SailChallengeResult from "./ui/SailChallengeResult";
import DrivePicker from "./ui/DrivePicker";
import WalkButton from "./ui/WalkButton";
import TrialWalkButton from "./ui/TrialWalkButton";
import WalkHud from "./ui/WalkHud";
import Drawer from "./ui/Drawer";
import HelpButton from "./ui/HelpButton";
import Notice from "./ui/Notice";
import PhotoButton from "./ui/PhotoButton";
import PhotoMode from "./ui/PhotoMode";
import PlacementHint from "./ui/PlacementHint";
import RemovalConfirm from "./ui/RemovalConfirm";
import BelowDeckInset from "./ui/BelowDeckInset";
import IcebergAimHint from "./ui/IcebergAimHint";
import SeaTrialButton from "./ui/SeaTrialButton";
import TrialSetupCard from "./ui/TrialSetupCard";
import SeaTrialResult from "./ui/SeaTrialResult";
import SeaTrialStatus from "./ui/SeaTrialStatus";
import SharedShipBanner from "./ui/SharedShipBanner";
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

const VERSION_URL = "/ship-builder/version.json";
const UPDATE_PILL_WRAPPER =
  "pointer-events-none absolute inset-x-0 bottom-3 z-40 flex justify-center px-4";
const UPDATE_PILL_BUTTON =
  "pointer-events-auto inline-flex min-h-11 touch-manipulation items-center rounded-full bg-sky-600 px-5 py-2 text-sm font-semibold text-white shadow-lg hover:bg-sky-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 focus-visible:ring-offset-2 dark:bg-sky-500 dark:hover:bg-sky-400";

/** Writes the ship now, so a reload never loses the last edit. */
function saveShipNow() {
  const { ship, savedId } = useShipBuilderStore.getState();
  saveAutosave(ship, savedId);
}

export default function ShipBuilder() {
  useTestHook();
  useShipPersistence();
  useShipBoardSync();
  useKeyboardShortcuts();
  useServiceWorker();
  const { isUpdateReady, update } = useAppUpdate({
    versionUrl: VERSION_URL,
    saveNow: saveShipNow,
  });
  const webgl = useWebGLSupport();
  const collapsed = useCollapsedPanels();
  const [openDrawer, setOpenDrawer] = useState<DrawerSide | null>(null);
  const isTrialActive = useShipBuilderStore(
    (s) =>
      s.trial.status !== "idle" ||
      s.drive.status !== "idle" ||
      s.walk.status !== "idle"
  );
  // The sinking (or the sail) is the show: clear everything that is not part
  // of it.
  const inFocus = useShipBuilderStore(
    (s) =>
      s.trial.status === "running" ||
      s.trial.status === "result" ||
      s.drive.status === "sailing" ||
      s.walk.status === "walking"
  );

  // Photo mode clears the screen of everything but the picture controls.
  const isPhoto = usePhotoStore((s) => s.isOpen);
  const isChromeHidden = inFocus || isPhoto;

  // Adjusting state during render (not in an effect) so no frame shows a
  // drawer left open behind the trial.
  if (isChromeHidden && openDrawer !== null) setOpenDrawer(null);

  // A trial, a drive or a walk takes over the view, so photo mode ends.
  useEffect(() => {
    if (inFocus) usePhotoStore.getState().exit();
  }, [inFocus]);
  useEffect(() => () => usePhotoStore.getState().exit(), []);

  // The trial plays in the 3D scene: without WebGL, or once the builder is
  // gone, nothing could end it and building would stay paused.
  useEffect(() => {
    if (webgl === false) useShipBuilderStore.getState().endTrial();
  }, [webgl]);
  useEffect(() => () => useShipBuilderStore.getState().endTrial(), []);
  // Likewise the drive: it is sailed in the 3D scene.
  useEffect(() => {
    if (webgl === false) useShipBuilderStore.getState().endDrive();
  }, [webgl]);
  useEffect(() => () => useShipBuilderStore.getState().endDrive(), []);
  // And the walk: it happens in the 3D scene too.
  useEffect(() => {
    if (webgl === false) useShipBuilderStore.getState().stopWalk();
  }, [webgl]);
  useEffect(() => () => useShipBuilderStore.getState().stopWalk(), []);

  function handleDrawerOpenChange(side: DrawerSide, open: boolean) {
    setOpenDrawer((current) =>
      open ? side : current === side ? null : current
    );
  }

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden overscroll-none select-none bg-slate-100 [-webkit-touch-callout:none] text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div hidden={isChromeHidden}>
        <AppHeader />
      </div>
      {!isChromeHidden && <SharedShipBanner />}

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
          hidden={isChromeHidden}
          collapsed={collapsed.left}
          onCollapsedChange={() => collapsed.toggle("left")}
        >
          {isTrialActive && (
            <p
              role="note"
              className="m-3 rounded-lg bg-sky-50 p-3 text-sm text-sky-900 dark:bg-sky-950 dark:text-sky-200"
            >
              Building is paused while the ship is out.
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
          {!isChromeHidden && (
            <ViewControls>{webgl && <PhotoButton />}</ViewControls>
          )}
          {isPhoto && <PhotoMode />}
          <Notice />
          <RemovalConfirm />
          {!isPhoto && <SelectionBar />}
          {!isPhoto && (
            <PlacementHint onOpenColours={() => setOpenDrawer("left")} />
          )}
          {/* The trial plays in the 3D scene, so it needs WebGL. */}
          {webgl && !isPhoto && (
            <SeaTrialButton
              beside={
                <>
                  <DriveButton />
                  <WalkButton />
                </>
              }
            />
          )}
          {webgl && <DrivePicker />}
          {webgl && <DriveHud />}
          {webgl && <WalkHud />}
          {webgl && <TrialWalkButton />}
          {webgl && <TrialSetupCard />}
          {webgl && <IcebergAimHint />}
          <SeaTrialStatus />
          {webgl && <BelowDeckInset />}
          <SeaTrialResult />
          <SailChallengeResult />
          {!isChromeHidden && <HelpButton />}
          {!isChromeHidden && <UndoRedo />}
          {isUpdateReady && !isChromeHidden && !isTrialActive && (
            <UpdatePill
              onUpdate={update}
              testId="update-pill"
              label="New version ready — tap to update"
              className={UPDATE_PILL_WRAPPER}
              buttonClassName={UPDATE_PILL_BUTTON}
            />
          )}
        </main>
        <Drawer
          side="right"
          label="Stats"
          toggleContent={<StatsHud />}
          open={openDrawer === "right"}
          onOpenChange={(open) => handleDrawerOpenChange("right", open)}
          hidden={isChromeHidden}
          collapsed={collapsed.right}
          onCollapsedChange={() => collapsed.toggle("right")}
        >
          <StatsPanel />
        </Drawer>
      </div>
    </div>
  );
}
