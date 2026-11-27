import type { ReactNode } from "react";

interface ToolCallProps {
  /** Tool name, e.g. "Read" */
  tool: string;
  /** Shown in parentheses, e.g. "bio.txt" */
  arg: string;
  children: ReactNode;
}

/** One Claude Code style tool call: `⏺ Read(bio.txt)` with its result under `⎿`. */
export default function ToolCall({ tool, arg, children }: ToolCallProps) {
  return (
    <div className="mb-5 animate-fadeIn">
      <div className="flex gap-2">
        <span className="text-term-ok select-none" aria-hidden="true">
          ⏺
        </span>
        <p>
          <span className="font-bold text-term-fg">{tool}</span>
          <span className="text-term-muted">({arg})</span>
        </p>
      </div>
      <div className="flex gap-2 mt-1 pl-2">
        <span className="text-term-faint select-none" aria-hidden="true">
          ⎿
        </span>
        <div className="flex-1 min-w-0 text-term-text">{children}</div>
      </div>
    </div>
  );
}
