import type { LogTone } from "@/lib/ever-onward/engine/types";
import { pixelClass } from "./retro/retroStyles";

interface LogTagProps {
  tone: LogTone;
}

const TAGS: Record<LogTone, { label: string; className: string }> = {
  good: {
    label: "LOG",
    className: "border-emerald-300 bg-emerald-800 text-emerald-50",
  },
  bad: { label: "UH-OH", className: "border-red-300 bg-red-800 text-white" },
  info: {
    label: "HEADS UP",
    className: "border-cyan-300 bg-cyan-900 text-cyan-50",
  },
};

/** The little tag in front of a running-log line: how it went. */
export default function LogTag({ tone }: LogTagProps) {
  const tag = TAGS[tone];
  return (
    <span
      className={`${pixelClass} mr-2 inline-block border-2 px-1.5 py-1 align-middle text-[10px] leading-none ${tag.className}`}
    >
      {tag.label}
    </span>
  );
}
