"use client";

import { createChannelSettings } from "../../game-audio/channels";

/** Music and sound-effects switches, remembered per device (both default on). */
export const shipChannels = createChannelSettings("ship-builder");
