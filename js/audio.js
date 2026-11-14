import { $ } from "./dom.js";
import { hooks, runtime, settings } from "./state.js";

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

// Punjabi in English letters is read far better by an Indian English voice than by a US one
function wantedAccent() {
  if (settings.voiceAccent !== "auto") return settings.voiceAccent;
  return settings.language === "pa" ? "en-IN" : null;
}

// only a voice that is really installed; otherwise the device default, which is known to work
function findVoice(accent) {
  if (!accent) return null;
  const same = (lang) => lang.replace("_", "-").toLowerCase() === accent.toLowerCase();
  return (speechSynthesis.getVoices?.() ?? []).find((voice) => same(voice.lang) && voice.localService !== false) ?? null;
}

export function speakCue(text, rate = 1, volume = 1) {
  if (!("speechSynthesis" in window)) {
    $("status").textContent = "This browser cannot speak";
    return;
  }
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = rate;
  utterance.volume = volume;
  const voice = findVoice(wantedAccent());
  utterance.lang = voice ? voice.lang : "en-US";
  if (voice) utterance.voice = voice;
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
