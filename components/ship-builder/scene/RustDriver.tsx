"use client";

import { useFrame } from "@react-three/fiber";
import { getLiveTrialState } from "./liveTrial";
import { RUST, rustAmount } from "./rust";

/** Feeds the shared rust uniform from the live trial, once a frame. */
export default function RustDriver() {
  useFrame(() => {
    RUST.value = rustAmount(getLiveTrialState());
  });
  return null;
}
