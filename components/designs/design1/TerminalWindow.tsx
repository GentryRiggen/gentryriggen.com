"use client";

import type { ReactNode } from "react";

interface TerminalWindowProps {
  title?: string;
  children: ReactNode;
  onClick?: () => void;
}

export default function TerminalWindow({
  title = "gentry@portfolio:~",
  children,
  onClick,
}: TerminalWindowProps) {
  return (
    <div className="group w-full rounded-lg overflow-hidden border border-gray-300 dark:border-green-500/30 shadow-2xl shadow-green-500/5 dark:shadow-green-500/10 transition-[border-color,box-shadow] duration-300 focus-within:border-green-500/70 dark:focus-within:border-green-400/60 focus-within:shadow-[0_0_30px_rgba(34,197,94,0.25),0_4px_20px_rgba(0,0,0,0.15)] dark:focus-within:shadow-[0_0_30px_rgba(34,197,94,0.2)]">
      {/* Title bar */}
      <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-200 dark:bg-gray-900 border-b border-gray-300 dark:border-green-500/20 transition-[border-color] duration-300">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-500/50 transition-colors duration-300 group-focus-within:bg-red-500/80" />
          <div className="w-3 h-3 rounded-full bg-yellow-500/50 transition-colors duration-300 group-focus-within:bg-yellow-500/80" />
          <div className="w-3 h-3 rounded-full bg-green-500/50 transition-colors duration-300 group-focus-within:bg-green-500/80" />
        </div>
        <span className="ml-2 text-xs font-mono text-gray-400 dark:text-green-500/40 transition-colors duration-300 group-focus-within:text-gray-600 dark:group-focus-within:text-green-500/80">
          {title}
        </span>
      </div>
      {/* Terminal body - click anywhere to focus input */}
      <div
        onClick={onClick}
        className="bg-gray-50 dark:bg-black p-5 sm:p-6 font-mono text-sm leading-relaxed min-h-[200px] max-h-[80vh] overflow-y-auto overflow-x-auto cursor-text"
      >
        {children}
      </div>
    </div>
  );
}
