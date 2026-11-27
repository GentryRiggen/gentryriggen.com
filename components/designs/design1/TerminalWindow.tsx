"use client";

import type { ReactNode } from "react";

interface TerminalWindowProps {
  title?: string;
  children: ReactNode;
  onClick?: () => void;
  onKill?: () => void;
  onMinimize?: () => void;
  onFullscreen?: () => void;
  isFullscreen?: boolean;
}

export default function TerminalWindow({
  title = "gentry@portfolio:~",
  children,
  onClick,
  onKill,
  onMinimize,
  onFullscreen,
  isFullscreen = false,
}: TerminalWindowProps) {
  return (
    <div
      className={`group w-full overflow-clip border-term-border shadow-2xl shadow-black/10 transition-[border-color,box-shadow] duration-300 focus-within:border-term-accent/60 focus-within:shadow-[0_0_30px_color-mix(in_srgb,var(--term-accent)_20%,transparent)] flex flex-col flex-1 sm:flex-initial ${isFullscreen ? "border-0" : "border-y sm:border sm:rounded-lg"}`}
    >
      {/* Title bar */}
      <div className="sticky top-0 z-10 flex items-center gap-2 px-4 py-2.5 bg-term-bar border-b border-term-border transition-[border-color] duration-300">
        <div className="flex gap-1.5">
          <button
            type="button"
            aria-label="Close terminal"
            onClick={(e) => {
              e.stopPropagation();
              onKill?.();
            }}
            className="group/btn w-3 h-3 rounded-full bg-red-500/50 transition-colors duration-300 group-focus-within:bg-red-500/80 hover:bg-red-500 flex items-center justify-center"
          >
            <span className="hidden group-hover/btn:block text-[8px] leading-none font-bold text-red-900">
              &times;
            </span>
          </button>
          <button
            type="button"
            aria-label="Minimize terminal"
            onClick={(e) => {
              e.stopPropagation();
              onMinimize?.();
            }}
            className="group/btn w-3 h-3 rounded-full bg-yellow-500/50 transition-colors duration-300 group-focus-within:bg-yellow-500/80 hover:bg-yellow-500 flex items-center justify-center"
          >
            <span className="hidden group-hover/btn:block text-[8px] leading-none font-bold text-yellow-900">
              &minus;
            </span>
          </button>
          <button
            type="button"
            aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
            onClick={(e) => {
              e.stopPropagation();
              onFullscreen?.();
            }}
            className="group/btn w-3 h-3 rounded-full bg-green-500/50 transition-colors duration-300 group-focus-within:bg-green-500/80 hover:bg-green-500 flex items-center justify-center"
          >
            <span className="hidden group-hover/btn:block text-[8px] leading-none font-bold text-green-900">
              {isFullscreen ? "↙" : "↗"}
            </span>
          </button>
        </div>
        <span className="ml-2 text-xs font-mono text-term-muted transition-colors duration-300 group-focus-within:text-term-fg">
          {title}
        </span>
      </div>
      {/* Terminal body - click anywhere to focus input */}
      <div
        onClick={onClick}
        className={`bg-term-bg p-4 sm:p-6 font-mono text-sm leading-relaxed flex-1 sm:flex-initial sm:min-h-[200px] overflow-y-auto overflow-x-auto cursor-text ${isFullscreen ? "" : "sm:max-h-[80vh]"}`}
      >
        {children}
      </div>
    </div>
  );
}
