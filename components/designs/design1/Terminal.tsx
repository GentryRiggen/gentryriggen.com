"use client";

import {
  useState,
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import usePrefersReducedMotion from "@/components/game-kit/usePrefersReducedMotion";
import About from "./About";
import InteractivePrompt from "./InteractivePrompt";
import Bio from "./Bio";
import Links from "./Links";
import Skills from "./Skills";
import Whoami from "./Whoami";
import SideProjects from "./SideProjects";
import { SPINNER_VERBS } from "./Spinner";
import Spinner from "./Spinner";
import TerminalWindow from "./TerminalWindow";
import ToolCall from "./ToolCall";
import WelcomeBox from "./WelcomeBox";
import { GAMES } from "./games";

/** How long the spinner thinks before the first and each later tool call */
const FIRST_STEP_DELAY = 900;
const STEP_DELAY = 650;

interface BootStep {
  tool: string;
  arg: string;
  content: ReactNode;
}

const BOOT_STEPS: readonly BootStep[] = [
  { tool: "Bash", arg: "whoami", content: <Whoami /> },
  { tool: "Read", arg: "bio.txt", content: <Bio /> },
  { tool: "Read", arg: "about.txt", content: <About /> },
  { tool: "Bash", arg: "ls ~/side-projects/", content: <SideProjects /> },
  { tool: "Read", arg: "skills.md", content: <Skills /> },
  { tool: "Read", arg: "links.txt", content: <Links /> },
];

interface TerminalProps {
  onKill?: () => void;
  onMinimize?: () => void;
  onFullscreen?: () => void;
  isFullscreen?: boolean;
}

export default function Terminal({
  onKill,
  onMinimize,
  onFullscreen,
  isFullscreen,
}: TerminalProps) {
  const reducedMotion = usePrefersReducedMotion();
  const [stepsShown, setStepsShown] = useState(0);
  const [isSkipped, setIsSkipped] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isCleared, setIsCleared] = useState(false);
  const startedAtRef = useRef(0);
  /** A key skipped the boot: focus the input once it exists. */
  const focusWhenReadyRef = useRef(false);
  /** The printable key that skipped the boot, so it isn't lost. */
  const [seedInput, setSeedInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const visibleSteps =
    isSkipped || reducedMotion ? BOOT_STEPS.length : stepsShown;
  const isBootComplete = visibleSteps >= BOOT_STEPS.length;

  const scrollToBottom = useCallback(() => {
    if (typeof bottomRef.current?.scrollIntoView === "function") {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, []);

  useEffect(() => {
    startedAtRef.current = Date.now();
  }, []);

  // Reveal one tool call at a time, with the spinner thinking in between.
  useEffect(() => {
    if (isBootComplete) return;
    const timeout = setTimeout(
      () => setStepsShown((n) => n + 1),
      stepsShown === 0 ? FIRST_STEP_DELAY : STEP_DELAY
    );
    return () => clearTimeout(timeout);
  }, [stepsShown, isBootComplete]);

  // Any key skips the boot; the listener goes once the prompt is up.
  useEffect(() => {
    if (isBootComplete) return;
    const skip = (e: KeyboardEvent) => {
      // Navigation, shortcuts and keys meant for a control (the theme menu,
      // a link) shouldn't skip.
      if (
        e.key === "Tab" ||
        e.key === "Shift" ||
        e.key === "Escape" ||
        e.metaKey ||
        e.ctrlKey ||
        e.altKey
      ) {
        return;
      }
      if (
        e.target instanceof Element &&
        e.target.closest("button, a, input, select, textarea")
      ) {
        return;
      }
      if (e.key.length === 1 && e.key !== " ") {
        e.preventDefault();
        setSeedInput(e.key);
      }
      focusWhenReadyRef.current = true;
      setIsSkipped(true);
    };
    window.addEventListener("keydown", skip);
    return () => window.removeEventListener("keydown", skip);
  }, [isBootComplete]);

  useEffect(() => {
    if (!isBootComplete) return;
    if (focusWhenReadyRef.current) {
      focusWhenReadyRef.current = false;
      inputRef.current?.focus();
    }
    setElapsedSeconds(
      Math.max(1, Math.round((Date.now() - startedAtRef.current) / 1000))
    );
  }, [isBootComplete]);

  // Auto-scroll as boot content appears
  useEffect(() => {
    scrollToBottom();
  }, [visibleSteps, scrollToBottom]);

  // A tap during boot only skips: focusing would pop the phone keyboard
  // over what it just revealed. Once the prompt is up, a tap focuses it.
  const handleWindowClick = useCallback(() => {
    setIsSkipped(true);
    inputRef.current?.focus();
  }, []);

  /** Called by InteractivePrompt when the user runs `clear` */
  const handleClear = useCallback(() => {
    setIsCleared(true);
  }, []);

  return (
    <TerminalWindow
      title="✻ claude — ~/gentry"
      onClick={handleWindowClick}
      onKill={onKill}
      onMinimize={onMinimize}
      onFullscreen={onFullscreen}
      isFullscreen={isFullscreen}
    >
      {!isCleared && (
        <>
          <WelcomeBox />

          <p className="mb-5 text-term-fg">
            <span className="text-term-muted select-none">&gt; </span>
            who is gentry riggen?
          </p>

          {BOOT_STEPS.slice(0, visibleSteps).map((step) => (
            <ToolCall key={step.arg} tool={step.tool} arg={step.arg}>
              {step.content}
            </ToolCall>
          ))}

          {!isBootComplete && (
            <Spinner
              verb={SPINNER_VERBS[visibleSteps % SPINNER_VERBS.length]}
            />
          )}

          {isBootComplete && (
            <div className="animate-fadeIn">
              <div className="mb-2 flex gap-2">
                <span className="text-term-fg select-none" aria-hidden="true">
                  ⏺
                </span>
                <p className="text-term-fg">
                  A software leader who still ships: {GAMES.length} games deep
                  for two very demanding QA testers. Want to work together? Type{" "}
                  <span className="text-term-accent">hire me</span>.
                </p>
              </div>
              <p className="mb-5 text-term-muted">
                <span className="text-term-accent">✻</span> Brewed for{" "}
                {elapsedSeconds}s
              </p>
            </div>
          )}
        </>
      )}

      {isBootComplete && (
        <div className="animate-fadeIn">
          <InteractivePrompt
            onClear={handleClear}
            inputRef={inputRef}
            onContentChange={scrollToBottom}
            initialInput={seedInput}
          />
        </div>
      )}

      {/* Scroll anchor — always at the very bottom of terminal content */}
      <div ref={bottomRef} />
    </TerminalWindow>
  );
}
