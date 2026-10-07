"use client";

import { useEffect, useState } from "react";
import type { Topology } from "topojson-specification";
import type { Place } from "@/lib/analytics/aggregate";
import {
  MAP_HEIGHT,
  MAP_WIDTH,
  landPath,
  locate,
  project,
} from "@/lib/analytics/geo";

export default function VisitorMap({ places }: { places: Place[] }) {
  const [land, setLand] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void import("world-atlas/land-110m.json").then((module) => {
      if (!cancelled) setLand(landPath(module.default as unknown as Topology));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const dots = places.flatMap((place) => {
    const spot = locate(place.tz);
    return spot ? [{ place, spot }] : [];
  });
  const unplaced = places
    .filter((place) => !locate(place.tz))
    .reduce((sum, place) => sum + place.visitors, 0);
  const max = Math.max(1, ...dots.map((d) => d.place.visitors));

  return (
    <section className="rounded-lg border border-gray-200 p-4 dark:border-gray-800">
      <h3 className="mb-3 text-sm font-medium text-gray-600 dark:text-gray-400">
        Where visitors are (by browser timezone)
      </h3>
      <svg
        viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
        role="img"
        aria-label="World map of visitors by timezone region"
        className="w-full rounded bg-gray-50 dark:bg-gray-900"
      >
        {land && <path d={land} className="fill-gray-300 dark:fill-gray-700" />}
        {dots.map(({ place, spot }) => {
          const [x, y] = project(spot.lat, spot.lng);
          const radius = 4 + 12 * Math.sqrt(place.visitors / max);
          return (
            <circle
              key={place.tz}
              cx={x}
              cy={y}
              r={radius}
              className="fill-blue-500/60 stroke-blue-600 dark:fill-blue-400/60 dark:stroke-blue-300"
            >
              <title>{`${spot.city}: ${place.visitors} visitors, ${place.views} views`}</title>
            </circle>
          );
        })}
      </svg>
      {unplaced > 0 && (
        <p className="mt-2 text-xs text-gray-500">
          {unplaced.toLocaleString()} visitor-days from timezones not on the
          map.
        </p>
      )}
    </section>
  );
}
