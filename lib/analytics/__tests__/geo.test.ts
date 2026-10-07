import type { Topology } from "topojson-specification";
import {
  MAP_HEIGHT,
  MAP_WIDTH,
  geometryPath,
  landPath,
  locate,
  project,
} from "../geo";

describe("locate", () => {
  it("finds a known zone", () => {
    expect(locate("America/Denver")).toMatchObject({ city: "Denver" });
  });

  it("resolves aliases to the canonical zone", () => {
    expect(locate("Asia/Calcutta")).toEqual(locate("Asia/Kolkata"));
    expect(locate("Europe/Kiev")).toEqual(locate("Europe/Kyiv"));
  });

  it("returns null for unknown or empty zones", () => {
    expect(locate("Mars/Olympus_Mons")).toBeNull();
    expect(locate("")).toBeNull();
    expect(locate("UTC")).toBeNull();
  });
});

describe("project", () => {
  it("maps the corners and centre of the world", () => {
    expect(project(0, 0)).toEqual([MAP_WIDTH / 2, MAP_HEIGHT / 2]);
    expect(project(90, -180)).toEqual([0, 0]);
    expect(project(-90, 180)).toEqual([MAP_WIDTH, MAP_HEIGHT]);
  });
});

describe("geometryPath", () => {
  it("draws a polygon ring as a closed path", () => {
    const path = geometryPath(
      {
        type: "Polygon",
        coordinates: [
          [
            [0, 0],
            [10, 0],
            [10, 10],
          ],
        ],
      },
      360,
      180
    );
    expect(path).toBe("M180 90L190 90L190 80Z");
  });

  it("draws every polygon of a multipolygon", () => {
    const path = geometryPath(
      {
        type: "MultiPolygon",
        coordinates: [
          [
            [
              [0, 0],
              [10, 0],
              [10, 10],
            ],
          ],
          [
            [
              [20, 0],
              [30, 0],
              [30, 10],
            ],
          ],
        ],
      },
      360,
      180
    );
    expect(path.match(/M/g)).toHaveLength(2);
  });

  it("ignores other geometry", () => {
    expect(geometryPath(null, 360, 180)).toBe("");
    expect(geometryPath({ type: "Point", coordinates: [0, 0] }, 360, 180)).toBe(
      ""
    );
  });
});

describe("landPath", () => {
  it("converts a topology's land object to a path", () => {
    const topology = {
      type: "Topology",
      arcs: [
        [
          [0, 0],
          [10, 0],
          [0, 10],
          [-10, 0],
          [0, -10],
        ],
      ],
      objects: {
        land: {
          type: "GeometryCollection",
          geometries: [{ type: "Polygon", arcs: [[0]] }],
        },
      },
    } as unknown as Topology;
    const path = landPath(topology);
    expect(path.startsWith("M")).toBe(true);
    expect(path.endsWith("Z")).toBe(true);
  });
});
