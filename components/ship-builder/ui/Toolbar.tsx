"use client";

import {
  ArrowDownToLine,
  ArrowLeftRight,
  ArrowUpDown,
  Box,
  CloudLightning,
  ChevronsLeftRight,
  ChevronsRightLeft,
  Eye,
  FilePlus,
  Paintbrush,
  Minus,
  Plus,
  Redo2,
  RotateCw,
  Sailboat,
  Save,
  Ship,
  Trash2,
  Undo2,
  Waves,
  Wind,
  type LucideIcon,
} from "lucide-react";
import { useRef, useState } from "react";
import { getPartDef } from "@/lib/ship-builder/model/catalog";
import {
  MAX_BEAM,
  MAX_SEGMENTS,
  MIN_BEAM,
  MIN_SEGMENTS,
} from "@/lib/ship-builder/model/grid";
import { MAX_NAME_LENGTH } from "@/lib/ship-builder/model/placement";
import { saveShip } from "@/lib/ship-builder/persist/local";
import {
  useShipBuilderStore,
  type CameraView,
} from "@/lib/ship-builder/state/store";
import useSeaState from "../hooks/useSeaState";
import type { SeaState } from "../scene/seaState";
import MyShipsDialog from "./MyShipsDialog";
import NewShipDialog from "./NewShipDialog";
import ShareButton from "./ShareButton";
import {
  buttonClass,
  inputClass,
  panelClass,
  pressedButtonClass,
  primaryButtonClass,
} from "./styles";

const CAMERA_VIEWS: {
  view: CameraView;
  label: string;
  ariaLabel: string;
  Icon: LucideIcon;
}[] = [
  { view: "side", label: "Side", ariaLabel: "Side view", Icon: Eye },
  { view: "top", label: "Top", ariaLabel: "Top view", Icon: ArrowDownToLine },
  {
    view: "three-quarter",
    label: "¾",
    ariaLabel: "Three-quarter view",
    Icon: Box,
  },
  { view: "below", label: "Below", ariaLabel: "Below view", Icon: Waves },
];

const SEA_STATES: {
  sea: SeaState;
  label: string;
  ariaLabel: string;
  Icon: LucideIcon;
}[] = [
  { sea: "calm", label: "Calm", ariaLabel: "Calm sea", Icon: Sailboat },
  { sea: "choppy", label: "Choppy", ariaLabel: "Choppy sea", Icon: Wind },
  {
    sea: "stormy",
    label: "Stormy",
    ariaLabel: "Stormy sea",
    Icon: CloudLightning,
  },
];

/** The colour a fresh trip into paint mode starts with. */
const DEFAULT_PAINT_COLOR = "red";

const ICON_CLASS = "h-4 w-4 shrink-0";
// Icons carry the meaning on a phone; the words stay for screen readers.
const LABEL_CLASS = "sr-only sm:not-sr-only";

interface ButtonLabelProps {
  Icon: LucideIcon;
  children: string;
}

function ButtonLabel({ Icon, children }: ButtonLabelProps) {
  return (
    <>
      <Icon aria-hidden="true" className={ICON_CLASS} />
      <span className={LABEL_CLASS}>{children}</span>
    </>
  );
}

export default function Toolbar() {
  const { seaState, setSeaState } = useSeaState();
  const [shipsOpen, setShipsOpen] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const newButtonRef = useRef<HTMLButtonElement>(null);
  const myShipsButtonRef = useRef<HTMLButtonElement>(null);
  const ship = useShipBuilderStore((s) => s.ship);
  const tool = useShipBuilderStore((s) => s.tool);
  const savedId = useShipBuilderStore((s) => s.savedId);
  const selectedId = useShipBuilderStore((s) => s.selectedId);
  const cameraView = useShipBuilderStore((s) => s.camera.view);
  const canUndo = useShipBuilderStore((s) => s.past.length > 0);
  const canRedo = useShipBuilderStore((s) => s.future.length > 0);
  const rename = useShipBuilderStore((s) => s.rename);
  const changeHullLength = useShipBuilderStore((s) => s.changeHullLength);
  const changeBeam = useShipBuilderStore((s) => s.changeBeam);
  const undo = useShipBuilderStore((s) => s.undo);
  const redo = useShipBuilderStore((s) => s.redo);
  const rotate = useShipBuilderStore((s) => s.rotate);
  const selectPaint = useShipBuilderStore((s) => s.selectPaint);
  const cancel = useShipBuilderStore((s) => s.cancel);
  const requestDelete = useShipBuilderStore((s) => s.requestDelete);
  const setCameraView = useShipBuilderStore((s) => s.setCameraView);
  const markSaved = useShipBuilderStore((s) => s.markSaved);
  const setNotice = useShipBuilderStore((s) => s.setNotice);

  const segments = ship.hull.lengthSegments;
  const { beam } = ship.hull;
  const isPainting = tool.kind === "paint";
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

  function handleNewClose() {
    setNewOpen(false);
    newButtonRef.current?.focus();
  }

  return (
    <footer
      className={`flex flex-wrap items-center gap-2 border-t px-3 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] ${panelClass}`}
    >
      <input
        aria-label="Ship name"
        value={ship.name}
        maxLength={MAX_NAME_LENGTH}
        onChange={(event) => rename(event.target.value)}
        // Global shortcuts ignore inputs; blurring lets the next Esc reach them.
        onKeyDown={(event) => {
          if (event.key === "Escape") event.currentTarget.blur();
        }}
        className={`w-44 ${inputClass}`}
      />

      <div
        role="group"
        aria-label="Hull length"
        className="flex items-center gap-1"
      >
        <ArrowLeftRight
          aria-hidden="true"
          className={`${ICON_CLASS} text-slate-500 dark:text-slate-400`}
        />
        <button
          type="button"
          aria-label="Shorten hull"
          disabled={segments <= MIN_SEGMENTS}
          onClick={() => changeHullLength(-1)}
          className={buttonClass}
        >
          <Minus aria-hidden="true" className={ICON_CLASS} />
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
          <Plus aria-hidden="true" className={ICON_CLASS} />
        </button>
      </div>

      <div role="group" aria-label="Beam" className="flex items-center gap-1">
        <ArrowUpDown
          aria-hidden="true"
          className={`${ICON_CLASS} text-slate-500 dark:text-slate-400`}
        />
        <button
          type="button"
          aria-label="Narrower"
          disabled={beam <= MIN_BEAM}
          onClick={() => changeBeam(-1)}
          className={buttonClass}
        >
          <ChevronsRightLeft aria-hidden="true" className={ICON_CLASS} />
        </button>
        <span
          data-testid="beam-width"
          className="w-16 text-center text-sm tabular-nums"
        >
          {beam} wide
        </span>
        <button
          type="button"
          aria-label="Wider"
          disabled={beam >= MAX_BEAM}
          onClick={() => changeBeam(1)}
          className={buttonClass}
        >
          <ChevronsLeftRight aria-hidden="true" className={ICON_CLASS} />
        </button>
      </div>

      <div className="flex items-center gap-1">
        <button
          type="button"
          disabled={!canUndo}
          onClick={undo}
          className={buttonClass}
        >
          <ButtonLabel Icon={Undo2}>Undo</ButtonLabel>
        </button>
        <button
          type="button"
          disabled={!canRedo}
          onClick={redo}
          className={buttonClass}
        >
          <ButtonLabel Icon={Redo2}>Redo</ButtonLabel>
        </button>
        <button
          type="button"
          disabled={!canRotate}
          onClick={rotate}
          className={buttonClass}
        >
          <ButtonLabel Icon={RotateCw}>Rotate</ButtonLabel>
        </button>
        <button
          type="button"
          disabled={!selectedId}
          onClick={requestDelete}
          className={buttonClass}
        >
          <ButtonLabel Icon={Trash2}>Delete</ButtonLabel>
        </button>
        <button
          type="button"
          aria-pressed={isPainting}
          onClick={() =>
            isPainting ? cancel() : selectPaint(DEFAULT_PAINT_COLOR)
          }
          className={isPainting ? pressedButtonClass : buttonClass}
        >
          <ButtonLabel Icon={Paintbrush}>Paint</ButtonLabel>
        </button>
      </div>

      <div role="group" aria-label="Camera" className="flex items-center gap-1">
        {CAMERA_VIEWS.map(({ view, label, ariaLabel, Icon }) => (
          <button
            key={view}
            type="button"
            aria-label={ariaLabel}
            aria-pressed={cameraView === view}
            onClick={() => setCameraView(view)}
            className={cameraView === view ? pressedButtonClass : buttonClass}
          >
            <ButtonLabel Icon={Icon}>{label}</ButtonLabel>
          </button>
        ))}
      </div>

      <div role="group" aria-label="Sea" className="flex items-center gap-1">
        {SEA_STATES.map(({ sea, label, ariaLabel, Icon }) => (
          <button
            key={sea}
            type="button"
            aria-label={ariaLabel}
            aria-pressed={seaState === sea}
            onClick={() => setSeaState(sea)}
            className={seaState === sea ? pressedButtonClass : buttonClass}
          >
            <ButtonLabel Icon={Icon}>{label}</ButtonLabel>
          </button>
        ))}
      </div>

      <div className="ml-auto flex items-center gap-1">
        <button
          ref={newButtonRef}
          type="button"
          aria-haspopup="dialog"
          onClick={() => setNewOpen(true)}
          className={buttonClass}
        >
          <ButtonLabel Icon={FilePlus}>New</ButtonLabel>
        </button>
        <button
          type="button"
          onClick={handleSave}
          className={primaryButtonClass}
        >
          <ButtonLabel Icon={Save}>Save</ButtonLabel>
        </button>
        <ShareButton />
        <button
          ref={myShipsButtonRef}
          type="button"
          onClick={() => setShipsOpen(true)}
          className={buttonClass}
        >
          <ButtonLabel Icon={Ship}>My Ships</ButtonLabel>
        </button>
      </div>

      {shipsOpen && <MyShipsDialog onClose={handleShipsClose} />}
      {newOpen && <NewShipDialog onClose={handleNewClose} />}
    </footer>
  );
}
