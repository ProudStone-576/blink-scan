import { KEYS, SETUP_STEPS, TABS } from "./config.js";
import { $, doneToday, fmtDay } from "./dom.js";
import { startAlarm } from "./alarm.js";
import { speakCue } from "./audio.js";
import { logEvent } from "./records.js";
import { runtime, settings, store } from "./state.js";
import { writeJson } from "./storage.js";

const carer = $("carer");

export const panelOpen = () => carer.open;

// ---- status chips (top bar) and the setup check ----

function setChip(id, ok) {
  $(id).dataset.state = ok ? "ok" : "warn";
}

export function renderReadiness() {
  setChip("chip-camera", Boolean(runtime.landmarker));
  const calibrated = settings.calibratedAt;
  $("calibration-state").textContent = calibrated ? `Calibrated ${fmtDay(calibrated)}` : "Not calibrated";
  setChip("chip-calibration", Boolean(calibrated));
  const checked = doneToday(store.setup.voice);
  $("voice-state").textContent = checked ? "Voice checked today" : runtime.voiceHeard ? "Voice ready" : "Voice not tested";
  setChip("chip-voice", checked || runtime.voiceHeard);
}

export function renderSetup() {
  const calibrated = settings.calibratedAt;
  const { landmarker, faceNow } = runtime;
  const steps = {
    notice: [Boolean(store.setup.notice), null],
    position: [Boolean(landmarker) && faceNow, !landmarker ? "Camera off" : faceNow ? "Face found" : "No face found"],
    camera: [Boolean(landmarker), landmarker ? "Running" : "Not started"],
    calibrate: [Boolean(calibrated), calibrated ? `Done ${fmtDay(calibrated)}` : "Not done"],
    voice: [doneToday(store.setup.voice), null],
    alarm: [doneToday(store.setup.alarm), null],
  };
  const stateId = { position: "face-state", camera: "camera-state", calibrate: "calibrate-state" };
  let done = 0;
  for (const [name, [ok, state]] of Object.entries(steps)) {
    $(`step-${name}`).dataset.done = String(ok);
    if (state) $(stateId[name]).textContent = state;
    if (ok) done++;
  }
  $("accept-notice").checked = steps.notice[0];
  $("confirm-voice").checked = steps.voice[0];
  $("confirm-alarm").checked = steps.alarm[0];
  const verdict = done === SETUP_STEPS ? "The system is ready to use." : "Finish the open steps before using it with the patient.";
  $("setup-summary").textContent = `Setup check: ${done} of ${SETUP_STEPS} done. ${verdict}`;
}

function confirmStep(key, checked, label) {
  store.setup[key] = checked ? new Date().toISOString() : null;
  writeJson(KEYS.setup, store.setup);
  if (checked) logEvent(label);
  renderSetup();
  renderReadiness();
}

// ---- the panel itself ----

export function openCarer(tab = "setup") {
  if (!carer.open) carer.showModal();
  selectTab(tab);
  renderSetup();
}

export function closeCarer() {
  if (carer.open) carer.close();
}

function selectTab(name) {
  TABS.forEach((tab) => {
    const selected = tab === name;
    const button = $(`tab-${tab}`);
    button.setAttribute("aria-selected", String(selected));
    button.tabIndex = selected ? 0 : -1;
    $(`panel-${tab}`).hidden = !selected;
  });
  history.replaceState(null, "", `#carer-${name}`);
}

export function initCarer() {
  $("open-carer").addEventListener("click", () => openCarer("setup"));
  $("close-carer").addEventListener("click", closeCarer);
  carer.addEventListener("close", () => history.replaceState(null, "", location.pathname + location.search));
  TABS.forEach((tab, i) => {
    $(`tab-${tab}`).addEventListener("click", () => selectTab(tab));
    $(`tab-${tab}`).addEventListener("keydown", (e) => {
      const step = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
      if (!step) return;
      const next = TABS[(i + step + TABS.length) % TABS.length];
      selectTab(next);
      $(`tab-${next}`).focus();
    });
  });
  $("accept-notice").addEventListener("change", (e) => confirmStep("notice", e.target.checked, "Safety notice accepted"));
  $("confirm-voice").addEventListener("change", (e) => confirmStep("voice", e.target.checked, "Voice check confirmed"));
  $("confirm-alarm").addEventListener("change", (e) => confirmStep("alarm", e.target.checked, "Alarm check confirmed"));
  $("test-voice").addEventListener("click", () => speakCue("Voice test. Can you hear me?", settings.rate));
  $("test-alarm").addEventListener("click", () => startAlarm("test", true));

  renderReadiness();
  renderSetup();

  const fromUrl = location.hash.match(/^#carer-(\w+)$/)?.[1];
  if (TABS.includes(fromUrl)) openCarer(fromUrl);
  else if (!store.setup.notice) openCarer("setup");
}
