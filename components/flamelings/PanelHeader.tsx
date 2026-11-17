import type { ReactNode } from "react";
import FlIcon, { type FlIconName } from "./FlIcon";
import { DISPLAY } from "./styles";

interface PanelHeaderProps {
  icon: FlIconName;
  /** The badge colour behind the icon (the dock's colour for white icons). */
  iconClass?: string;
  title: string;
  /** The heading level: h1 for a whole screen, h2 for a panel over one. */
  level?: 1 | 2;
  /** What sits on the left, before the title (a back button). */
  lead?: ReactNode;
  /** What sits on the right: the spark pill, buttons, Done. */
  children?: ReactNode;
}

/** The top row of a full-screen panel: a big storybook title and its icon. */
export default function PanelHeader({
  icon,
  iconClass = "bg-[#fff6e6]",
  title,
  level = 2,
  lead,
  children,
}: PanelHeaderProps) {
  const Heading = level === 1 ? "h1" : "h2";
  return (
    <header className="flex items-center gap-2 py-2 sm:gap-3">
      {lead}
      <Heading
        className={`${DISPLAY} flex min-w-0 flex-1 items-center gap-2 text-2xl font-bold tracking-tight text-[#7a3d2c] min-[400px]:text-3xl sm:gap-3 sm:text-4xl dark:text-[#ffe6c4] dark:[text-shadow:0_0_20px_rgba(255,150,60,.45)]`}
      >
        <span
          aria-hidden="true"
          className={`grid size-11 shrink-0 place-items-center rounded-2xl border-[3px] border-[#fff6e6] shadow-[inset_0_-4px_0_rgba(0,0,0,.15),0_4px_12px_rgba(30,10,40,.22)] sm:size-14 ${iconClass}`}
        >
          <FlIcon name={icon} className="size-7 sm:size-9" />
        </span>
        <span className="min-w-0 leading-none">{title}</span>
      </Heading>
      {children && (
        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          {children}
        </div>
      )}
    </header>
  );
}
