import type { SmileSceneInfo } from "@/lib/ever-onward/universes/smile/scene";
import { CHEEK, INK, SKIN_SHADE } from "./parts";

interface FacesProps {
  info: SmileSceneInfo;
}

/** Static delay classes (Tailwind only sees whole class names). */
const BOB_DELAY = [
  "[animation-delay:0s]",
  "[animation-delay:0.4s]",
  "[animation-delay:0.8s]",
  "[animation-delay:1.2s]",
  "[animation-delay:1.6s]",
  "[animation-delay:2s]",
  "[animation-delay:2.4s]",
  "[animation-delay:2.8s]",
] as const;

const STEP = 36;

interface FaceSpec {
  x: number;
  y: number;
  size: number;
  tone: string;
}

/** The two rows of the crowd, front row bigger (the back row only once there are posters). */
function crowdSpots(info: SmileSceneInfo): FaceSpec[] {
  const n = Math.min(11, 6 + info.a + info.b + info.c);
  const front = Array.from({ length: n }, (_, i) => ({
    x: 4 + i * STEP,
    y: 240 - (i % 3) * 3,
    size: 30,
    tone: i % 3 === 0 ? SKIN_SHADE : "#ffd9a8",
  }));
  const back =
    info.a >= 2
      ? Array.from({ length: n - 1 }, (_, i) => ({
          x: 22 + i * STEP,
          y: 214 - (i % 2) * 3,
          size: 24,
          tone: i % 2 === 0 ? "#d9a066" : "#ffd9a8",
        }))
      : [];
  return [...back, ...front];
}

/**
 * Which faces are painted: a fixed, scattered order (the same one every
 * time), so the paint creeps across the crowd instead of sweeping one side.
 */
export function paintedFaces(total: number, real: number): boolean[] {
  const painted = Math.round(total * (1 - real / 10));
  return Array.from(
    { length: total },
    (_, k) => (k * 11 + 5) % Math.max(1, total) < painted
  );
}

/** A real smile: warm, eyes crinkled up into little arches, cheeks pink. */
function RealFace({
  face,
  delay,
  hands,
}: {
  face: FaceSpec;
  delay: string;
  hands: boolean;
}) {
  const u = face.size / 8;
  return (
    <g transform={`translate(${face.x} ${face.y})`}>
      <g className={`ms-bob ${delay}`}>
        <rect x={u} y="0" width={u * 6} height={face.size} fill={face.tone} />
        <rect x="0" y={u} width={face.size} height={u * 6} fill={face.tone} />
        {[1.5, 4.9].map((ex) => (
          <g key={ex} fill={INK}>
            <rect
              x={u * (ex + 0.4)}
              y={u * 2.3}
              width={u * 1.2}
              height={u * 0.6}
            />
            <rect x={u * ex} y={u * 2.8} width={u * 0.6} height={u * 0.8} />
            <rect
              x={u * (ex + 1.4)}
              y={u * 2.8}
              width={u * 0.6}
              height={u * 0.8}
            />
          </g>
        ))}
        <rect
          x={u * 0.2}
          y={u * 2.6}
          width={u * 0.5}
          height={u * 0.4}
          fill={INK}
        />
        <rect
          x={u * 7.3}
          y={u * 2.6}
          width={u * 0.5}
          height={u * 0.4}
          fill={INK}
        />
        <rect x={u * 2} y={u * 5} width={u * 4} height={u * 1.6} fill={INK} />
        <rect
          x={u * 2.3}
          y={u * 5}
          width={u * 3.4}
          height={u * 0.6}
          fill="#fff"
        />
        <rect
          x={u * 0.8}
          y={u * 4.2}
          width={u * 1.3}
          height={u * 0.9}
          fill={CHEEK}
        />
        <rect
          x={u * 5.9}
          y={u * 4.2}
          width={u * 1.3}
          height={u * 0.9}
          fill={CHEEK}
        />
        {hands && (
          <g fill={face.tone} stroke={INK} strokeWidth="0.8">
            <rect x={-u * 0.9} y={u * 2.4} width={u * 1.5} height={u * 2.4} />
            <rect x={u * 7.4} y={u * 2.4} width={u * 1.5} height={u * 2.4} />
          </g>
        )}
      </g>
    </g>
  );
}

/**
 * A painted smile: a pale, glossy face with eyes wide open and fixed on you,
 * a stiff grin of the same shape on every face, round pink dots for cheeks.
 * It never moves. Eerie, a little, and never scary.
 */
function PaintedFace({ face, hands }: { face: FaceSpec; hands: boolean }) {
  const u = face.size / 8;
  return (
    <g transform={`translate(${face.x} ${face.y})`} data-painted="yes">
      <rect x={u} y="0" width={u * 6} height={face.size} fill="#f6e6da" />
      <rect x="0" y={u} width={face.size} height={u * 6} fill="#f6e6da" />
      <rect x={u} y={u * 0.2} width={u * 6} height={u * 0.5} fill="#e7c9d8" />
      {[1.3, 4.9].map((ex) => (
        <g key={ex}>
          <rect
            x={u * ex}
            y={u * 2.1}
            width={u * 1.8}
            height={u * 1.8}
            fill="#fff"
          />
          <rect
            x={u * (ex + 0.5)}
            y={u * 2.6}
            width={u * 0.8}
            height={u * 0.8}
            fill={INK}
          />
        </g>
      ))}
      <rect
        x={u * 1.1}
        y={u * 4.9}
        width={u * 5.8}
        height={u * 1.9}
        fill="#d81b60"
      />
      <rect
        x={u * 1.5}
        y={u * 5.1}
        width={u * 5}
        height={u * 0.8}
        fill="#fff"
      />
      {[2.5, 3.5, 4.5, 5.5].map((tx) => (
        <rect
          key={tx}
          x={u * tx}
          y={u * 5.1}
          width={u * 0.18}
          height={u * 0.8}
          fill="#d81b60"
        />
      ))}
      <rect
        x={u * 0.6}
        y={u * 4.7}
        width={u * 0.5}
        height={u * 0.5}
        fill="#d81b60"
      />
      <rect
        x={u * 6.9}
        y={u * 4.7}
        width={u * 0.5}
        height={u * 0.5}
        fill="#d81b60"
      />
      <circle cx={u * 1.1} cy={u * 4.2} r={u * 0.7} fill="#ff4d8d" />
      <circle cx={u * 6.9} cy={u * 4.2} r={u * 0.7} fill="#ff4d8d" />
      <g className="ms-w-gloss" fill="#fff" fillOpacity="0.85">
        <rect x={u * 1.6} y={u * 0.8} width={u * 2.4} height={u * 0.5} />
      </g>
      {hands && (
        <g fill="#f6e6da" stroke={INK} strokeWidth="0.8">
          <rect x={-u * 0.9} y={u * 2.4} width={u * 1.5} height={u * 2.4} />
          <rect x={u * 7.4} y={u * 2.4} width={u * 1.5} height={u * 2.4} />
        </g>
      )}
    </g>
  );
}

/** Sheen overlay strength by tenths painted (whole class names for Tailwind). */
const SHEEN = [
  "opacity-0",
  "opacity-0",
  "opacity-5",
  "opacity-5",
  "opacity-10",
  "opacity-10",
  "opacity-15",
  "opacity-20",
  "opacity-20",
  "opacity-25",
  "opacity-30",
] as const;

/**
 * The crowd. Faces are real (crinkled eyes, bobbing) or painted (fixed grin,
 * wide eyes, perfectly still), and the paint creeps across them as the real
 * share falls, under a pale pink sheen that gets stronger with it.
 */
export default function WorldFaces({ info }: FacesProps) {
  const spots = crowdSpots(info);
  const painted = paintedFaces(spots.length, info.real);
  const hands = info.wday === "weary";
  const tenthsPainted = Math.max(0, Math.min(10, 10 - info.real));
  return (
    <g data-testid="eo-world-crowd" data-real={info.real}>
      {spots.map((face, k) =>
        painted[k] ? (
          <PaintedFace key={`${face.x}-${face.y}`} face={face} hands={hands} />
        ) : (
          <RealFace
            key={`${face.x}-${face.y}`}
            face={face}
            delay={BOB_DELAY[k % BOB_DELAY.length]}
            hands={hands}
          />
        )
      )}
      {info.a >= 3 && (
        <g className="ms-frown">
          <rect x="186" y="186" width="18" height="18" fill="#d9c7b8" />
          <rect x="190" y="191" width="3" height="3" fill={INK} />
          <rect x="198" y="191" width="3" height="3" fill={INK} />
          <rect x="191" y="198" width="9" height="2" fill={INK} />
        </g>
      )}
      <g
        aria-hidden="true"
        data-testid="eo-world-sheen"
        className={SHEEN[tenthsPainted]}
      >
        <rect x="-1200" y="-1200" width="2800" height="2700" fill="#ff7ad9" />
      </g>
    </g>
  );
}
