import type { ReactNode } from "react";
import { pixelClass, retroHeadingClass } from "./retroStyles";

interface RetroHeadingProps {
  as?: "h1" | "h2" | "h3";
  id?: string;
  className?: string;
  /** Adds the pixel ▶︎ bullet in front. */
  hasBullet?: boolean;
  children: ReactNode;
}

/** A real heading in pixel type with the amber glow. */
export default function RetroHeading({
  as: Tag = "h2",
  id,
  className = "text-xs",
  hasBullet = false,
  children,
}: RetroHeadingProps) {
  return (
    <Tag id={id} className={`${pixelClass} ${retroHeadingClass} ${className}`}>
      {hasBullet && (
        <span aria-hidden="true" className="mr-2">
          ▶︎
        </span>
      )}
      {children}
    </Tag>
  );
}
