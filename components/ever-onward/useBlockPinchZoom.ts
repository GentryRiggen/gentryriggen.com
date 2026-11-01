import { useEffect } from "react";

/**
 * iOS Safari ignores `user-scalable=no`, so pinch-to-zoom is blocked here:
 * WebKit's gesture events and multi-finger touchmoves are cancelled. One
 * finger still scrolls. Listeners go away on unmount so other pages zoom.
 */
export default function useBlockPinchZoom(): void {
  useEffect(() => {
    const blockGesture = (e: Event) => e.preventDefault();
    const blockMultiTouch = (e: TouchEvent) => {
      if (e.touches.length > 1) e.preventDefault();
    };
    const gestures = ["gesturestart", "gesturechange", "gestureend"] as const;
    const options = { passive: false };
    gestures.forEach((g) =>
      document.addEventListener(g, blockGesture, options)
    );
    document.addEventListener("touchmove", blockMultiTouch, options);
    return () => {
      gestures.forEach((g) => document.removeEventListener(g, blockGesture));
      document.removeEventListener("touchmove", blockMultiTouch);
    };
  }, []);
}
