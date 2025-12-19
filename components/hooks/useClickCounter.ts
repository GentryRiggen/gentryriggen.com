import { useCallback, useRef, useState } from "react";

const CLICK_RESET_TIMEOUT = 1000;
const CLICKS_NEEDED = 3;

export function useClickCounter(
  onThresholdReached: () => void,
  isCooldown: boolean
) {
  const [isBouncing, setIsBouncing] = useState(false);
  const clickCountRef = useRef(0);
  const clickTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleClick = useCallback(() => {
    // If in cooldown, show shake animation and don't count clicks
    if (isCooldown) {
      setIsBouncing(true);
      setTimeout(() => setIsBouncing(false), 500);
      return;
    }

    // Clear any existing timeout
    if (clickTimeoutRef.current) {
      clearTimeout(clickTimeoutRef.current);
    }

    // Trigger bounce animation
    setIsBouncing(true);
    setTimeout(() => setIsBouncing(false), 400);

    // Increment click count
    clickCountRef.current += 1;

    // Check if we've reached the threshold
    if (clickCountRef.current >= CLICKS_NEEDED) {
      onThresholdReached();
      clickCountRef.current = 0;
    }

    // Reset click count after timeout
    clickTimeoutRef.current = setTimeout(() => {
      clickCountRef.current = 0;
    }, CLICK_RESET_TIMEOUT);
  }, [onThresholdReached, isCooldown]);

  return { handleClick, isBouncing };
}
