import Px from "./Px";

/**
 * The keepsakes as little pixel pictures, each in a 12 by 12 box whose
 * top-left corner is (x, y). Bold shapes and bright colours so they read as
 * small as a phone draws them.
 */
export default function KeepsakeSprite({
  id,
  x,
  y,
}: {
  id: string;
  x: number;
  y: number;
}) {
  switch (id) {
    case "feather":
      return (
        <g>
          <Px x={x + 8} y={y} w={3} h={2} c="#ffffff" />
          <Px x={x + 6} y={y + 2} w={4} h={2} c="#f4f1ea" />
          <Px x={x + 4} y={y + 4} w={4} h={2} c="#ffffff" />
          <Px x={x + 3} y={y + 6} w={3} h={2} c="#f4f1ea" />
          <Px x={x + 1} y={y + 8} w={3} h={2} c="#c9c3b4" />
          <Px x={x} y={y + 10} w={2} h={2} c="#8a8372" />
        </g>
      );
    case "bolt":
      return (
        <g>
          <Px x={x + 2} y={y} w={8} h={5} c="#c4ccd6" />
          <Px x={x + 4} y={y + 1} w={4} h={3} c="#8a95a3" />
          <Px x={x + 4} y={y + 5} w={4} h={7} c="#a2adba" />
          <Px x={x + 4} y={y + 7} w={4} h={1} c="#6c7785" />
          <Px x={x + 4} y={y + 10} w={4} h={1} c="#6c7785" />
        </g>
      );
    case "bulb":
      return (
        <g>
          <Px x={x + 2} y={y} w={8} h={7} c="#fff0a0" />
          <Px x={x + 3} y={y + 1} w={3} h={3} c="#ffffff" />
          <Px x={x + 4} y={y + 7} w={4} h={2} c="#e8a317" />
          <Px x={x + 4} y={y + 9} w={4} h={3} c="#8a95a3" />
        </g>
      );
    case "star":
      return (
        <g>
          <Px x={x + 5} y={y} w={2} h={3} c="#ffd23f" />
          <Px x={x + 3} y={y + 3} w={6} h={3} c="#ffd23f" />
          <Px x={x} y={y + 4} w={12} h={3} c="#ffd23f" />
          <Px x={x + 2} y={y + 7} w={8} h={3} c="#f2b134" />
          <Px x={x + 1} y={y + 9} w={3} h={3} c="#f2b134" />
          <Px x={x + 8} y={y + 9} w={3} h={3} c="#f2b134" />
        </g>
      );
    case "marble":
      return (
        <g>
          <Px x={x + 3} y={y + 1} w={6} h={10} c="#3d8fe0" />
          <Px x={x + 1} y={y + 3} w={10} h={6} c="#3d8fe0" />
          <Px x={x + 3} y={y + 3} w={3} h={3} c="#bfe3ff" />
          <Px x={x + 7} y={y + 7} w={2} h={2} c="#1f5fae" />
        </g>
      );
    case "blueprint":
      return (
        <g>
          <Px x={x} y={y + 2} w={12} h={8} c="#3b6fd0" />
          <Px x={x + 2} y={y + 4} w={8} h={1} c="#cfe3ff" />
          <Px x={x + 2} y={y + 6} w={5} h={1} c="#cfe3ff" />
          <Px x={x + 8} y={y + 6} w={2} h={2} c="#8b5e34" />
          <Px x={x} y={y + 1} w={2} h={10} c="#2f58aa" />
        </g>
      );
    case "key":
      return (
        <g>
          <Px x={x + 1} y={y + 1} w={5} h={5} c="#ffd23f" />
          <Px x={x + 3} y={y + 3} w={1} h={1} c="#1c2432" />
          <Px x={x + 5} y={y + 5} w={2} h={6} c="#e8a317" />
          <Px x={x + 7} y={y + 8} w={3} h={2} c="#e8a317" />
          <Px x={x + 7} y={y + 10} w={2} h={1} c="#e8a317" />
        </g>
      );
    case "daisy":
      return (
        <g>
          <Px x={x + 5} y={y} w={2} h={4} c="#ffffff" />
          <Px x={x + 5} y={y + 7} w={2} h={3} c="#ffffff" />
          <Px x={x + 1} y={y + 4} w={4} h={3} c="#ffffff" />
          <Px x={x + 7} y={y + 4} w={4} h={3} c="#ffffff" />
          <Px x={x + 5} y={y + 4} w={2} h={3} c="#ffd23f" />
          <Px x={x + 5} y={y + 10} w={2} h={2} c="#4aa84a" />
        </g>
      );
    default:
      return (
        <g>
          <Px x={x + 4} y={y} w={4} h={3} c="#e8554e" />
          <Px x={x + 3} y={y + 3} w={6} h={7} c="#e8554e" />
          <Px x={x + 3} y={y + 5} w={6} h={2} c="#fff4cf" />
          <Px x={x + 4} y={y + 10} w={4} h={2} c="#c43d38" />
        </g>
      );
  }
}
