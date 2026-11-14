import type { ReactNode } from "react";
import { pixelClass } from "../../game/retro/retroStyles";

/** The scene's palette: warm and bright, then wash-y toward the world. */
export const SKIN = "#ffd9a8";
export const SKIN_SHADE = "#e9b57e";
export const INK = "#2b2140";
export const CHEEK = "#ff9eb0";

export type Mood = "frown" | "flat" | "smile" | "grin";

interface FaceProps {
  x: number;
  y: number;
  /** Width in pixels of the head (the face scales with it). */
  size?: number;
  mood: Mood;
  fill?: string;
  /** Sweat on the brow, for a worn-out crowd. */
  isSweaty?: boolean;
}

/** A small round-ish head with a mood, drawn from rects. */
export function Face({
  x,
  y,
  size = 16,
  mood,
  fill = SKIN,
  isSweaty = false,
}: FaceProps) {
  const u = size / 8;
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect x={u} y="0" width={u * 6} height={size} fill={fill} />
      <rect x="0" y={u} width={size} height={u * 6} fill={fill} />
      <rect x={u * 2} y={u * 2.5} width={u} height={u * 1.2} fill={INK} />
      <rect x={u * 5} y={u * 2.5} width={u} height={u * 1.2} fill={INK} />
      {mood === "frown" && (
        <>
          <rect
            x={u * 3}
            y={u * 5.4}
            width={u * 2}
            height={u * 0.8}
            fill={INK}
          />
          <rect
            x={u * 2.4}
            y={u * 6}
            width={u * 0.8}
            height={u * 0.8}
            fill={INK}
          />
          <rect
            x={u * 4.8}
            y={u * 6}
            width={u * 0.8}
            height={u * 0.8}
            fill={INK}
          />
        </>
      )}
      {mood === "flat" && (
        <rect
          x={u * 2.5}
          y={u * 5.6}
          width={u * 3}
          height={u * 0.8}
          fill={INK}
        />
      )}
      {mood === "smile" && (
        <>
          <rect
            x={u * 2.4}
            y={u * 5.2}
            width={u * 0.8}
            height={u * 0.8}
            fill={INK}
          />
          <rect
            x={u * 3}
            y={u * 5.8}
            width={u * 2}
            height={u * 0.8}
            fill={INK}
          />
          <rect
            x={u * 4.8}
            y={u * 5.2}
            width={u * 0.8}
            height={u * 0.8}
            fill={INK}
          />
        </>
      )}
      {mood === "grin" && (
        <>
          <rect x={u * 2} y={u * 5} width={u * 4} height={u * 1.6} fill={INK} />
          <rect
            x={u * 2.4}
            y={u * 5}
            width={u * 3.2}
            height={u * 0.6}
            fill="#fff"
          />
        </>
      )}
      {(mood === "smile" || mood === "grin") && (
        <>
          <rect
            x={u * 0.8}
            y={u * 4.4}
            width={u * 1.2}
            height={u * 0.8}
            fill={CHEEK}
          />
          <rect
            x={u * 6}
            y={u * 4.4}
            width={u * 1.2}
            height={u * 0.8}
            fill={CHEEK}
          />
        </>
      )}
      {isSweaty && (
        <rect
          x={u * 6.6}
          y={u * 0.6}
          width={u * 0.8}
          height={u * 1.4}
          fill="#7cc4ff"
        />
      )}
    </g>
  );
}

interface RobotProps {
  x: number;
  y: number;
  /** A lit antenna and eyes. */
  isLit?: boolean;
  scale?: number;
}

/** The robot: a boxy friend with a round light on a stalk. */
export function Robot({ x, y, isLit = true, scale = 1 }: RobotProps) {
  return (
    <g
      className="eo-scene-robot"
      transform={`translate(${x} ${y}) scale(${scale})`}
    >
      <rect x="9" y="-10" width="2" height="8" fill="#5b6b82" />
      <rect
        x="7"
        y="-14"
        width="6"
        height="6"
        fill={isLit ? "#ffe14d" : "#8a8f99"}
      />
      <rect x="0" y="-2" width="20" height="14" fill="#9fb4cc" />
      <rect x="0" y="-2" width="20" height="3" fill="#c7d6e8" />
      <rect x="4" y="3" width="4" height="4" fill={INK} />
      <rect x="12" y="3" width="4" height="4" fill={INK} />
      <rect
        x="5"
        y="4"
        width="2"
        height="2"
        fill={isLit ? "#9bf6ff" : "#555"}
      />
      <rect
        x="13"
        y="4"
        width="2"
        height="2"
        fill={isLit ? "#9bf6ff" : "#555"}
      />
      <rect x="2" y="12" width="16" height="12" fill="#7d93b0" />
      <rect x="4" y="24" width="4" height="4" fill="#5b6b82" />
      <rect x="12" y="24" width="4" height="4" fill="#5b6b82" />
    </g>
  );
}

interface BalloonProps {
  x: number;
  y: number;
  color: string;
}

export function Balloon({ x, y, color }: BalloonProps) {
  return (
    <g>
      <rect x={x} y={y + 14} width="1" height="26" fill="#ffffffaa" />
      <rect x={x - 5} y={y} width="11" height="14" fill={color} />
      <rect x={x - 3} y={y - 2} width="7" height="2" fill={color} />
      <rect x={x - 3} y={y + 14} width="7" height="2" fill={color} />
      <rect x={x - 3} y={y + 2} width="2" height="4" fill="#ffffff88" />
    </g>
  );
}

export const BALLOON_COLORS = [
  "#ff5d73",
  "#ffd23f",
  "#4cc9f0",
  "#7bed9f",
  "#c77dff",
  "#ff9f43",
  "#f78fb3",
  "#70a1ff",
] as const;

interface DogProps {
  x: number;
  y: number;
  color?: string;
}

/** A small dog, tail up. The tail is drawn separately so it can wag. */
export function Dog({ x, y, color = "#c98f55" }: DogProps) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect x="0" y="4" width="16" height="8" fill={color} />
      <rect x="12" y="0" width="8" height="8" fill={color} />
      <rect x="18" y="2" width="4" height="4" fill="#8a5a2b" />
      <rect x="14" y="2" width="2" height="2" fill={INK} />
      <rect x="12" y="-2" width="3" height="4" fill="#8a5a2b" />
      <rect x="2" y="12" width="3" height="4" fill="#8a5a2b" />
      <rect x="12" y="12" width="3" height="4" fill="#8a5a2b" />
    </g>
  );
}

interface TailProps {
  x: number;
  y: number;
}

export function Tail({ x, y }: TailProps) {
  return <rect x={x} y={y} width="3" height="8" fill="#8a5a2b" />;
}

interface TextProps {
  x: number;
  y: number;
  children: ReactNode;
  fill?: string;
  size?: number;
  anchor?: "start" | "middle" | "end";
}

/** Pixel-font text at least 10 px, always. */
export function PixelText({
  x,
  y,
  children,
  fill = "#fff",
  size = 10,
  anchor = "middle",
}: TextProps) {
  return (
    <text
      x={x}
      y={y}
      fill={fill}
      fontSize={Math.max(10, size)}
      textAnchor={anchor}
      className={pixelClass}
    >
      {children}
    </text>
  );
}
