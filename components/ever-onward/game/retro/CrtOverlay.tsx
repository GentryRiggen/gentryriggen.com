interface CrtOverlayProps {
  /** Darker scanlines and corners; the scene gets a lighter touch. */
  isSubtle?: boolean;
}

/** Scanlines and a vignette, laid over (or behind) whatever is around it. */
export default function CrtOverlay({ isSubtle = false }: CrtOverlayProps) {
  return (
    <>
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute inset-0 ${
          isSubtle
            ? "bg-[repeating-linear-gradient(to_bottom,transparent_0,transparent_2px,rgba(0,0,0,0.16)_2px,rgba(0,0,0,0.16)_3px)]"
            : "bg-[repeating-linear-gradient(to_bottom,transparent_0,transparent_2px,rgba(0,0,0,0.3)_2px,rgba(0,0,0,0.3)_3px)]"
        }`}
      />
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute inset-0 ${
          isSubtle
            ? "bg-[radial-gradient(ellipse_at_center,transparent_65%,rgba(0,0,0,0.55)_100%)]"
            : "bg-[radial-gradient(ellipse_at_center,transparent_55%,rgba(0,0,0,0.75)_100%)]"
        }`}
      />
    </>
  );
}
