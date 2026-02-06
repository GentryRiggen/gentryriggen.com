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
import { getCommandResponse } from "./commandResponses";

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
}

// ---------------------------------------------------------------------------
// Ghost hint commands that cycle when unfocused
// ---------------------------------------------------------------------------

const HINT_COMMANDS = [
  "help",
  "hire me",
  "cowsay",
  "skills",
  "whoami",
  "fortune",
  "neofetch",
  "coffee",
  "cat bio.txt",
  "weather",
  "matrix",
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

let nextId = 0;

export default function InteractivePrompt({
  onClear,
  prompt = "gentry@portfolio:~$",
  inputRef: externalInputRef,
}: InteractivePromptProps) {
  const [inputValue, setInputValue] = useState("");
  const [executedCommands, setExecutedCommands] = useState<ExecutedCommand[]>(
    [],
  );
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [isFocused, setIsFocused] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);

  // Ghost typing state
  const [ghostText, setGhostText] = useState("");
  const [ghostCycle, setGhostCycle] = useState(0);

  const internalRef = useRef<HTMLInputElement>(null);
  const inputRef = externalInputRef ?? internalRef;
  const bottomRef = useRef<HTMLDivElement>(null);

  // Don't auto-focus — let the ghost hint play to entice the user to click

  // Auto-scroll to bottom whenever new commands are added
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [executedCommands]);

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

  /** Process the command when the user presses Enter */
  const handleSubmit = useCallback(
    (e: FormEvent) => {
      e.preventDefault();

      const trimmed = inputValue.trim();

      if (trimmed === "") {
        setExecutedCommands((prev) => [
          ...prev,
          { id: nextId++, command: "", output: "" },
        ]);
        setInputValue("");
        return;
      }

      setCommandHistory((prev) => [...prev, trimmed]);
      setHistoryIndex(-1);

      const result = getCommandResponse(trimmed, [
        ...commandHistory,
        trimmed,
      ]);

      if (result.shouldClear) {
        setExecutedCommands([]);
        setInputValue("");
        onClear();
        return;
      }

      setExecutedCommands((prev) => [
        ...prev,
        { id: nextId++, command: trimmed, output: result.output },
      ]);
      setInputValue("");
    },
    [inputValue, commandHistory, onClear],
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
    [commandHistory, historyIndex],
  );

  const showGhost = !isFocused && !hasInteracted && ghostText.length > 0;

  return (
    <div onClick={focusInput}>
      {/* Previously executed commands + output */}
      <div aria-live="polite" aria-relevant="additions">
      {executedCommands.map((entry) => (
        <div key={entry.id} className="mb-6 animate-fadeIn">
          {/* Command line */}
          <div className="flex flex-wrap gap-x-2">
            <span className="text-green-600 dark:text-green-400 shrink-0 select-none">
              {prompt}
            </span>
            <span className="text-gray-800 dark:text-gray-200">
              {entry.command}
            </span>
          </div>
          {/* Output */}
          {entry.output && (
            typeof entry.output === "string" ? (
              <pre className="mt-2 text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-words font-mono text-sm leading-relaxed">
                {entry.output}
              </pre>
            ) : (
              <div className="mt-2 text-gray-700 dark:text-gray-300 font-mono text-sm leading-relaxed">
                {entry.output}
              </div>
            )
          )}
        </div>
      ))}
      </div>

      {/* Active input line */}
      <form onSubmit={handleSubmit} className="flex flex-wrap gap-x-2 items-center">
        <span className="text-green-600 dark:text-green-400 shrink-0 select-none">
          {prompt}
        </span>
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
            className="w-full bg-transparent border-none outline-none text-gray-800 dark:text-gray-200 font-mono text-sm caret-green-500 dark:caret-green-400 p-0 m-0"
            spellCheck={false}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            aria-label="Terminal command input"
          />
          {/* Ghost typing hint overlay */}
          {showGhost && (
            <div className="absolute inset-0 flex items-center pointer-events-none" aria-hidden="true">
              <span className="text-gray-400/60 dark:text-green-500/35 font-mono text-sm">
                {ghostText}
              </span>
              <span className="animate-blink text-gray-400/60 dark:text-green-500/35 ml-px">
                |
              </span>
            </div>
          )}
        </div>
      </form>

      {/* Scroll anchor */}
      <div ref={bottomRef} />
    </div>
  );
}
