import type { EmoteId } from "@/lib/flamelings/catalog";

interface Fx {
  glyph: string;
  kind: string;
  count: number;
  loop?: boolean;
}

const FX: Partial<Record<EmoteId, Fx>> = {
  love: { glyph: "💖", kind: "heart", count: 5 },
  dance: { glyph: "🎵", kind: "note", count: 4 },
  wow: { glyph: "!", kind: "bang", count: 1 },
  sleepy: { glyph: "💤", kind: "zzz", count: 3 },
  grumpy: { glyph: "💨", kind: "steam", count: 4 },
  sparkle: { glyph: "✨", kind: "burst", count: 5 },
  spin: { glyph: "💫", kind: "dizzy", count: 3 },
  laugh: { glyph: "😂", kind: "ha", count: 2 },
};

const ASLEEP: Fx = { glyph: "💤", kind: "zzz", count: 3, loop: true };

interface EmoteFxProps {
  emote: EmoteId | null;
  asleep?: boolean;
}

/** Particles floating over the pet: hearts, zzz, steam, stars and "!". */
export default function EmoteFx({ emote, asleep = false }: EmoteFxProps) {
  const fx = emote ? FX[emote] : asleep ? ASLEEP : undefined;
  if (!fx) return null;
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0">
      {Array.from({ length: fx.count }, (_, i) => (
        <span
          key={i}
          className="fl-fx"
          data-fx={fx.kind}
          data-loop={fx.loop ? "true" : undefined}
        >
          {fx.glyph}
        </span>
      ))}
    </div>
  );
}
