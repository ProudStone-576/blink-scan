import { initAlarm } from "./alarm.js";
import { activate, announce, goBack, initBoard, touchScan } from "./board.js";
import { calibrator, initCalibration } from "./calibration-ui.js";
import { closeCarer, initCarer, openCarer, panelOpen, renderReadiness, renderSetup } from "./carer.js";
import { initEyes, resetClosure } from "./eyes.js";
import { initRecords } from "./records.js";
import { initSettings, syncSettings } from "./settings-ui.js";
import { hooks } from "./state.js";

// modules that would import each other talk through these
Object.assign(hooks, {
  announce,
  closePanel: closeCarer,
  openPanel: openCarer,
  faceChanged() {
    renderSetup();
    renderReadiness();
  },
  voiceHeard: renderReadiness,
  calibrated() {
    renderReadiness();
    renderSetup();
  },
  settingsChanged: syncSettings,
  resetClosure,
  scanClock: touchScan,
});

initSettings();
initBoard();
initCalibration();
initAlarm();
initRecords();
initEyes();
initKeys();
initCarer(); // last: it reads the state the other modules just set up

// Space acts as a manual "blink": lets a carer or tester drive the board without the camera
function initKeys() {
  document.addEventListener("keydown", (e) => {
    if (panelOpen()) return;
    if (e.code === "Escape" && !calibrator.active()) {
      goBack(performance.now());
      return;
    }
    if (e.code !== "Space" || ["TEXTAREA", "INPUT"].includes(e.target.tagName) || calibrator.active()) return;
    e.preventDefault();
    activate(performance.now());
  });
}
