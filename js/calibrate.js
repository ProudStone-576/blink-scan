const OPEN_MS = 3000;
const CLOSED_SETTLE_MS = 900;
const CLOSED_MS = 2500;
const BLINKS_NEEDED = 3;
const BLINK_TIMEOUT_MS = 25000;
const MIN_COUNTED_BLINK_MS = 100;
const MIN_SEPARATION = 0.25;

const percentile = (values, p) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];
};
const roundTo = (value, step) => Math.round(value / step) * step;
const clamp = (value, lo, hi) => Math.min(hi, Math.max(lo, value));

// Eyes are shut during parts of the wizard, so every cue is also spoken or beeped.
export function createCalibrator({ ui, say, beep, onDone }) {
  let phase = null;
  let phaseStart = 0;
  let samples = [];
  let openHigh = 0;
  let threshold = 0;
  let closedSince = null;
  let blinkDurations = [];

  const active = () => phase !== null;

  function enter(next, now, instruction, spoken) {
    phase = next;
    phaseStart = now;
    samples = [];
    ui.setStep(instruction, 0);
    if (spoken) say(spoken);
  }

  function start(now) {
    ui.show();
    blinkDurations = [];
    closedSince = null;
    enter("open", now, "Look at the screen with eyes relaxed and open.", "Keep your eyes open and relaxed.");
  }

  function cancel() {
    phase = null;
    ui.hide();
  }

  function fail(now, reason) {
    ui.setNote(reason);
    enter("open", now, "Let's try again. Eyes relaxed and open.", "Let's try again. Keep your eyes open.");
  }

  function feed(closure, now) {
    if (!active()) return;
    if (closure === null) {
      phaseStart = now;
      samples = [];
      ui.setNote("Face not found. Centre your face in the camera.");
      return;
    }
    ui.setNote("");
    if (phase === "open") feedOpen(closure, now);
    else if (phase === "closed") feedClosed(closure, now);
    else if (phase === "blinks") feedBlinks(closure, now);
  }

  function feedOpen(closure, now) {
    samples.push(closure);
    const elapsed = now - phaseStart;
    ui.setProgress(elapsed / OPEN_MS);
    if (elapsed < OPEN_MS) return;
    openHigh = percentile(samples, 0.95);
    beep();
    enter("closed", now, "Close your eyes and keep them shut until you hear the beep.", "Now close your eyes. Hold them shut until the beep.");
  }

  function feedClosed(closure, now) {
    const elapsed = now - phaseStart;
    ui.setProgress(elapsed / (CLOSED_SETTLE_MS + CLOSED_MS));
    if (elapsed >= CLOSED_SETTLE_MS) samples.push(closure);
    if (elapsed < CLOSED_SETTLE_MS + CLOSED_MS) return;
    beep();
    const closedMid = percentile(samples, 0.5);
    if (closedMid - openHigh < MIN_SEPARATION) {
      fail(now, "Closed eyes barely differ from open. Check lighting and camera angle.");
      return;
    }
    threshold = clamp(roundTo(openHigh + (closedMid - openHigh) / 2, 0.05), 0.2, 0.9);
    blinkDurations = [];
    closedSince = null;
    enter("blinks", now, `Blink slowly and deliberately, the way you would to choose. 0 of ${BLINKS_NEEDED}.`, "Now blink slowly, three times.");
  }

  function feedBlinks(closure, now) {
    const elapsed = now - phaseStart;
    if (elapsed > BLINK_TIMEOUT_MS) {
      finish(now, false);
      return;
    }
    const closed = closure >= threshold;
    if (closed && closedSince === null) closedSince = now;
    if (!closed && closedSince !== null) {
      const held = now - closedSince;
      closedSince = null;
      if (held >= MIN_COUNTED_BLINK_MS) {
        blinkDurations.push(held);
        beep();
        ui.setStep(`Blink slowly and deliberately. ${blinkDurations.length} of ${BLINKS_NEEDED}.`, blinkDurations.length / BLINKS_NEEDED);
      }
    }
    if (blinkDurations.length >= BLINKS_NEEDED) finish(now, true);
  }

  function finish(now, measuredBlinks) {
    const result = { thr: threshold };
    if (measuredBlinks) {
      result.min = clamp(roundTo(percentile(blinkDurations, 0.5) * 0.7, 50), 100, 1200);
    }
    phase = null;
    onDone(result);
    const blinkText = measuredBlinks ? `Blink length ${(result.min / 1000).toFixed(2)} s.` : "Blink length unchanged (not enough blinks seen).";
    ui.showResult(`Closed threshold ${result.thr.toFixed(2)}. ${blinkText}`);
    say("Calibration done.");
  }

  return { start, cancel, feed, active };
}
