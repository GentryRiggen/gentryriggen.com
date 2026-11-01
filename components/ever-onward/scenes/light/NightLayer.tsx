import type { LightSceneInfo } from "@/lib/ever-onward/universes/light";
import { makeStars, seeded } from "./random";

const PLANET = { cx: 200, cy: 440, r: 300 } as const;
const CITY_COUNT = 60;
const TWINKLES = ["lm-twinkle", "lm-twinkle-b", "lm-twinkle-c", ""] as const;
const STARS = makeStars(23, 46);

/** City lights on the visible cap of the planet, in the order they pop on. */
const CITIES = (() => {
  const rand = seeded(5);
  return Array.from({ length: CITY_COUNT }, (_, i) => {
    const angle = (rand() - 0.5) * 1.1;
    const depth = 6 + rand() * 66;
    const radius = PLANET.r - depth;
    return {
      x: PLANET.cx + radius * Math.sin(angle),
      y: PLANET.cy - radius * Math.cos(angle),
      halo: i % 4 === 0,
      twinkle: TWINKLES[i % TWINKLES.length],
    };
  });
})();

/** Power stations standing on the horizon of the planet. */
const STATIONS = [-92, 70, -40, 112, 20, -130].map((dx) => ({
  x: PLANET.cx + dx,
  y: PLANET.cy - Math.sqrt(PLANET.r ** 2 - dx ** 2),
}));

export default function NightLayer({ info }: { info: LightSceneInfo }) {
  const dawn = 1 - info.night;
  const lit = Math.min(
    CITY_COUNT,
    Math.round(info.citiesProgress * CITY_COUNT)
  );
  const cityCount = info.cities > 0 ? Math.max(1, lit) : 0;
  const brightness = 0.7 + 0.3 * info.powered;
  const stations = Math.min(
    STATIONS.length,
    Math.floor(Math.log2(info.generators + 1))
  );

  return (
    <g>
      <rect x="-1200" y="-1200" width="2800" height="2800" fill="#02030a" />
      <rect
        x="-1200"
        y="-1200"
        width="2800"
        height="1600"
        fill="url(#lm-dawn)"
        opacity={dawn * 0.9}
      />
      <g opacity={1 - dawn * 0.85}>
        {STARS.map((s, i) => (
          <circle
            key={i}
            cx={s.x}
            cy={s.y * 0.6}
            r={s.r}
            fill="#dfe8ff"
            className={s.twinkle}
          />
        ))}
      </g>
      <ellipse
        cx="200"
        cy="148"
        rx="280"
        ry="70"
        fill="url(#lm-lamp)"
        opacity={0.15 + dawn * 0.6}
      />
      <circle
        cx={PLANET.cx}
        cy={PLANET.cy}
        r={PLANET.r + 7}
        fill="none"
        stroke="#6cc4ff"
        strokeOpacity={0.18 + dawn * 0.3}
        strokeWidth="10"
      />
      <circle
        cx={PLANET.cx}
        cy={PLANET.cy}
        r={PLANET.r}
        fill="url(#lm-planet)"
        stroke="#7fc8ff"
        strokeOpacity="0.45"
        strokeWidth="2"
      />
      {STATIONS.slice(0, stations).map((s, i) => (
        <g key={i} transform={`translate(${s.x} ${s.y})`}>
          <g className="lm-pop-svg">
            <rect x="-1.5" y="-9" width="3" height="9" fill="#1c2742" />
            <circle cy="-10" r="1.5" fill="#ff6b5a" className="lm-twinkle" />
          </g>
        </g>
      ))}
      <g opacity={brightness}>
        {CITIES.slice(0, cityCount).map((c, i) => (
          <g key={i}>
            {c.halo && <circle cx={c.x} cy={c.y} r="6" fill="url(#lm-lamp)" />}
            <circle
              cx={c.x}
              cy={c.y}
              r="2"
              fill="#ffd98a"
              className={c.twinkle}
            />
          </g>
        ))}
      </g>
    </g>
  );
}
