import type { FunnelLogo } from "./funnelLivery";

/**
 * One filled silhouette per funnel logo, in a 24 x 24 box. Bold and simple so
 * they read small. Every shape is a filled outline (no strokes), so the 3D
 * canvas texture and the panel's inline SVG draw them the same way.
 */
export const FUNNEL_LOGO_PATHS: Record<FunnelLogo, string> = {
  star: "M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z",
  anchor:
    "M12 2a3 3 0 1 1 0 6 3 3 0 0 1 0-6zM11 8h2v2h3v2h-3v7.9c2.7-.4 4.7-2.3 5.1-4.9H16l3.5-4 3.5 4h-2.1c-.5 4-3.8 7-8.9 7s-8.4-3-8.9-7H1l3.5-4L8 15H5.9c.4 2.6 2.4 4.5 5.1 4.9V12H8v-2h3z",
  heart:
    "M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54z",
  wave: "M1 7q2.75-4 5.5 0t5.5 0 5.5 0 5.5 0v3q-2.75 4-5.5 0t-5.5 0-5.5 0-5.5 0zM1 15q2.75-4 5.5 0t5.5 0 5.5 0 5.5 0v3q-2.75 4-5.5 0t-5.5 0-5.5 0-5.5 0z",
  crown: "M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5z",
  compass:
    "M12 2L13.1 9.4 16.6 7.4 14.6 10.9 22 12 14.6 13.1 16.6 16.6 13.1 14.6 12 22 10.9 14.6 7.4 16.6 9.4 13.1 2 12 9.4 10.9 7.4 7.4 10.9 9.4z",
  sun: "M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10zM11 1h2v4h-2zM11 19h2v4h-2zM1 11h4v2H1zM19 11h4v2h-4zM4.2 5.6L5.6 4.2l2.5 2.5-1.4 1.4zM18.4 4.2l1.4 1.4-2.5 2.5-1.4-1.4zM17.3 15.9l2.5 2.5-1.4 1.4-2.5-2.5zM6.7 15.9l1.4 1.4-2.5 2.5-1.4-1.4z",
};
