/** A burst of confetti (skipped for reduced motion); only decoration. */
export async function burstConfetti(
  options: { particleCount?: number; originY?: number } = {}
): Promise<void> {
  try {
    const confetti = (await import("canvas-confetti")).default;
    void confetti({
      particleCount: options.particleCount ?? 90,
      spread: 80,
      origin: { y: options.originY ?? 0.6 },
      disableForReducedMotion: true,
    });
  } catch {
    // Confetti is only decoration.
  }
}
