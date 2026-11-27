import { placeFor, type PlaceId } from "@/lib/shipwreck/places";
import {
  eventsSeen,
  phaseAt,
  type PlaybackStore,
} from "@/lib/shipwreck/playback";
import { nextBoardable } from "@/lib/shipwreck/boatRide";
import { sampleTrack } from "@/lib/shipwreck/sim/track";
import type { ShipwreckSceneHooks } from "@/lib/shipwreck/testHooks";
import { CAMERA_IDS, type CameraId } from "@/lib/shipwreck/types";
import { WALK_TURN_PER_PX, walkInput } from "@/lib/shipwreck/walk";
import type { SceneRuntime } from "./runtime";

const clampUnit = (v: number) =>
  Number.isFinite(v) ? Math.max(-1, Math.min(1, v)) : 0;

/**
 * The test hooks for a playback store (`window.__shipwreck` in dev/e2e).
 * `runtime` is the scene's (where the walk runner writes the walker).
 */
export function sceneHooks(
  store: PlaybackStore,
  runtime?: SceneRuntime
): ShipwreckSceneHooks {
  const get = () => store.getState();
  return {
    seek: (t) => get().seek(t),
    play: () => get().play(),
    pause: () => get().pause(),
    setSpeed: (speed) => get().setSpeed(speed),
    setCamera: (camera) => {
      if ((CAMERA_IDS as readonly string[]).includes(camera))
        get().setCamera(camera as CameraId);
    },
    setXray: (on) => get().setXray(on),
    flyToPlace: (place) => {
      if (place === null) get().flyToPlace(null);
      else if (placeFor(get().ship, place)) get().flyToPlace(place as PlaceId);
    },
    setQuality: (q) => get().setQuality(q),
    // The time button's hour ("real" or one she offers), on the checking
    // entry too (the Poseidon's by-day screenshots).
    setTime: (id) => get().setTime(id === "real" ? null : id),
    flyToView: (target, cam, snap) => get().flyToView({ target, cam, snap }),
    getEvents: () => (get().track?.events ?? []).map((e) => ({ ...e })),
    getState: () => {
      const s = get();
      return {
        ship: s.ship,
        wreck: s.wreck ?? s.ship,
        t: s.t,
        realT: s.realT,
        phase: phaseAt(s.track, s.t),
        eventsSeen: eventsSeen(s.track, s.t),
        quality: s.quality,
        camera: s.camera,
        xray: s.xray,
        place: s.place,
        playing: s.playing,
        speed: s.speed,
        slowMo: s.slowMo,
        done: s.done,
        computedT: s.computedT,
        progress: s.progress,
        listDeg: s.track ? sampleTrack(s.track, s.t).listDeg : 0,
      };
    },
    getRenderInfo: () => {
      const r =
        typeof window === "undefined"
          ? undefined
          : window.__shipwreckRenderInfo;
      return r
        ? { calls: r.calls, triangles: r.triangles, camera: r.camera }
        : null;
    },
    isShown: (name) =>
      typeof window !== "undefined" &&
      (window.__shipwreckRenderInfo?.isShown(name) ?? false),
    pump: (budgetMs) => get().pump(Math.max(1, Math.min(500, budgetMs))),
    startWalk: () => get().startWalk(),
    jumpWalk: () => {
      walkInput.jump = true;
    },
    boardBoat: (index) => {
      const s = get();
      const i = index ?? (s.track ? nextBoardable(s.track.events, s.t) : null);
      if (i !== null && i !== undefined) s.boardBoat(i);
    },
    setWalkInput: (forward, strafe) => {
      walkInput.forward = clampUnit(forward);
      walkInput.strafe = clampUnit(strafe);
    },
    turnWalk: (yawRad) => {
      // The runner turns by −lookDx × WALK_TURN_PER_PX.
      if (Number.isFinite(yawRad))
        walkInput.lookDx -= yawRad / WALK_TURN_PER_PX;
    },
    getWalk: () => {
      const w = get().walk;
      const info = runtime?.walkInfo;
      if (w.phase === "off" || !info) return null;
      return {
        phase: info.phase,
        part: info.part ?? "none",
        x: info.x,
        y: info.y,
        slopeDeg: info.slopeDeg,
        depthM: info.depthM,
        lookUnder: w.lookUnder,
        area: info.area,
        inside: info.inside,
      };
    },
    placeWalk: (area, x, y, yaw) => {
      if (!runtime || ![x, y, yaw].every(Number.isFinite)) return;
      runtime.walkPlace = { area, x, y, yaw };
    },
    enterDoor: (id) => {
      walkInput.door = id ?? true;
    },
    goOutside: () => {
      walkInput.outside = true;
    },
    setLookUnder: (on) => get().setLookUnder(on),
  };
}
