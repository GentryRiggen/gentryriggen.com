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
      className={`group w-full overflow-clip border-gray-300 dark:border-green-500/30 shadow-2xl shadow-green-500/5 dark:shadow-green-500/10 transition-[border-color,box-shadow] duration-300 focus-within:border-green-500/70 dark:focus-within:border-green-400/60 focus-within:shadow-[0_0_30px_rgba(34,197,94,0.25),0_4px_20px_rgba(0,0,0,0.15)] dark:focus-within:shadow-[0_0_30px_rgba(34,197,94,0.2)] flex flex-col flex-1 sm:flex-initial ${isFullscreen ? "border-0" : "border-y sm:border sm:rounded-lg"}`}
    >
      {/* Title bar */}
      <div className="sticky top-0 z-10 flex items-center gap-2 px-4 py-2.5 bg-gray-200 dark:bg-gray-900 border-b border-gray-300 dark:border-green-500/20 transition-[border-color] duration-300">
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
        <span className="ml-2 text-xs font-mono text-gray-400 dark:text-green-500/40 transition-colors duration-300 group-focus-within:text-gray-600 dark:group-focus-within:text-green-500/80">
          {title}
        </span>
      </div>
      {/* Terminal body - click anywhere to focus input */}
      <div
        onClick={onClick}
        className={`bg-gray-50 dark:bg-black p-4 sm:p-6 font-mono text-sm leading-relaxed flex-1 sm:flex-initial sm:min-h-[200px] overflow-y-auto overflow-x-auto cursor-text ${isFullscreen ? "" : "sm:max-h-[80vh]"}`}
      >
        {children}
      </div>
    </div>
  );
}
