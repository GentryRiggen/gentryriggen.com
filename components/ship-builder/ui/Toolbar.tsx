"use client";

import { useRef, useState } from "react";
import { getPartDef } from "@/lib/ship-builder/model/catalog";
import { MAX_SEGMENTS, MIN_SEGMENTS } from "@/lib/ship-builder/model/grid";
import { MAX_NAME_LENGTH } from "@/lib/ship-builder/model/placement";
import { saveShip } from "@/lib/ship-builder/persist/local";
import {
  useShipBuilderStore,
  type CameraView,
} from "@/lib/ship-builder/state/store";
import MyShipsDialog from "./MyShipsDialog";
import ShareButton from "./ShareButton";
import {
  buttonClass,
  inputClass,
  panelClass,
  primaryButtonClass,
} from "./styles";

const CAMERA_VIEWS: { view: CameraView; label: string; ariaLabel: string }[] = [
  { view: "side", label: "Side", ariaLabel: "Side view" },
  { view: "top", label: "Top", ariaLabel: "Top view" },
  { view: "three-quarter", label: "¾", ariaLabel: "Three-quarter view" },
];

export default function Toolbar() {
  const [shipsOpen, setShipsOpen] = useState(false);
  const myShipsButtonRef = useRef<HTMLButtonElement>(null);
  const ship = useShipBuilderStore((s) => s.ship);
  const tool = useShipBuilderStore((s) => s.tool);
  const savedId = useShipBuilderStore((s) => s.savedId);
  const selectedId = useShipBuilderStore((s) => s.selectedId);
  const canUndo = useShipBuilderStore((s) => s.past.length > 0);
  const canRedo = useShipBuilderStore((s) => s.future.length > 0);
  const rename = useShipBuilderStore((s) => s.rename);
  const changeHullLength = useShipBuilderStore((s) => s.changeHullLength);
  const undo = useShipBuilderStore((s) => s.undo);
  const redo = useShipBuilderStore((s) => s.redo);
  const rotate = useShipBuilderStore((s) => s.rotate);
  const requestDelete = useShipBuilderStore((s) => s.requestDelete);
  const setCameraView = useShipBuilderStore((s) => s.setCameraView);
  const newShip = useShipBuilderStore((s) => s.newShip);
  const markSaved = useShipBuilderStore((s) => s.markSaved);
  const setNotice = useShipBuilderStore((s) => s.setNotice);

  const segments = ship.hull.lengthSegments;
  const canRotate =
    tool.kind === "place" && getPartDef(tool.type).placement === "grid";

  function handleSave() {
    const saved = saveShip(ship, savedId);
    if (saved) {
      markSaved(saved.id);
      setNotice("Saved to My Ships");
    } else {
      setNotice("Couldn't save — browser storage is unavailable");
    }
  }

  function handleShipsClose() {
    setShipsOpen(false);
    myShipsButtonRef.current?.focus();
  }

  return (
    <footer
      className={`flex flex-wrap items-center gap-2 border-t px-3 py-2 ${panelClass}`}
    >
      <input
        aria-label="Ship name"
        value={ship.name}
        maxLength={MAX_NAME_LENGTH}
        onChange={(event) => rename(event.target.value)}
        className={`w-44 ${inputClass}`}
      />

      <div
        role="group"
        aria-label="Hull length"
        className="flex items-center gap-1"
      >
        <button
          type="button"
          aria-label="Shorten hull"
          disabled={segments <= MIN_SEGMENTS}
          onClick={() => changeHullLength(-1)}
          className={buttonClass}
        >
          −
        </button>
        <span
          data-testid="hull-length"
          className="w-24 text-center text-sm tabular-nums"
        >
          {segments} segments
        </span>
        <button
          type="button"
          aria-label="Lengthen hull"
          disabled={segments >= MAX_SEGMENTS}
          onClick={() => changeHullLength(1)}
          className={buttonClass}
        >
          +
        </button>
      </div>

      <div className="flex items-center gap-1">
        <button
          type="button"
          disabled={!canUndo}
          onClick={undo}
          className={buttonClass}
        >
          Undo
        </button>
        <button
          type="button"
          disabled={!canRedo}
          onClick={redo}
          className={buttonClass}
        >
          Redo
        </button>
        <button
          type="button"
          disabled={!canRotate}
          onClick={rotate}
          className={buttonClass}
        >
          Rotate
        </button>
        <button
          type="button"
          disabled={!selectedId}
          onClick={requestDelete}
          className={buttonClass}
        >
          Delete
        </button>
      </div>

      <div role="group" aria-label="Camera" className="flex items-center gap-1">
        {CAMERA_VIEWS.map(({ view, label, ariaLabel }) => (
          <button
            key={view}
            type="button"
            aria-label={ariaLabel}
            onClick={() => setCameraView(view)}
            className={buttonClass}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="ml-auto flex items-center gap-1">
        <button type="button" onClick={newShip} className={buttonClass}>
          New
        </button>
        <button
          type="button"
          onClick={handleSave}
          className={primaryButtonClass}
        >
          Save
        </button>
        <ShareButton />
        <button
          ref={myShipsButtonRef}
          type="button"
          onClick={() => setShipsOpen(true)}
          className={buttonClass}
        >
          My Ships
        </button>
      </div>

      {shipsOpen && <MyShipsDialog onClose={handleShipsClose} />}
    </footer>
  );
}
