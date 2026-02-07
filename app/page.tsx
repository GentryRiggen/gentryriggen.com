"use client";

import { useState, useCallback } from "react";
import ThemeToggle from "@/components/ThemeToggle";
import Terminal from "@/components/designs/design1/Terminal";

type TerminalState = "normal" | "fullscreen" | "minimized" | "killed";

export default function Home() {
  const [terminalState, setTerminalState] = useState<TerminalState>("normal");
  // Key to force re-mount Terminal on relaunch (replays boot sequence)
  const [terminalKey, setTerminalKey] = useState(0);

  const handleKill = useCallback(() => {
    setTerminalState("killed");
  }, []);

  const handleMinimize = useCallback(() => {
    setTerminalState("minimized");
  }, []);

  const handleFullscreen = useCallback(() => {
    setTerminalState((prev) =>
      prev === "fullscreen" ? "normal" : "fullscreen"
    );
  }, []);

  const handleRelaunch = useCallback(() => {
    setTerminalState("normal");
    setTerminalKey((prev) => prev + 1);
  }, []);

  const isHidden = terminalState === "minimized" || terminalState === "killed";

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950 text-gray-900 dark:text-green-400 transition-colors font-mono">
      {/* Subtle scanline overlay for CRT effect in dark mode */}
      <div
        className="fixed inset-0 pointer-events-none z-10 opacity-0 dark:opacity-[0.03]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, transparent, transparent 1px, rgba(0,0,0,0.3) 1px, rgba(0,0,0,0.3) 2px)",
          backgroundSize: "100% 2px",
        }}
        aria-hidden="true"
      />

      {/* Background grid pattern */}
      <div
        className="fixed inset-0 pointer-events-none z-0 opacity-[0.03] dark:opacity-[0.04]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(34,197,94,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(34,197,94,0.4) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
        aria-hidden="true"
      />

      <ThemeToggle />

      {/* Dock-style relaunch UI — shown at bottom center when minimized or killed */}
      {isHidden && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-20">
          <button
            type="button"
            onClick={handleRelaunch}
            className="animate-scaleUp group flex flex-col items-center gap-2 px-5 py-3 rounded-2xl border border-gray-300 dark:border-green-500/30 bg-gray-100/80 dark:bg-gray-900/80 backdrop-blur-sm hover:border-green-500/60 dark:hover:border-green-400/60 hover:shadow-[0_0_30px_rgba(34,197,94,0.15)] dark:hover:shadow-[0_0_30px_rgba(34,197,94,0.2)] transition-all duration-300 cursor-pointer hover:scale-110"
          >
            {/* Mini terminal icon */}
            <div className="w-12 h-9 rounded border border-gray-300 dark:border-green-500/40 overflow-hidden">
              <div className="flex items-center gap-0.5 px-1.5 py-0.5 bg-gray-200 dark:bg-gray-800 border-b border-gray-300 dark:border-green-500/20">
                <div className="w-1 h-1 rounded-full bg-red-500/60" />
                <div className="w-1 h-1 rounded-full bg-yellow-500/60" />
                <div className="w-1 h-1 rounded-full bg-green-500/60" />
              </div>
              <div className="p-1 bg-gray-50 dark:bg-black">
                <div className="w-4 h-0.5 bg-green-500/40 rounded-full mb-0.5" />
                <div className="w-3 h-0.5 bg-green-500/30 rounded-full" />
              </div>
            </div>
            <p className="text-[10px] font-mono text-gray-400 dark:text-green-500/50 group-hover:text-green-500 dark:group-hover:text-green-400 transition-colors">
              {terminalState === "killed" ? "Closed" : "Minimized"}
            </p>
          </button>
        </div>
      )}

      {/* Normal / Fullscreen terminal */}
      {!isHidden && (
        <>
          {terminalState === "fullscreen" ? (
            <div className="fixed inset-0 z-50 bg-white dark:bg-gray-950 flex flex-col">
              <Terminal
                key={terminalKey}
                onKill={handleKill}
                onMinimize={handleMinimize}
                onFullscreen={handleFullscreen}
                isFullscreen
              />
            </div>
          ) : (
            <main className="relative z-10 min-h-[100dvh] sm:min-h-0 max-w-3xl mx-auto px-0 sm:px-6 py-0 sm:py-16 flex flex-col">
              <Terminal
                key={terminalKey}
                onKill={handleKill}
                onMinimize={handleMinimize}
                onFullscreen={handleFullscreen}
              />

              {/* Footer / copyright */}
              <footer className="py-4 sm:mt-8 text-center text-xs text-gray-400 dark:text-green-500/40 font-mono">
                <p>&copy; {new Date().getFullYear()} Gentry Riggen</p>
              </footer>
            </main>
          )}
        </>
      )}
    </div>
  );
}
