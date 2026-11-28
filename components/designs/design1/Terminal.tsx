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
import Shipped from "./Shipped";
import ToolCall from "./ToolCall";
import WelcomeBox from "./WelcomeBox";

/** How long the spinner thinks before the first and each later tool call */
const FIRST_STEP_DELAY = 900;
const STEP_DELAY = 650;

interface BootStep {
  id: string;
  tool: string;
  arg?: string;
  content: ReactNode;
}

const BOOT_STEPS: readonly BootStep[] = [
  { id: "whoami", tool: "Bash", arg: "whoami", content: <Whoami /> },
  { id: "bio", tool: "Read", arg: "bio.txt", content: <Bio /> },
  { id: "about", tool: "Read", arg: "about.txt", content: <About /> },
  {
    id: "games",
    tool: "Bash",
    arg: "ls ~/side-projects/",
    content: <SideProjects />,
  },
  { id: "shipped", tool: "Update Todos", content: <Shipped /> },
  { id: "skills", tool: "Read", arg: "skills.md", content: <Skills /> },
  { id: "links", tool: "Read", arg: "links.txt", content: <Links /> },
];

interface TerminalProps {
  onKill?: () => void;
  onMinimize?: () => void;
  onFullscreen?: () => void;
  isFullscreen?: boolean;
  /** False while minimized: a hidden terminal must not catch page keys. */
  isActive?: boolean;
}

export default function Terminal({
  onKill,
  onMinimize,
  onFullscreen,
  isFullscreen,
  isActive = true,
}: TerminalProps) {
  const reducedMotion = usePrefersReducedMotion();
  const [stepsShown, setStepsShown] = useState(0);
  const [isSkipped, setIsSkipped] = useState(false);
  const [isCleared, setIsCleared] = useState(false);
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
    // Scroll only the terminal's own body: scrollIntoView would also scroll
    // the page, pushing the title bar off screen.
    const scroller = bottomRef.current?.closest("[data-terminal-scroll]");
    if (scroller) scroller.scrollTop = scroller.scrollHeight;
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
    if (isBootComplete || !isActive) return;
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
      // The input exists by the time the browser acts on this key, so stop
      // the keys it would take: Enter would submit an empty command and a
      // letter would be typed twice. Others (F5, Space, PageDown) still work.
      const isPrintable = e.key.length === 1 && e.key !== " ";
      if (e.key === "Enter" || isPrintable) e.preventDefault();
      if (isPrintable) setSeedInput(e.key);
      focusWhenReadyRef.current = true;
      setIsSkipped(true);
    };
    window.addEventListener("keydown", skip);
    return () => window.removeEventListener("keydown", skip);
  }, [isBootComplete, isActive]);

  useEffect(() => {
    if (!isBootComplete) return;
    if (focusWhenReadyRef.current) {
      focusWhenReadyRef.current = false;
      inputRef.current?.focus();
    }
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
            <ToolCall key={step.id} tool={step.tool} arg={step.arg}>
              {step.content}
            </ToolCall>
          ))}

          {!isBootComplete && (
            <Spinner
              verb={SPINNER_VERBS[visibleSteps % SPINNER_VERBS.length]}
            />
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
