"use client";

import { createChannelSettings } from "../../game-audio/channels";

/**
 * Music, sound-effects and voice switches, remembered per device (all default
 * on).
 */
export const shipChannels = createChannelSettings("ship-builder", {
  voice: true,
});
