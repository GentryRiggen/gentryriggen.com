import {
  BONUS_INFO,
  BONUS_KINDS,
  MAX_SHIELD_BONUS,
  MAX_STARS,
  TREASURE_COINS,
  coinFactor,
  greenHalf,
  type BonusKind,
  type Bonuses,
} from "@/lib/plane-builder/prestige";

const MAX_LIFT_LAUNCH_PERCENT = 100;

/** The total effect of `count` copies of a bonus, in plain words. */
export function totalEffect(kind: BonusKind, count: number): string {
  switch (kind) {
    case "coins":
      return `+${count * 10}% coins`;
    case "fuel":
      return `+${count * 10}% fuel`;
    case "lift":
      return `+${Math.min(MAX_LIFT_LAUNCH_PERCENT, count * 5)}% lift`;
    case "launch":
      return `+${Math.min(MAX_LIFT_LAUNCH_PERCENT, count * 5)}% launch speed`;
    case "clover":
      return `Green zones ${Math.round((greenHalf(count) / greenHalf(0) - 1) * 100)}% wider`;
    case "shield":
      return `+${Math.min(MAX_SHIELD_BONUS, count)} shield${count === 1 ? "" : "s"}`;
    case "treasure":
      return `Each world starts with +${count * TREASURE_COINS} coins`;
    case "star":
      return `Coins ×${2 ** Math.min(MAX_STARS, count)}`;
  }
}

function formatFactor(factor: number): string {
  return `×${Number(factor.toFixed(2))}`;
}

interface BonusSummaryProps {
  bonuses: Bonuses;
}

/** Every Sky Map bonus with how many you hold and what they add up to. */
export default function BonusSummary({ bonuses }: BonusSummaryProps) {
  const factor = coinFactor(bonuses);
  return (
    <div>
      <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
        Your bonuses{factor > 1 ? ` · ${formatFactor(factor)} coins` : ""}
      </p>
      <ul className="mt-1 flex flex-col gap-1">
        {BONUS_KINDS.map((kind) => {
          const count = bonuses[kind];
          const info = BONUS_INFO[kind];
          return (
            <li
              key={kind}
              data-bonus={kind}
              className={`flex items-baseline gap-2 text-sm ${
                count > 0
                  ? "text-slate-900 dark:text-slate-100"
                  : "text-slate-500 dark:text-slate-400"
              }`}
            >
              <span aria-hidden="true">{info.emoji}</span>
              <span className="font-semibold">{info.name}</span>
              <span className="font-bold">×{count}</span>
              <span className="ml-auto text-right">
                {count > 0 ? totalEffect(kind, count) : info.effect}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
