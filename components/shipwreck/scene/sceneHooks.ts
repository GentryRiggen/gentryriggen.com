import { placeFor, type PlaceId } from "@/lib/shipwreck/places";
import {
  eventsSeen,
  phaseAt,
  type PlaybackStore,
} from "@/lib/shipwreck/playback";
import type { ShipwreckSceneHooks } from "@/lib/shipwreck/testHooks";
import { CAMERA_IDS, type CameraId } from "@/lib/shipwreck/types";

/** The test hooks for a playback store (`window.__shipwreck` in dev/e2e). */
export function sceneHooks(store: PlaybackStore): ShipwreckSceneHooks {
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
    flyToView: (target, cam, snap) => get().flyToView({ target, cam, snap }),
    getEvents: () => (get().track?.events ?? []).map((e) => ({ ...e })),
    getState: () => {
      const s = get();
      return {
        ship: s.ship,
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
  };
}
