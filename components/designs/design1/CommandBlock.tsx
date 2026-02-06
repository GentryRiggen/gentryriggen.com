"use client";

import { useState, useCallback } from "react";
import TypingEffect from "./TypingEffect";

interface CommandBlockProps {
  /** The command text displayed after the prompt, e.g. "cat bio.txt" */
  command: string;
  /** The output rendered below the command once typing finishes */
  children: React.ReactNode;
  /** Delay in ms before this block starts typing */
  startDelay?: number;
  /** Called once the command finishes typing and output is revealed */
  onComplete?: () => void;
  /** Custom prompt prefix */
  prompt?: string;
}

export default function CommandBlock({
  command,
  children,
  startDelay = 0,
  onComplete,
  prompt = "gentry@portfolio:~$",
}: CommandBlockProps) {
  const [isOutputVisible, setIsOutputVisible] = useState(false);

  const handleTypingComplete = useCallback(() => {
    setIsOutputVisible(true);
    onComplete?.();
  }, [onComplete]);

  return (
    <div className="mb-6">
      {/* Command line */}
      <div className="flex flex-wrap gap-x-2">
        <span className="text-green-600 dark:text-green-400 shrink-0 select-none">
          {prompt}
        </span>
        <TypingEffect
          text={command}
          startDelay={startDelay}
          speed={35}
          onComplete={handleTypingComplete}
          className="text-gray-800 dark:text-gray-200"
        />
      </div>

      {/* Command output */}
      {isOutputVisible && (
        <div className="mt-2 pl-0 text-gray-700 dark:text-gray-300 animate-fadeIn">
          {children}
        </div>
      )}
    </div>
  );
}
