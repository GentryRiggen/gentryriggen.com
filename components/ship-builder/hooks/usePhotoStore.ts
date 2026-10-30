import { create } from "zustand";
import { DEFAULT_PHOTO_ANGLE, type PhotoAngle } from "../scene/photoAngles";

interface PhotoState {
  isOpen: boolean;
  angle: PhotoAngle;
  /** Changes on every choice, so choosing the same angle again re-places the camera. */
  nonce: number;
  enter: () => void;
  exit: () => void;
  setAngle: (angle: PhotoAngle) => void;
}

/** Photo mode: a clean view of the ship for taking a picture. */
const usePhotoStore = create<PhotoState>((set, get) => ({
  isOpen: false,
  angle: DEFAULT_PHOTO_ANGLE,
  nonce: 0,
  enter: () =>
    set({ isOpen: true, angle: DEFAULT_PHOTO_ANGLE, nonce: get().nonce + 1 }),
  exit: () => set({ isOpen: false }),
  setAngle: (angle) => set({ angle, nonce: get().nonce + 1 }),
}));

export default usePhotoStore;
