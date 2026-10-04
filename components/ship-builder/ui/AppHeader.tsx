"use client";

import { FilePlus, Save, Ship, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";
import ThemeToggle from "@/components/ThemeToggle";
import { MAX_NAME_LENGTH } from "@/lib/ship-builder/model/placement";
import { saveShip } from "@/lib/ship-builder/persist/local";
import { useShipBuilderStore } from "@/lib/ship-builder/state/store";
import { SHIP_BUILDER_VERSION } from "@/lib/ship-builder/version";
import MyShipsDialog from "./MyShipsDialog";
import NewShipDialog from "./NewShipDialog";
import ShareButton from "./ShareButton";
import { buttonClass, inputClass, primaryButtonClass } from "./styles";

// 44px square at minimum, the comfortable touch size on an iPad.
const TOUCH_CLASS = "min-h-11 min-w-11";

interface ButtonLabelProps {
  Icon: LucideIcon;
  children: string;
}

// Icons carry the meaning on a phone; the words stay for screen readers.
function ButtonLabel({ Icon, children }: ButtonLabelProps) {
  return (
    <>
      <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
      <span className="sr-only lg:not-sr-only">{children}</span>
    </>
  );
}

export default function AppHeader() {
  const [shipsOpen, setShipsOpen] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const newButtonRef = useRef<HTMLButtonElement>(null);
  const myShipsButtonRef = useRef<HTMLButtonElement>(null);
  const ship = useShipBuilderStore((s) => s.ship);
  const savedId = useShipBuilderStore((s) => s.savedId);
  const rename = useShipBuilderStore((s) => s.rename);
  const markSaved = useShipBuilderStore((s) => s.markSaved);
  const setNotice = useShipBuilderStore((s) => s.setNotice);

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
    <header className="relative flex flex-wrap sm:flex-nowrap items-center gap-x-2 gap-y-1 border-b border-slate-200 bg-white px-2 pt-[calc(0.5rem+env(safe-area-inset-top))] pb-2 sm:gap-3 sm:px-4 dark:border-slate-800 dark:bg-slate-900">
      <Link
        href="/"
        aria-label="Back to gentryriggen.com"
        className="inline-flex min-h-11 shrink-0 items-center text-sm text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
      >
        <span aria-hidden="true">←</span>
        <span className="ml-1 hidden xl:inline">gentryriggen.com</span>
      </Link>
      {/* Below sm the name field takes the room, so the title is spoken only. */}
      <h1 className="sr-only shrink-0 text-lg font-semibold sm:not-sr-only">
        Ship Builder
      </h1>
      <Link
        href="/ship-builder/versions"
        data-testid="app-version"
        aria-label={`Version ${SHIP_BUILDER_VERSION}: what's new`}
        className="-ml-1 hidden shrink-0 text-xs text-slate-500 underline-offset-2 hover:text-slate-900 hover:underline sm:inline dark:text-slate-400 dark:hover:text-slate-100"
      >
        v{SHIP_BUILDER_VERSION}
      </Link>
      <span
        aria-hidden="true"
        className="hidden text-slate-300 sm:inline dark:text-slate-700"
      >
        |
      </span>
      <input
        aria-label="Ship name"
        value={ship.name}
        maxLength={MAX_NAME_LENGTH}
        onChange={(event) => rename(event.target.value)}
        // Global shortcuts ignore inputs; blurring lets the next Esc reach them.
        onKeyDown={(event) => {
          if (event.key === "Escape") event.currentTarget.blur();
        }}
        className={`order-last min-h-11 w-full min-w-0 sm:order-none sm:w-48 sm:flex-none ${inputClass}`}
      />

      <div className="ml-auto flex shrink-0 items-center gap-1">
        <button
          ref={newButtonRef}
          type="button"
          aria-haspopup="dialog"
          onClick={() => setNewOpen(true)}
          className={`${buttonClass} ${TOUCH_CLASS}`}
        >
          <ButtonLabel Icon={FilePlus}>New</ButtonLabel>
        </button>
        <button
          type="button"
          onClick={handleSave}
          className={`${primaryButtonClass} ${TOUCH_CLASS}`}
        >
          <ButtonLabel Icon={Save}>Save</ButtonLabel>
        </button>
        <ShareButton className={TOUCH_CLASS} />
        <button
          ref={myShipsButtonRef}
          type="button"
          onClick={() => setShipsOpen(true)}
          className={`${buttonClass} ${TOUCH_CLASS}`}
        >
          <ButtonLabel Icon={Ship}>My Ships</ButtonLabel>
        </button>
      </div>
      <ThemeToggle inline />

      {shipsOpen && <MyShipsDialog onClose={handleShipsClose} />}
      {newOpen && <NewShipDialog onClose={handleNewClose} />}
    </header>
  );
}
