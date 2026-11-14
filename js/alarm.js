import { ALARM_TEST_MS } from "./config.js";
import { $, timeNow } from "./dom.js";
import { beep, ensureAudio, speakCue } from "./audio.js";
import { notifyRaised, notifyStopped } from "./notify.js";
import { logEvent } from "./records.js";
import { hooks, settings } from "./state.js";

let timer = null;
let testTimer = null;
let isTest = false;
let wakeLock = null;

export const alarmOn = () => timer !== null;

// siren and repeated speech until a carer taps "stop" (or the patient holds their eyes shut to cancel)
export function startAlarm(source, test = false) {
  if (timer) return false;
  ensureAudio();
  isTest = test;
  hooks.closePanel();
  hooks.endRest(); // someone is calling for help, so the rest is over
  $("alarm-title").textContent = test ? "Alarm test" : "Help needed";
  $("alarm-detail").textContent = test ? "This is a test. Nothing is wrong." : `The patient called for help at ${timeNow()}.`;
  $("alarm").hidden = false;
  logEvent(test ? "Alarm test started" : `Alarm raised (${source})`);
  notifyRaised(test);
  let pulses = 0;
  const pulse = () => {
    beep(pulses % 2 ? 720 : 960, 0.4, 0.6);
    if (pulses % 14 === 0 && settings.speak) speakCue(test ? "Alarm test." : "Please come. I need help.", settings.rate);
    pulses++;
  };
  pulse();
  timer = setInterval(pulse, 450);
  if (test) testTimer = setTimeout(() => stopAlarm("test ended"), ALARM_TEST_MS);
  navigator.wakeLock?.request("screen").then((lock) => (wakeLock = lock)).catch(() => {});
  return true;
}

export function stopAlarm(how) {
  if (!timer) return;
  clearInterval(timer);
  clearTimeout(testTimer);
  timer = null;
  $("alarm").hidden = true;
  speechSynthesis?.cancel();
  wakeLock?.release().catch(() => {});
  wakeLock = null;
  hooks.scanClock();
  logEvent(isTest ? "Alarm test ended" : `Alarm stopped (${how})`);
  notifyStopped(isTest, how);
  if (isTest) hooks.openPanel("setup");
}

export function initAlarm() {
  $("alarm-btn").addEventListener("click", () => startAlarm("Alarm button"));
  $("alarm-stop").addEventListener("click", () => stopAlarm("acknowledged by carer"));
}
