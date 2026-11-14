export const WASM_BASE = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm";
export const MODEL_URL = "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";
export const VISION_MODULE = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/+esm";

export const DEFAULTS = {
  step: 1500,
  min: 500,
  thr: 0.5,
  rate: 1,
  countWindow: 1500,
  backHold: 2000,
  alarmHold: 4000,
  rowSelect: "count",
  mirror: true,
  speak: true,
  calibratedAt: null,
};

export const KEYS = {
  settings: "blink-scan-settings",
  saved: "blink-scan-saved",
  events: "blink-scan-events",
  setup: "blink-scan-setup",
};

export const COOLDOWN_MS = 900;
export const COUNT_COOLDOWN_MS = 250;
export const ITEM_PASSES = 2;
export const LOG_LINES = 4;

export const MAX_EVENTS = 200;
export const SHOWN_EVENTS = 40;

export const FACE_LOST_MS = 15000;
export const FACE_CHIME_EVERY_MS = 20000;
export const ALARM_TEST_MS = 4000;

export const SETUP_STEPS = 6;
export const TABS = ["setup", "settings", "phrases", "records"];
