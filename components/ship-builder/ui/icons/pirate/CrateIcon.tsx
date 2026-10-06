import type { ReactNode } from "react";

/**
 * A plain oak crate: stands in until a group draws its own icon. The id is
 * stamped on the drawing so each placeholder stays distinct.
 */
export function crateIcon(id: string): () => ReactNode {
  return function CrateIcon() {
    return (
      <g data-placeholder={id}>
        <rect x={14} y={18} width={20} height={20} fill="#9a6b3f" />
        <path d="M14 28 H34 M24 18 V38" stroke="#5a3a22" strokeWidth={1.5} />
      </g>
    );
  };
}
