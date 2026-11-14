import { FACE_CHIME_EVERY_MS, FACE_LOST_MS, VISION_MODULE, MODEL_URL, WASM_BASE } from "./config.js";
import { $, showNotice } from "./dom.js";
import { alarmOn, startAlarm } from "./alarm.js";
import { beep, ensureAudio, speakCue } from "./audio.js";
import { activate, advanceScan, commitCount, cooling, goBack, showHold, touchScan } from "./board.js";
import { calibrator } from "./calibration-ui.js";
import { logEvent } from "./records.js";
import { checkIdle, commitRest, isResting } from "./rest.js";
import { hooks, runtime, settings } from "./state.js";

const video = $("cam");
const statusEl = $("status");
const meterFill = $("meter-fill");

let lastVideoTime = -1;

// blink gestures, per eye-closure
let closedSince = null;
let backCued = false;
let alarmFired = false; // the current eye-closure already raised the alarm

// camera faults
let noFaceSince = null;
let faceLost = false;
let lastFaceChime = 0;

export function initEyes() {
  $("start").addEventListener("click", startCamera);
  requestAnimationFrame(tick);
}

async function startCamera() {
  // iPad Safari only allows speech after one real utterance from a tap; it ignores silent ones
  if (settings.speak) speakCue("Ready", settings.rate);
  $("start").disabled = true;
  statusEl.textContent = "Loading face model…";
  ensureAudio();
  try {
    const { FaceLandmarker, FilesetResolver } = await import(VISION_MODULE);
    const fileset = await FilesetResolver.forVisionTasks(WASM_BASE);
    const model = await FaceLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: MODEL_URL, delegate: "GPU" },
      runningMode: "VIDEO",
      numFaces: 1,
      outputFaceBlendshapes: true,
    });
    video.srcObject = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user", width: 640, height: 480 },
      audio: false,
    });
    await video.play();
    runtime.landmarker = model; // only now does tick() switch from timer-only scanning to blink detection
  } catch (err) {
    statusEl.textContent = `Failed: ${err.message}`;
    $("start").disabled = false;
    return;
  }
  $("start").hidden = true;
  $("calibrate").hidden = false;
  video.hidden = false;
  touchScan();
  logEvent("Camera started");
  hooks.faceChanged();
}

function tick(now) {
  requestAnimationFrame(tick);
  checkIdle(now);
  if (closedSince === null) {
    commitCount(now);
    commitRest(now);
  }
  if (!runtime.landmarker || video.readyState < 2) {
    advanceScan(now);
    return;
  }
  if (video.currentTime === lastVideoTime) return;
  lastVideoTime = video.currentTime;

  const closure = eyeClosure(runtime.landmarker.detectForVideo(video, now));

  if (calibrator.active()) {
    calibrator.feed(closure, now);
    if (closure !== null) meterFill.style.width = `${closure * 100}%`;
    return;
  }

  trackFace(closure !== null, now);

  if (closure === null) {
    statusEl.textContent = "No face found";
    resetClosure();
    advanceScan(now);
    return;
  }
  statusEl.textContent = "Tracking";
  meterFill.style.width = `${closure * 100}%`;

  const closed = closure >= settings.thr;
  meterFill.classList.toggle("closed", closed);

  if (closed) {
    holdingEyesShut(now);
    return; // scan freezes while eyes are shut so the lit tile cannot slip away
  }
  if (closedSince !== null) {
    eyesOpened(now);
    return;
  }
  advanceScan(now);
}

// eyes are shut: show the hold filling, cue the "go back" threshold, raise the alarm at the long hold
function holdingEyesShut(now) {
  if (closedSince === null) {
    closedSince = now;
    backCued = false;
    alarmFired = false;
  }
  if (isResting()) return; // eyes may stay shut for minutes; only blink counts mean anything now
  if (!alarmFired && !alarmOn() && now - closedSince >= settings.alarmHold) {
    alarmFired = true;
    startAlarm("eye hold");
  }
  if (!backCued && now - closedSince >= settings.backHold) {
    backCued = true;
    beep(300, 0.25); // low tone: opening the eyes now goes back
  }
  showHold(Math.min((now - closedSince) / settings.min, 1));
}

// eyes just opened: the length of the closure decides between a pick, going back, or nothing
function eyesOpened(now) {
  const held = now - closedSince;
  closedSince = null;
  showHold(0);
  touchScan(now);
  if (isResting()) {
    if (held >= settings.min && held < settings.backHold) activate(now);
    return;
  }
  if (alarmFired) {
    alarmFired = false; // this hold started the alarm; opening the eyes must not also dismiss it
    return;
  }
  if (held >= settings.backHold) goBack(now);
  else if (held >= settings.min && !cooling(now)) activate(now);
  else advanceScan(now);
}

function eyeClosure(result) {
  const shapes = result.faceBlendshapes?.[0]?.categories;
  if (!shapes) return null;
  const score = (name) => shapes.find((c) => c.categoryName === name)?.score ?? 0;
  return (score("eyeBlinkLeft") + score("eyeBlinkRight")) / 2;
}

export function resetClosure() {
  closedSince = null;
  meterFill.style.width = "0";
  showHold(0);
}

// a tracking fault is a technical alarm: a visible notice and a repeating chime until the face is back
function trackFace(seen, now) {
  if (seen) {
    noFaceSince = null;
    if (faceLost) {
      faceLost = false;
      logEvent("Camera can see the patient again");
      showNotice("");
    }
    if (!runtime.faceNow) {
      runtime.faceNow = true;
      hooks.faceChanged();
    }
    return;
  }
  if (isResting()) {
    noFaceSince = null; // a patient lying back out of view is not a camera fault
    faceLost = false;
    return;
  }
  noFaceSince ??= now;
  if (runtime.faceNow) {
    runtime.faceNow = false;
    hooks.faceChanged();
  }
  if (now - noFaceSince < FACE_LOST_MS) return;
  if (!faceLost) {
    faceLost = true;
    lastFaceChime = 0;
    logEvent("Camera cannot see the patient");
    showNotice("The camera cannot see the patient. Check the position and the light.");
  }
  if (now - lastFaceChime >= FACE_CHIME_EVERY_MS) {
    lastFaceChime = now;
    beep(523, 0.2);
    setTimeout(() => beep(392, 0.3), 250);
  }
}
