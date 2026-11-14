import { $ } from "./dom.js";
import { beep, ensureAudio, speakCue } from "./audio.js";
import { createCalibrator } from "./calibrate.js";
import { logEvent } from "./records.js";
import { hooks, settings } from "./state.js";
import { KEYS } from "./config.js";
import { writeJson } from "./storage.js";

function wizardUi() {
  const wizard = $("wizard");
  const setProgress = (fraction) => {
    $("wizard-bar").style.width = `${Math.min(fraction, 1) * 100}%`;
  };
  return {
    show() {
      ensureAudio();
      wizard.hidden = false;
      $("wizard-close").hidden = true;
      $("wizard-cancel").hidden = false;
      hooks.resetClosure();
    },
    hide() {
      wizard.hidden = true;
      speechSynthesis?.cancel();
      hooks.scanClock();
    },
    setStep(text, fraction) {
      $("wizard-step").textContent = text;
      setProgress(fraction);
    },
    setProgress,
    setNote(text) {
      $("wizard-note").textContent = text;
    },
    showResult(text) {
      $("wizard-step").textContent = text;
      setProgress(1);
      $("wizard-close").hidden = false;
      $("wizard-cancel").hidden = true;
    },
  };
}

export const calibrator = createCalibrator({
  ui: wizardUi(),
  say: speakCue,
  beep: () => beep(880, 0.25),
  onDone(result) {
    Object.assign(settings, result, { calibratedAt: new Date().toISOString() });
    writeJson(KEYS.settings, settings);
    const length = result.min ? `${result.min} ms` : "unchanged";
    logEvent(`Calibrated: closed threshold ${result.thr.toFixed(2)}, blink length ${length}`);
    hooks.settingsChanged();
    hooks.calibrated();
  },
});

export function initCalibration() {
  $("calibrate").addEventListener("click", () => calibrator.start(performance.now()));
  $("wizard-cancel").addEventListener("click", () => calibrator.cancel());
  $("wizard-close").addEventListener("click", () => calibrator.cancel());
}
