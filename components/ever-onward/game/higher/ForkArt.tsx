import type {
  ForkId,
  ForkSide,
} from "@/lib/ever-onward/universes/higher/forks";
import Px from "../../scenes/higher/Px";

/** Each side of each fork has a little picture of its own. */
function Art({ id, side }: { id: ForkId; side: ForkSide }) {
  if (id === "play")
    return side === 0 ? (
      // Tall and thin: a narrow tower of many blocks.
      <g>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <Px
            key={i}
            x={17}
            y={26 - i * 5}
            w={8}
            h={5}
            c={["#e8554e", "#f2b134", "#4aa3df"][i % 3]}
          />
        ))}
      </g>
    ) : (
      // Wide and sturdy: a pyramid of big blocks.
      <g>
        <Px x={6} y={22} w={30} h={6} c="#4aa3df" />
        <Px x={11} y={16} w={20} h={6} c="#f2b134" />
        <Px x={16} y={10} w={10} h={6} c="#e8554e" />
      </g>
    );
  if (id === "town")
    return side === 0 ? (
      // Steel: a bright beam with rivets.
      <g>
        <Px x={6} y={12} w={30} h={5} c="#8ea3b8" />
        <Px x={19} y={6} w={4} h={17} c="#8ea3b8" />
        <Px x={6} y={23} w={30} h={5} c="#8ea3b8" />
        <Px x={8} y={13} w={2} h={2} c="#e6eef8" />
        <Px x={32} y={13} w={2} h={2} c="#e6eef8" />
      </g>
    ) : (
      // Timber: logs, with a leaf.
      <g>
        <Px x={6} y={20} w={30} h={7} c="#b57a45" />
        <Px x={8} y={21} w={4} h={5} c="#e0b887" />
        <Px x={8} y={12} w={26} h={7} c="#8e5a2e" />
        <Px x={30} y={5} w={6} h={5} c="#7fb069" />
      </g>
    );
  if (id === "sky")
    return side === 0 ? (
      // Space elevator: one cable into the stars.
      <g>
        <Px x={20} y={2} w={2} h={26} c="#fff3b0" />
        <Px x={16} y={20} w={10} h={6} c="#e8a317" />
        <Px x={6} y={5} w={2} h={2} c="#ffffff" />
        <Px x={34} y={9} w={2} h={2} c="#ffffff" />
      </g>
    ) : (
      // Cloud terraces: grassy ledges with a bird.
      <g>
        <Px x={4} y={22} w={22} h={4} c="#6cc070" />
        <Px x={16} y={14} w={22} h={4} c="#6cc070" />
        <Px x={6} y={8} w={16} h={4} c="#6cc070" />
        <Px x={30} y={8} w={5} h={2} c="#ffffff" />
      </g>
    );
  return side === 0 ? (
    // Stairs: steps going down.
    <g>
      {[0, 1, 2, 3, 4].map((i) => (
        <Px key={i} x={4 + i * 7} y={6 + i * 5} w={8} h={4} c="#8d95a8" />
      ))}
    </g>
  ) : (
    // The old lift: a cabin on a cable.
    <g>
      <Px x={20} y={2} w={2} h={10} c="#9aa1ad" />
      <Px x={11} y={12} w={20} h={16} c="#6a5a3a" />
      <Px x={14} y={15} w={14} h={10} c="#2b3350" />
    </g>
  );
}

interface ForkArtProps {
  id: ForkId;
  side: ForkSide;
}

/** The picture on one side of a fork's card. */
export default function ForkArt({ id, side }: ForkArtProps) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 42 32"
      shapeRendering="crispEdges"
      className="h-12 w-16 shrink-0 border-2 border-slate-600 bg-slate-800"
      data-testid={`bh-fork-art-${id}-${side}`}
    >
      <Art id={id} side={side} />
    </svg>
  );
}
