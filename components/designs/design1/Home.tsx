"use client";

import { useState, useCallback } from "react";
import { ShippedProvider } from "@/components/designs/design1/ShippedContext";
import type { ShippedSummary } from "@/components/designs/design1/releases";
import Terminal from "@/components/designs/design1/Terminal";
import { GAMES } from "@/components/designs/design1/games";
import ThemeMenu from "@/components/designs/design1/ThemeMenu";
import { TerminalThemeProvider } from "@/components/designs/design1/terminalTheme";

type TerminalState = "normal" | "fullscreen" | "minimized" | "killed";

interface HomeProps {
  shipped: ShippedSummary;
}

/** The homepage, below app/page.tsx (which reads the changelogs). */
export default function Home({ shipped }: HomeProps) {
  return (
    <ShippedProvider shipped={shipped}>
      <TerminalThemeProvider>
        <HomeContent />
      </TerminalThemeProvider>
    </ShippedProvider>
  );
}

function HomeContent() {
  const [terminalState, setTerminalState] = useState<TerminalState>("normal");
  // Bumped when a closed terminal is reopened: a fresh program replays the
  // boot. Minimize and fullscreen keep the same running terminal.
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
    if (terminalState === "killed") setTerminalKey((prev) => prev + 1);
    setTerminalState("normal");
  }, [terminalState]);

  const isHidden = terminalState === "minimized" || terminalState === "killed";

  return (
    <div className="min-h-screen bg-term-page text-term-fg transition-colors font-mono">
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

      {/* SEO: Hidden content for search engines and screen readers */}
      <div className="sr-only">
        <h1>Gentry Riggen — Software Leader & Developer</h1>
        <p>
          I build products and lead teams using React, Next.js, Node.js,
          TypeScript, Tailwind CSS, Postgres, Prisma, GraphQL, Docker,
          Terraform, GitHub Actions, and more. Focused on leading projects and
          empowering teams to ship exceptional work while still getting hands
          dirty with code.
        </p>
        <h2>Side projects</h2>
        <p>Games I build for (and get QA&apos;d by) my two boys:</p>
        <ul>
          {GAMES.map((game) => (
            <li key={game.id}>
              <a href={game.href}>{game.name}</a>: {game.tagline}
            </li>
          ))}
        </ul>
        <h2>Skills</h2>
        <ul>
          <li>Languages: TypeScript, JavaScript, SQL, HTML/CSS</li>
          <li>Frontend: React, Next.js, Tailwind CSS, React Native</li>
          <li>Backend: Node.js, GraphQL, Prisma, Postgres</li>
          <li>DevOps: Docker, Terraform, GitHub Actions, CI/CD</li>
          <li>
            Leadership: Team Building, Architecture, Code Review, Mentorship
          </li>
        </ul>
        <h2>Connect</h2>
        <ul>
          <li>
            <a href="https://linkedin.com/in/gentryriggen">LinkedIn</a>
          </li>
          <li>
            <a href="https://github.com/gentryriggen">GitHub</a>
          </li>
        </ul>
      </div>

      <ThemeMenu />

      {/* Dock-style relaunch UI — shown at bottom center when minimized or killed */}
      {isHidden && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-20">
          <button
            type="button"
            onClick={handleRelaunch}
            className="animate-scaleUp group flex flex-col items-center gap-2 px-5 py-3 rounded-2xl border border-term-border bg-term-bar/80 backdrop-blur-sm hover:border-term-accent/60 hover:shadow-[0_0_30px_color-mix(in_srgb,var(--term-accent)_20%,transparent)] transition-all duration-300 cursor-pointer hover:scale-110"
          >
            {/* Mini terminal icon */}
            <div className="w-12 h-9 rounded border border-term-border overflow-hidden">
              <div className="flex items-center gap-0.5 px-1.5 py-0.5 bg-term-bar border-b border-term-border">
                <div className="w-1 h-1 rounded-full bg-red-500/60" />
                <div className="w-1 h-1 rounded-full bg-yellow-500/60" />
                <div className="w-1 h-1 rounded-full bg-green-500/60" />
              </div>
              <div className="p-1 bg-term-bg">
                <div className="w-4 h-0.5 bg-term-ok/60 rounded-full mb-0.5" />
                <div className="w-3 h-0.5 bg-term-ok/40 rounded-full" />
              </div>
            </div>
            <p className="text-[10px] font-mono text-term-muted group-hover:text-term-accent transition-colors">
              {terminalState === "killed" ? "Closed" : "Minimized"}
            </p>
          </button>
        </div>
      )}

      {/* One terminal for normal, fullscreen and minimized, so it keeps
          running (and keeps its history) like a real program. Closing it
          ends the program. */}
      {terminalState !== "killed" && (
        <main
          className={
            terminalState === "fullscreen"
              ? "fixed inset-0 z-50 bg-term-page flex flex-col"
              : `relative z-10 min-h-[100dvh] sm:min-h-0 max-w-3xl mx-auto px-0 sm:px-6 py-0 sm:py-16 flex flex-col ${terminalState === "minimized" ? "hidden" : ""}`
          }
        >
          <Terminal
            key={terminalKey}
            onKill={handleKill}
            onMinimize={handleMinimize}
            onFullscreen={handleFullscreen}
            isFullscreen={terminalState === "fullscreen"}
          />

          {terminalState === "normal" && (
            <footer className="py-4 sm:mt-8 text-center text-xs text-term-faint font-mono">
              <p>&copy; {new Date().getFullYear()} Gentry Riggen</p>
              <p className="mt-1 px-4 text-[10px]">
                Protected by reCAPTCHA: Google&apos;s{" "}
                <a
                  href="https://policies.google.com/privacy"
                  className="underline underline-offset-2"
                >
                  Privacy Policy
                </a>{" "}
                and{" "}
                <a
                  href="https://policies.google.com/terms"
                  className="underline underline-offset-2"
                >
                  Terms
                </a>{" "}
                apply.
              </p>
            </footer>
          )}
        </main>
      )}
    </div>
  );
}
