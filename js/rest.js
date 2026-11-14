import { $, showNotice, timeNow } from "./dom.js";
import { alarmOn, startAlarm } from "./alarm.js";
import { beep } from "./audio.js";
import { logEvent } from "./records.js";
import { hooks, runtime, settings } from "./state.js";

const WAKE_BLINKS = 3;
const ALARM_BLINKS = 5;
const WARN_MS = 30000;

let count = 0;
let countAt = 0;

let lastActive = performance.now();
let warnSecs = null; // seconds shown in the "resting soon" warning; null when no warning is up

export const isResting = () => runtime.resting;

// While resting the board is paused and eyes may stay shut for minutes, so a long eye-closure
// means nothing: waking and the alarm both need a run of deliberate blinks, then a pause.
export function startRest(source) {
  if (runtime.resting) return;
  runtime.resting = true;
  count = 0;
  $("rest").hidden = false;
  $("rest-since").textContent = `Resting since ${timeNow()}`;
  $("rest-count").textContent = "";
  warnSecs = null;
  showNotice(""); // also drops a stale camera-fault notice
  logEvent(`Rest started (${source})`);
  beep(330, 0.3);
}

export function endRest(source) {
  if (!runtime.resting) return;
  runtime.resting = false;
  markActive();
  count = 0;
  $("rest").hidden = true;
  hooks.scanClock();
  logEvent(`Rest ended (${source})`);
  beep(660, 0.15);
}

export function restBlink(now) {
  count++;
  countAt = now;
  beep(400 + count * 60, 0.1);
  $("rest-count").textContent = `${count} ${count === 1 ? "blink" : "blinks"} counted`;
}

// the pause after the last blink says the patient has finished counting
export function commitRest(now) {
  if (!runtime.resting || !count || now - countAt < settings.countWindow) return;
  const blinks = count;
  count = 0;
  $("rest-count").textContent = "";
  if (blinks === WAKE_BLINKS) endRest("blinks");
  else if (blinks >= ALARM_BLINKS) {
    endRest("alarm");
    startAlarm("blinks during rest");
  } else beep(200, 0.3); // not a command, so nothing happens
}

// ---- automatic rest after a stretch with no deliberate action ----

export function markActive(now = performance.now()) {
  lastActive = now;
  if (warnSecs !== null) clearWarning();
}

function clearWarning() {
  if (warnSecs === null) return;
  warnSecs = null;
  showNotice("");
}

// a blink during the warning only keeps the board awake; it must not also pick the lit tile
export function cancelRestWarning(now) {
  if (warnSecs === null) return false;
  markActive(now);
  return true;
}

// called every frame. The clock is held while someone is busy with the panel, calibration or an alarm.
export function checkIdle(now) {
  const limit = settings.autoRestMin * 60000;
  if (runtime.resting || !limit || alarmOn() || $("carer").open || !$("wizard").hidden) {
    lastActive = now;
    clearWarning();
    return;
  }
  const idle = now - lastActive;
  if (idle >= limit) {
    startRest("no activity");
    return;
  }
  if (idle < limit - Math.min(WARN_MS, limit * 0.3)) return;
  const secs = Math.ceil((limit - idle) / 1000);
  if (secs === warnSecs) return;
  if (warnSecs === null) beep(520, 0.15);
  warnSecs = secs;
  showNotice(`Resting in ${secs} ${secs === 1 ? "second" : "seconds"}. Blink once to stay awake.`);
}

export function initRest() {
  $("rest-btn").addEventListener("click", () => startRest("carer button"));
  $("rest-resume").addEventListener("click", () => endRest("carer tap"));
}
