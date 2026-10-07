import { feature } from "topojson-client";
import type { Topology } from "topojson-specification";

export const MAP_WIDTH = 1000;
export const MAP_HEIGHT = 500;

export interface Spot {
  city: string;
  lat: number;
  lng: number;
}

// [IANA zone, principal city, lat, lng]. Region-level on purpose: the browser
// timezone is all we know about where a visitor is.
const ZONES: [string, string, number, number][] = [
  ["America/New_York", "New York", 40.71, -74.01],
  ["America/Chicago", "Chicago", 41.88, -87.63],
  ["America/Denver", "Denver", 39.74, -104.99],
  ["America/Phoenix", "Phoenix", 33.45, -112.07],
  ["America/Los_Angeles", "Los Angeles", 34.05, -118.24],
  ["America/Anchorage", "Anchorage", 61.22, -149.9],
  ["Pacific/Honolulu", "Honolulu", 21.31, -157.86],
  ["America/Detroit", "Detroit", 42.33, -83.05],
  ["America/Indiana/Indianapolis", "Indianapolis", 39.77, -86.16],
  ["America/Boise", "Boise", 43.62, -116.2],
  ["America/Toronto", "Toronto", 43.65, -79.38],
  ["America/Vancouver", "Vancouver", 49.28, -123.12],
  ["America/Edmonton", "Edmonton", 53.55, -113.49],
  ["America/Winnipeg", "Winnipeg", 49.9, -97.14],
  ["America/Regina", "Regina", 50.45, -104.62],
  ["America/Halifax", "Halifax", 44.65, -63.57],
  ["America/St_Johns", "St. John's", 47.56, -52.71],
  ["America/Mexico_City", "Mexico City", 19.43, -99.13],
  ["America/Monterrey", "Monterrey", 25.69, -100.32],
  ["America/Tijuana", "Tijuana", 32.51, -117.04],
  ["America/Cancun", "Cancún", 21.16, -86.85],
  ["America/Guatemala", "Guatemala City", 14.63, -90.51],
  ["America/Costa_Rica", "San José", 9.93, -84.08],
  ["America/Panama", "Panama City", 8.98, -79.52],
  ["America/Havana", "Havana", 23.11, -82.37],
  ["America/Jamaica", "Kingston", 18.0, -76.79],
  ["America/Puerto_Rico", "San Juan", 18.47, -66.11],
  ["America/Bogota", "Bogotá", 4.71, -74.07],
  ["America/Lima", "Lima", -12.05, -77.04],
  ["America/Caracas", "Caracas", 10.48, -66.9],
  ["America/Guayaquil", "Guayaquil", -2.17, -79.92],
  ["America/La_Paz", "La Paz", -16.5, -68.15],
  ["America/Asuncion", "Asunción", -25.26, -57.58],
  ["America/Santiago", "Santiago", -33.45, -70.67],
  ["America/Argentina/Buenos_Aires", "Buenos Aires", -34.6, -58.38],
  ["America/Montevideo", "Montevideo", -34.9, -56.16],
  ["America/Sao_Paulo", "São Paulo", -23.55, -46.63],
  ["Atlantic/Reykjavik", "Reykjavík", 64.15, -21.94],
  ["Atlantic/Azores", "Azores", 37.74, -25.67],
  ["Europe/London", "London", 51.51, -0.13],
  ["Europe/Dublin", "Dublin", 53.35, -6.26],
  ["Europe/Lisbon", "Lisbon", 38.72, -9.14],
  ["Europe/Madrid", "Madrid", 40.42, -3.7],
  ["Europe/Paris", "Paris", 48.86, 2.35],
  ["Europe/Brussels", "Brussels", 50.85, 4.35],
  ["Europe/Amsterdam", "Amsterdam", 52.37, 4.9],
  ["Europe/Berlin", "Berlin", 52.52, 13.41],
  ["Europe/Zurich", "Zurich", 47.38, 8.54],
  ["Europe/Vienna", "Vienna", 48.21, 16.37],
  ["Europe/Rome", "Rome", 41.9, 12.5],
  ["Europe/Prague", "Prague", 50.08, 14.44],
  ["Europe/Warsaw", "Warsaw", 52.23, 21.01],
  ["Europe/Budapest", "Budapest", 47.5, 19.04],
  ["Europe/Stockholm", "Stockholm", 59.33, 18.07],
  ["Europe/Oslo", "Oslo", 59.91, 10.75],
  ["Europe/Copenhagen", "Copenhagen", 55.68, 12.57],
  ["Europe/Helsinki", "Helsinki", 60.17, 24.94],
  ["Europe/Athens", "Athens", 37.98, 23.73],
  ["Europe/Bucharest", "Bucharest", 44.43, 26.1],
  ["Europe/Sofia", "Sofia", 42.7, 23.32],
  ["Europe/Belgrade", "Belgrade", 44.79, 20.45],
  ["Europe/Zagreb", "Zagreb", 45.81, 15.98],
  ["Europe/Vilnius", "Vilnius", 54.69, 25.28],
  ["Europe/Riga", "Riga", 56.95, 24.11],
  ["Europe/Tallinn", "Tallinn", 59.44, 24.75],
  ["Europe/Kyiv", "Kyiv", 50.45, 30.52],
  ["Europe/Istanbul", "Istanbul", 41.01, 28.98],
  ["Europe/Moscow", "Moscow", 55.76, 37.62],
  ["Africa/Casablanca", "Casablanca", 33.57, -7.59],
  ["Africa/Algiers", "Algiers", 36.75, 3.06],
  ["Africa/Tunis", "Tunis", 36.81, 10.18],
  ["Africa/Cairo", "Cairo", 30.04, 31.24],
  ["Africa/Lagos", "Lagos", 6.52, 3.38],
  ["Africa/Accra", "Accra", 5.6, -0.19],
  ["Africa/Addis_Ababa", "Addis Ababa", 9.03, 38.74],
  ["Africa/Khartoum", "Khartoum", 15.5, 32.56],
  ["Africa/Nairobi", "Nairobi", -1.29, 36.82],
  ["Africa/Kinshasa", "Kinshasa", -4.44, 15.27],
  ["Africa/Harare", "Harare", -17.83, 31.05],
  ["Africa/Johannesburg", "Johannesburg", -26.2, 28.05],
  ["Asia/Jerusalem", "Jerusalem", 31.77, 35.22],
  ["Asia/Beirut", "Beirut", 33.89, 35.5],
  ["Asia/Amman", "Amman", 31.95, 35.93],
  ["Asia/Baghdad", "Baghdad", 33.31, 44.36],
  ["Asia/Riyadh", "Riyadh", 24.71, 46.68],
  ["Asia/Kuwait", "Kuwait City", 29.38, 47.99],
  ["Asia/Qatar", "Doha", 25.29, 51.53],
  ["Asia/Dubai", "Dubai", 25.2, 55.27],
  ["Asia/Tehran", "Tehran", 35.69, 51.39],
  ["Asia/Baku", "Baku", 40.41, 49.87],
  ["Asia/Tbilisi", "Tbilisi", 41.72, 44.79],
  ["Asia/Yerevan", "Yerevan", 40.18, 44.51],
  ["Asia/Kabul", "Kabul", 34.53, 69.17],
  ["Asia/Karachi", "Karachi", 24.86, 67.01],
  ["Asia/Tashkent", "Tashkent", 41.3, 69.24],
  ["Asia/Almaty", "Almaty", 43.24, 76.89],
  ["Asia/Kolkata", "Kolkata", 22.57, 88.36],
  ["Asia/Kathmandu", "Kathmandu", 27.72, 85.32],
  ["Asia/Dhaka", "Dhaka", 23.81, 90.41],
  ["Asia/Colombo", "Colombo", 6.93, 79.86],
  ["Asia/Yangon", "Yangon", 16.84, 96.17],
  ["Asia/Bangkok", "Bangkok", 13.76, 100.5],
  ["Asia/Ho_Chi_Minh", "Ho Chi Minh City", 10.82, 106.63],
  ["Asia/Jakarta", "Jakarta", -6.21, 106.85],
  ["Asia/Kuala_Lumpur", "Kuala Lumpur", 3.14, 101.69],
  ["Asia/Singapore", "Singapore", 1.35, 103.82],
  ["Asia/Manila", "Manila", 14.6, 120.98],
  ["Asia/Hong_Kong", "Hong Kong", 22.32, 114.17],
  ["Asia/Shanghai", "Shanghai", 31.23, 121.47],
  ["Asia/Taipei", "Taipei", 25.03, 121.57],
  ["Asia/Seoul", "Seoul", 37.57, 126.98],
  ["Asia/Tokyo", "Tokyo", 35.68, 139.69],
  ["Asia/Ulaanbaatar", "Ulaanbaatar", 47.89, 106.91],
  ["Asia/Yekaterinburg", "Yekaterinburg", 56.84, 60.61],
  ["Asia/Novosibirsk", "Novosibirsk", 55.01, 82.93],
  ["Asia/Vladivostok", "Vladivostok", 43.12, 131.89],
  ["Australia/Perth", "Perth", -31.95, 115.86],
  ["Australia/Darwin", "Darwin", -12.46, 130.84],
  ["Australia/Adelaide", "Adelaide", -34.93, 138.6],
  ["Australia/Brisbane", "Brisbane", -27.47, 153.03],
  ["Australia/Sydney", "Sydney", -33.87, 151.21],
  ["Australia/Melbourne", "Melbourne", -37.81, 144.96],
  ["Australia/Hobart", "Hobart", -42.88, 147.33],
  ["Pacific/Auckland", "Auckland", -36.85, 174.76],
  ["Pacific/Fiji", "Suva", -18.14, 178.44],
  ["Pacific/Guam", "Guam", 13.44, 144.79],
  ["Pacific/Port_Moresby", "Port Moresby", -9.44, 147.18],
];

const ALIASES: Record<string, string> = {
  "Asia/Calcutta": "Asia/Kolkata",
  "Asia/Katmandu": "Asia/Kathmandu",
  "Asia/Dacca": "Asia/Dhaka",
  "Asia/Saigon": "Asia/Ho_Chi_Minh",
  "Asia/Rangoon": "Asia/Yangon",
  "Europe/Kiev": "Europe/Kyiv",
  "America/Buenos_Aires": "America/Argentina/Buenos_Aires",
  "America/Indianapolis": "America/Indiana/Indianapolis",
  "America/Montreal": "America/Toronto",
  "Australia/Canberra": "Australia/Sydney",
};

const SPOTS = new Map<string, Spot>(
  ZONES.map(([tz, city, lat, lng]) => [tz, { city, lat, lng }])
);

/** Where an IANA timezone sits on the map, or null if we don't know it. */
export function locate(tz: string): Spot | null {
  return SPOTS.get(ALIASES[tz] ?? tz) ?? null;
}

/** Equirectangular projection into the 1000x500 SVG space. */
export function project(
  lat: number,
  lng: number,
  width: number = MAP_WIDTH,
  height: number = MAP_HEIGHT
): [number, number] {
  return [((lng + 180) / 360) * width, ((90 - lat) / 180) * height];
}

const round = (n: number) => Number(n.toFixed(1));

function ringsToPath(rings: number[][][], width: number, height: number) {
  return rings
    .map((ring) => {
      const points = ring.map(([lng, lat]) => {
        const [x, y] = project(lat, lng, width, height);
        return `${round(x)} ${round(y)}`;
      });
      return `M${points.join("L")}Z`;
    })
    .join("");
}

/** SVG path for a GeoJSON Polygon or MultiPolygon; empty for anything else. */
export function geometryPath(
  geometry: { type: string; coordinates?: unknown } | null,
  width: number = MAP_WIDTH,
  height: number = MAP_HEIGHT
): string {
  if (!geometry) return "";
  if (geometry.type === "Polygon") {
    return ringsToPath(geometry.coordinates as number[][][], width, height);
  }
  if (geometry.type === "MultiPolygon") {
    return (geometry.coordinates as number[][][][])
      .map((polygon) => ringsToPath(polygon, width, height))
      .join("");
  }
  return "";
}

/** SVG path of the `land` object of a world-atlas topology. */
export function landPath(topology: Topology): string {
  const land = feature(topology, topology.objects.land);
  const features = land.type === "FeatureCollection" ? land.features : [land];
  return features.map((f) => geometryPath(f.geometry)).join("");
}
