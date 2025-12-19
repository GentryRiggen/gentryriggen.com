import { useCallback, useRef } from "react";
import confetti from "canvas-confetti";

const CONFETTI_COLORS = [
  "#ff6b6b",
  "#4ecdc4",
  "#45b7d1",
  "#f9ca24",
  "#f0932b",
  "#eb4d4b",
  "#6c5ce7",
  "#a29bfe",
];

const CONFETTI_DURATION = 2000;
const COOLDOWN_DURATION = 3000;

export function useConfetti() {
  const cooldownTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const triggerConfetti = useCallback(
    (onCooldownChange?: (isCooldown: boolean) => void) => {
      const end = Date.now() + CONFETTI_DURATION;

      const confettiBurst = () => {
        if (Date.now() > end) return;

        // Burst from top center with wide spread
        confetti({
          particleCount: 30,
          angle: 90,
          spread: 70,
          origin: { x: 0.5, y: 0.1 },
          colors: CONFETTI_COLORS,
          startVelocity: 50,
          gravity: 1,
          ticks: 400,
        });

        // Additional bursts from sides for more spread
        confetti({
          particleCount: 20,
          angle: 60,
          spread: 80,
          origin: { x: 0.2, y: 0.1 },
          colors: CONFETTI_COLORS,
          startVelocity: 45,
          gravity: 1,
          ticks: 400,
        });

        confetti({
          particleCount: 20,
          angle: 120,
          spread: 80,
          origin: { x: 0.8, y: 0.1 },
          colors: CONFETTI_COLORS,
          startVelocity: 45,
          gravity: 1,
          ticks: 400,
        });

        requestAnimationFrame(confettiBurst);
      };

      confettiBurst();

      // Set cooldown
      if (onCooldownChange) {
        onCooldownChange(true);
      }

      if (cooldownTimeoutRef.current) {
        clearTimeout(cooldownTimeoutRef.current);
      }

      cooldownTimeoutRef.current = setTimeout(() => {
        if (onCooldownChange) {
          onCooldownChange(false);
        }
      }, COOLDOWN_DURATION);
    },
    []
  );

  return { triggerConfetti };
}
