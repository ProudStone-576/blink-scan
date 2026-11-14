import { $ } from "./dom.js";
import { hooks, runtime } from "./state.js";

let currentUtterance = null; // browsers can garbage-collect a playing utterance and cut it off
let speakTimer = null;

export function ensureAudio() {
  runtime.audioCtx ??= new AudioContext();
  runtime.audioCtx.resume();
}

export function beep(frequency, seconds, volume = 0.2) {
  const audio = runtime.audioCtx;
  if (!audio) return;
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  osc.frequency.value = frequency;
  gain.gain.setValueAtTime(volume, audio.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + seconds);
  osc.connect(gain).connect(audio.destination);
  osc.start();
  osc.stop(audio.currentTime + seconds);
}

export function speakCue(text, rate = 1, volume = 1) {
  if (!("speechSynthesis" in window)) {
    $("status").textContent = "This browser cannot speak";
    return;
  }
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = rate;
  utterance.volume = volume;
  utterance.lang = "en-US";
  utterance.onerror = (e) => {
    if (e.error !== "canceled" && e.error !== "interrupted") $("status").textContent = `Speech blocked: ${e.error}`;
  };
  utterance.onstart = () => {
    runtime.voiceHeard = true;
    hooks.voiceHeard();
  };
  currentUtterance = utterance;

  clearTimeout(speakTimer);
  if (speechSynthesis.speaking || speechSynthesis.pending) {
    // Chrome and Safari drop a speak() issued in the same tick as cancel()
    speechSynthesis.cancel();
    speakTimer = setTimeout(() => speechSynthesis.speak(utterance), 120);
  } else {
    speechSynthesis.speak(utterance);
  }
}
