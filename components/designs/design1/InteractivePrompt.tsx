"use client";

import {
  useState,
  useRef,
  useCallback,
  useEffect,
  type KeyboardEvent,
  type FormEvent,
  type ReactNode,
} from "react";
import confetti from "canvas-confetti";
import { getCommandResponse } from "./commandResponses";
import { GAMES } from "./games";
import { useTerminalTheme } from "./terminalTheme";
import { navigateTo } from "./navigate";

/** Gives the visitor a moment to read the output before navigating away */
const NAVIGATION_DELAY_MS = 1200;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ExecutedCommand {
  id: number;
  command: string;
  output: ReactNode;
}

interface InteractivePromptProps {
  /** Called when the user runs the `clear` command */
  onClear: () => void;
  prompt?: string;
  /** External ref so parent can focus the input */
  inputRef?: React.RefObject<HTMLInputElement | null>;
  /** Called when new output is added so parent can scroll */
  onContentChange?: () => void;
  /** Text to start the input with (the key that skipped the boot) */
  initialInput?: string;
}

// ---------------------------------------------------------------------------
// Ghost hint commands that cycle when unfocused
// ---------------------------------------------------------------------------

const HINT_COMMANDS = [
  "games",
  "contact",
  "/help",
  "claude",
  "/theme",
  "cowsay",
  "skills",
  "whoami",
  "fortune",
  "neofetch",
  "coffee",
  "cat bio.txt",
  "weather",
  "matrix",
  "party",
];

/** Tappable suggestions under the input, for visitors who won't type. */
const SUGGESTIONS = ["games", "skills", "contact", "/theme", "/help"];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

let nextId = 0;

export default function InteractivePrompt({
  onClear,
  prompt = ">",
  inputRef: externalInputRef,
  onContentChange,
  initialInput = "",
}: InteractivePromptProps) {
  const [inputValue, setInputValue] = useState(initialInput);
  const [executedCommands, setExecutedCommands] = useState<ExecutedCommand[]>(
    []
  );
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [isFocused, setIsFocused] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(initialInput !== "");
  const { setThemeId } = useTerminalTheme();

  // Ghost typing state
  const [ghostText, setGhostText] = useState("");
  const [ghostCycle, setGhostCycle] = useState(0);

  const internalRef = useRef<HTMLInputElement>(null);
  const inputRef = externalInputRef ?? internalRef;

  // Don't auto-focus — let the ghost hint play to entice the user to click

  // Pending navigation timer (e.g. from `ships`), cancelled on unmount
  const navigationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (navigationTimerRef.current) clearTimeout(navigationTimerRef.current);
    };
  }, []);

  // Notify parent to scroll when new commands are added
  useEffect(() => {
    onContentChange?.();
  }, [executedCommands, onContentChange]);

  // Ghost typing animation — types a command, pauses, deletes, then advances
  useEffect(() => {
    if (isFocused || hasInteracted) {
      setGhostText("");
      return;
    }

    const cmd = HINT_COMMANDS[ghostCycle % HINT_COMMANDS.length];
    let charIdx = 0;
    let phase: "typing" | "pausing" | "deleting" = "typing";
    let timer: ReturnType<typeof setTimeout>;

    function tick() {
      if (phase === "typing") {
        charIdx++;
        setGhostText(cmd.slice(0, charIdx));
        if (charIdx >= cmd.length) {
          phase = "pausing";
          timer = setTimeout(tick, 1500);
        } else {
          timer = setTimeout(tick, 80 + Math.random() * 40);
        }
      } else if (phase === "pausing") {
        phase = "deleting";
        timer = setTimeout(tick, 0);
      } else {
        charIdx--;
        setGhostText(cmd.slice(0, charIdx));
        if (charIdx <= 0) {
          timer = setTimeout(() => setGhostCycle((c) => c + 1), 500);
        } else {
          timer = setTimeout(tick, 35);
        }
      }
    }

    timer = setTimeout(tick, 800);

    return () => clearTimeout(timer);
  }, [isFocused, hasInteracted, ghostCycle]);

  /** Focus the input when the user clicks anywhere in the terminal */
  const focusInput = useCallback(() => {
    inputRef.current?.focus();
  }, [inputRef]);

  const handleFocus = useCallback(() => {
    setIsFocused(true);
    setHasInteracted(true);
  }, []);

  const handleBlur = useCallback(() => {
    setIsFocused(false);
  }, []);

  /** Run a command, typed or tapped */
  const runCommand = useCallback(
    (raw: string) => {
      const trimmed = raw.trim();

      if (trimmed === "") {
        setExecutedCommands((prev) => [
          ...prev,
          { id: nextId++, command: "", output: "" },
        ]);
        return;
      }

      setCommandHistory((prev) => [...prev, trimmed]);
      setHistoryIndex(-1);

      // Typing anything else means the visitor wants to stay here.
      if (navigationTimerRef.current) {
        clearTimeout(navigationTimerRef.current);
        navigationTimerRef.current = null;
      }

      const result = getCommandResponse(trimmed, [...commandHistory, trimmed]);

      if (result.shouldClear) {
        setExecutedCommands([]);
        onClear();
        return;
      }

      if (result.shouldConfetti) {
        const end = Date.now() + 1500;
        const frame = () => {
          confetti({
            particleCount: 3,
            angle: 60,
            spread: 55,
            origin: { x: 0, y: 0.6 },
          });
          confetti({
            particleCount: 3,
            angle: 120,
            spread: 55,
            origin: { x: 1, y: 0.6 },
          });
          if (Date.now() < end) requestAnimationFrame(frame);
        };
        frame();
      }

      if (result.terminalTheme) setThemeId(result.terminalTheme);

      if (result.navigateTo) {
        const destination = result.navigateTo;
        if (navigationTimerRef.current) {
          clearTimeout(navigationTimerRef.current);
        }
        navigationTimerRef.current = setTimeout(
          () => navigateTo(destination),
          NAVIGATION_DELAY_MS
        );
      }

      setExecutedCommands((prev) => [
        ...prev,
        { id: nextId++, command: trimmed, output: result.output },
      ]);
    },
    [commandHistory, onClear, setThemeId]
  );

  /** Process the command when the user presses Enter */
  const handleSubmit = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      runCommand(inputValue);
      // Only typed input is cleared: a tapped chip leaves half-typed text.
      setInputValue("");
    },
    [inputValue, runCommand]
  );

  /** Handle up/down arrows for command history navigation */
  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (commandHistory.length === 0) return;

      if (e.key === "ArrowUp") {
        e.preventDefault();
        const newIndex =
          historyIndex === -1
            ? commandHistory.length - 1
            : Math.max(0, historyIndex - 1);
        setHistoryIndex(newIndex);
        setInputValue(commandHistory[newIndex]);
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        if (historyIndex === -1) return;
        const newIndex = historyIndex + 1;
        if (newIndex >= commandHistory.length) {
          setHistoryIndex(-1);
          setInputValue("");
        } else {
          setHistoryIndex(newIndex);
          setInputValue(commandHistory[newIndex]);
        }
      }
    },
    [commandHistory, historyIndex]
  );

  const showGhost = !isFocused && !hasInteracted && ghostText.length > 0;

  return (
    <div onClick={focusInput}>
      {/* Previously executed commands + output */}
      <div aria-live="polite" aria-relevant="additions">
        {executedCommands.map((entry) => (
          <div key={entry.id} className="mb-5 animate-fadeIn">
            {/* The visitor's message */}
            <p className="text-term-fg break-words">
              <span className="text-term-muted select-none">{prompt} </span>
              {entry.command}
            </p>
            {/* Output */}
            {entry.output && (
              <div className="mt-2 flex gap-2">
                <span className="text-term-fg select-none" aria-hidden="true">
                  ⏺
                </span>
                {typeof entry.output === "string" ? (
                  <pre className="flex-1 min-w-0 text-term-text whitespace-pre-wrap break-words font-mono text-sm leading-relaxed">
                    {entry.output}
                  </pre>
                ) : (
                  <div className="flex-1 min-w-0 text-term-text font-mono text-sm leading-relaxed">
                    {entry.output}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Input box (sticky at the bottom), suggestions and status line */}
      <form
        onSubmit={handleSubmit}
        className="sticky bottom-0 bg-term-bg flex gap-x-2 items-center rounded-md border border-term-faint px-3 py-2 transition-colors focus-within:border-term-accent/70"
      >
        <span className="text-term-muted shrink-0 select-none">{prompt}</span>
        <div className="flex-1 min-w-0 relative">
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value);
              setHistoryIndex(-1);
            }}
            onKeyDown={handleKeyDown}
            onFocus={handleFocus}
            onBlur={handleBlur}
            className="w-full bg-transparent border-none outline-none text-term-fg font-mono text-base sm:text-sm caret-term-accent p-0 m-0"
            spellCheck={false}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            aria-label="Terminal command input"
          />
          {/* Ghost typing hint overlay */}
          {showGhost && (
            <div
              className="absolute inset-0 flex items-center pointer-events-none"
              aria-hidden="true"
            >
              <span className="text-term-faint font-mono text-sm">
                {ghostText}
              </span>
              <span className="animate-blink text-term-faint ml-px">|</span>
            </div>
          )}
        </div>
      </form>

      <div className="mt-2 flex flex-wrap gap-2">
        {SUGGESTIONS.map((suggestion) => (
          <button
            key={suggestion}
            type="button"
            onClick={(e) => {
              // Don't focus the input: on phones that pops the keyboard.
              e.stopPropagation();
              setHasInteracted(true);
              runCommand(suggestion);
            }}
            className="rounded border border-term-faint/60 px-3 py-1.5 text-sm sm:px-2 sm:py-0.5 sm:text-xs text-term-text hover:border-term-accent/70 hover:text-term-accent transition-colors"
          >
            {suggestion}
          </button>
        ))}
      </div>

      <div className="mt-2 flex justify-between gap-2 text-xs text-term-muted">
        <span>? /help for shortcuts</span>
        <span className="text-right">
          gentry-1 · {GAMES.length} games shipped
        </span>
      </div>
    </div>
  );
}
