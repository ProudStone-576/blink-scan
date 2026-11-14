import { DEFAULTS, KEYS } from "./config.js";
import { readJson } from "./storage.js";

export const settings = { ...DEFAULTS, ...readJson(KEYS.settings, {}) };

// what the carer wrote down and what the app recorded; all of it lives in this browser
export const store = {
  savedPhrases: readJson(KEYS.saved, []),
  events: readJson(KEYS.events, []),
  setup: readJson(KEYS.setup, {}), // ISO times the carer confirmed: notice, voice, alarm
};

// live objects and flags shared between modules
export const runtime = {
  landmarker: null,
  audioCtx: null,
  voiceHeard: false,
  faceNow: false,
};

// Modules that would import each other call through these instead. main.js fills them in.
export const hooks = {
  announce: () => {},
  closePanel: () => {},
  openPanel: () => {},
  faceChanged: () => {},
  voiceHeard: () => {},
  calibrated: () => {},
  settingsChanged: () => {},
  resetClosure: () => {},
  scanClock: () => {},
};
