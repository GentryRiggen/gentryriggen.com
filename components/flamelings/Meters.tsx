import { tidiness } from "@/lib/flamelings/status";
import type { Pet } from "@/lib/flamelings/types";

interface MeterProps {
  icon: string;
  label: string;
  value: number;
}

function Meter({ icon, label, value }: MeterProps) {
  const low = value < 30;
  return (
    <div className="flex items-center gap-2 rounded-2xl bg-black/35 px-3 py-2 text-white backdrop-blur-sm">
      <span
        aria-hidden="true"
        className={`text-2xl ${low ? "animate-pulse" : ""}`}
      >
        {icon}
      </span>
      <progress
        aria-label={label}
        value={Math.round(value)}
        max={100}
        className={`block h-3.5 w-full min-w-14 overflow-hidden rounded-full [&::-webkit-progress-bar]:bg-white/25 ${
          low
            ? "[&::-moz-progress-bar]:bg-red-400 [&::-webkit-progress-value]:bg-red-400"
            : "[&::-moz-progress-bar]:bg-lime-400 [&::-webkit-progress-value]:bg-lime-400"
        }`}
      />
    </div>
  );
}

/** Fuel, joy and tidiness as icon bars: nothing to read. */
export default function Meters({ pet }: { pet: Pet }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      <Meter icon="🔥" label="Fuel" value={pet.fuel} />
      <Meter icon="😊" label="Joy" value={pet.joy} />
      <Meter icon="🧹" label="Tidy" value={tidiness(pet)} />
    </div>
  );
}
