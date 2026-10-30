type Snapshotter = () => Promise<HTMLCanvasElement | null>;

let snapshotter: Snapshotter | null = null;

/** How long to wait for a frame before giving up (a hidden tab draws none). */
const SNAPSHOT_TIMEOUT_MS = 4000;

/** The scene registers how to copy its next drawn frame; returns an unregister. */
export function registerSnapshotter(next: Snapshotter): () => void {
  snapshotter = next;
  return () => {
    if (snapshotter === next) snapshotter = null;
  };
}

/** A copy of the next frame the scene draws, or null when it cannot be had. */
export function takeSnapshot(): Promise<HTMLCanvasElement | null> {
  const current = snapshotter;
  if (!current) return Promise.resolve(null);
  return Promise.race([
    current(),
    new Promise<null>((resolve) =>
      setTimeout(() => resolve(null), SNAPSHOT_TIMEOUT_MS)
    ),
  ]);
}
