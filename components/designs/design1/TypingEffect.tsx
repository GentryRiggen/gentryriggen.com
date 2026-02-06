"use client";

import { useState, useEffect, useRef } from "react";

interface TypingEffectProps {
  text: string;
  /** Delay in ms before typing starts */
  startDelay?: number;
  /** Typing speed in ms per character */
  speed?: number;
  /** Called when typing animation completes */
  onComplete?: () => void;
  className?: string;
}

export default function TypingEffect({
  text,
  startDelay = 0,
  speed = 30,
  onComplete,
  className = "",
}: TypingEffectProps) {
  const [displayedText, setDisplayedText] = useState("");
  const [isStarted, setIsStarted] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const onCompleteRef = useRef(onComplete);

  // Keep callback ref updated without triggering re-renders
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    const startTimeout = setTimeout(() => {
      setIsStarted(true);
    }, startDelay);

    return () => clearTimeout(startTimeout);
  }, [startDelay]);

  useEffect(() => {
    if (!isStarted) return;

    let charIndex = 0;

    const interval = setInterval(() => {
      charIndex++;
      if (charIndex <= text.length) {
        setDisplayedText(text.slice(0, charIndex));
      } else {
        clearInterval(interval);
        setIsDone(true);
        onCompleteRef.current?.();
      }
    }, speed);

    return () => clearInterval(interval);
  }, [isStarted, text, speed]);

  return (
    <span className={className}>
      {displayedText}
      {isStarted && !isDone && (
        <span className="animate-blink text-green-500 dark:text-green-400">
          |
        </span>
      )}
    </span>
  );
}
