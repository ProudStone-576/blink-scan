import { DEFAULTS, KEYS } from "./config.js";
import { $ } from "./dom.js";
import { currentScreenId, openScreen, renderHint } from "./board.js";
import { settings, store } from "./state.js";
import { writeJson } from "./storage.js";

const SLIDERS = [
  ["step", "out-step", (v) => `${(v / 1000).toFixed(1)} s`],
  ["min", "out-min", (v) => `${(v / 1000).toFixed(2)} s`],
  ["thr", "out-thr", (v) => v.toFixed(2)],
  ["rate", "out-rate", (v) => `${v.toFixed(1)}×`],
  ["countWindow", "out-count", (v) => `${(v / 1000).toFixed(1)} s`],
  ["backHold", "out-back", (v) => `${(v / 1000).toFixed(1)} s`],
  ["alarmHold", "out-alarm", (v) => `${(v / 1000).toFixed(1)} s`],
];

const save = () => writeJson(KEYS.settings, settings);

// pushes the settings object into the controls, the camera preview and the threshold marker
export function syncSettings() {
  const video = $("cam");
  for (const [key, outId, fmt] of SLIDERS) {
    $(key).value = settings[key];
    $(outId).textContent = fmt(Number(settings[key]));
  }
  $("rowSelect").value = settings.rowSelect;
  $("autoRest").value = String(settings.autoRestMin);
  $("language").value = settings.language;
  $("voiceAccent").value = settings.voiceAccent;
  $("mirror").checked = settings.mirror;
  $("speak").checked = settings.speak;
  video.classList.toggle("hidden", !settings.mirror);
  $("meter-threshold").style.left = `${settings.thr * 100}%`;
}

export function initSettings() {
  for (const [key] of SLIDERS) {
    $(key).addEventListener("input", (e) => {
      settings[key] = Number(e.target.value);
      syncSettings();
      save();
      renderHint();
    });
  }
  for (const key of ["mirror", "speak"]) {
    $(key).addEventListener("change", (e) => {
      settings[key] = e.target.checked;
      syncSettings();
      save();
    });
  }
  $("language").addEventListener("change", (e) => {
    settings.language = e.target.value;
    save();
    openScreen(currentScreenId());
  });
  $("voiceAccent").addEventListener("change", (e) => {
    settings.voiceAccent = e.target.value;
    save();
  });
  $("autoRest").addEventListener("change", (e) => {
    settings.autoRestMin = Number(e.target.value);
    save();
  });
  $("rowSelect").addEventListener("change", (e) => {
    settings.rowSelect = e.target.value;
    save();
    if (currentScreenId() === "type") openScreen("type");
  });
  $("reset").addEventListener("click", () => {
    // the phone alert setup and the phrase language are not blink tuning: resetting must not undo them
    const { notifyOn, notifyTopic, notifyServer, language } = settings;
    Object.assign(settings, DEFAULTS, { notifyOn, notifyTopic, notifyServer, language });
    syncSettings();
    save();
  });
  $("saved-text").value = store.savedPhrases.join("\n");
  $("saved-text").addEventListener("change", (e) => {
    store.savedPhrases = e.target.value.split("\n").map((line) => line.trim()).filter(Boolean);
    writeJson(KEYS.saved, store.savedPhrases);
    if (currentScreenId() === "saved") openScreen("saved");
  });
  syncSettings();
}
