import { COOLDOWN_MS, COUNT_COOLDOWN_MS, ITEM_PASSES, KEYS, LOG_LINES } from "./config.js";
import { $, iconEl } from "./dom.js";
import { alarmOn, startAlarm, stopAlarm } from "./alarm.js";
import { beep, speakCue } from "./audio.js";
import { cancelRestWarning, isResting, markActive, restBlink, startRest } from "./rest.js";
import { getScreen } from "./screens.js";
import { hooks, settings, store } from "./state.js";
import { writeJson } from "./storage.js";
import { learn } from "./words.js";

const grid = $("grid");
const message = $("message");

let buffer = "";
let lastSpoken = "";
const conversation = [];

let lastStepAt = performance.now();
let cooldownUntil = 0;

// scan.row/item index into the current screen; in "flat" screens item indexes the flattened list
// scan.count: blinks counted so far while choosing a row in "count" screens
const scan = { screenId: "home", screen: null, level: "item", row: 0, item: 0, passes: 0, count: 0, countAt: 0 };
let dom = [];

// what screens.js may ask of the board
const ctx = {
  countMode: () => settings.rowSelect === "count",
  currentWord: () => buffer.match(/[a-z']*$/i)[0],
  type(ch) {
    if (/[.,?!]/.test(ch)) buffer = buffer.trimEnd() + ch + " ";
    else buffer += ch;
  },
  space() {
    if (buffer && !buffer.endsWith(" ")) buffer += " ";
  },
  backspace() {
    buffer = buffer.slice(0, -1);
  },
  pickWord(word) {
    buffer = buffer.slice(0, buffer.length - ctx.currentWord().length) + word + " ";
  },
  speakBuffer() {
    const text = buffer.trim();
    if (!text) return;
    learn(text);
    speakAndLog(text);
    buffer = "";
  },
  saveBuffer() {
    const text = buffer.trim();
    if (!text || store.savedPhrases.includes(text)) return;
    store.savedPhrases = [...store.savedPhrases, text];
    writeJson(KEYS.saved, store.savedPhrases);
    $("saved-text").value = store.savedPhrases.join("\n");
    announce("Saved.");
  },
  savedPhrases: () => store.savedPhrases,
  go: (id) => openScreen(id),
  alert: () => startAlarm("Alarm tile"),
  rest: () => startRest("patient"),
  language: () => settings.language,
  toggleLanguage() {
    settings.language = settings.language === "pa" ? "en" : "pa";
    writeJson(KEYS.settings, settings);
    hooks.settingsChanged();
    lastSpoken = settings.language === "pa" ? "Punjabi phrases are on" : "English phrases are on";
  },
};

export function initBoard() {
  $("clear-log").addEventListener("click", () => {
    conversation.length = 0;
    renderText();
  });
  openScreen("home");
}

export const currentScreenId = () => scan.screenId;
export const touchScan = (now = performance.now()) => {
  lastStepAt = now;
};
export const cooling = (now) => now < cooldownUntil;

export function openScreen(id) {
  scan.screenId = id;
  scan.screen = getScreen(id, ctx);
  scan.level = scan.screen.scan === "rows" ? "row" : "item";
  scan.row = 0;
  scan.item = 0;
  scan.passes = 0;
  scan.count = 0;
  lastStepAt = performance.now();
  renderScreen();
  renderText();
}

// one step up: letter scan -> row choice -> home
export function goBack(now) {
  if (isResting()) return;
  markActive(now);
  cooldownUntil = now + COOLDOWN_MS;
  lastStepAt = now;
  if (alarmOn()) {
    stopAlarm("cancelled by the patient");
    return;
  }
  beep(300, 0.15);
  if (scan.screen.scan === "rows" && scan.level === "item") {
    scan.level = "row";
    scan.count = 0;
    scan.item = 0;
    scan.passes = 0;
    renderLit();
  } else if (scan.count) {
    scan.count = 0;
    renderLit();
  } else if (scan.screenId !== "home") {
    openScreen("home");
  }
}

function isCounting() {
  return scan.screen.pick === "count" && scan.level === "row";
}

// the pause after the last blink is what tells us the patient has finished counting
export function commitCount(now) {
  if (!scan.count || now - scan.countAt < settings.countWindow) return;
  scan.level = "item";
  scan.item = 0;
  scan.passes = 0;
  scan.count = 0;
  lastStepAt = now;
  beep(990, 0.15);
  renderLit();
}

function countBlink(now) {
  cooldownUntil = now + COUNT_COOLDOWN_MS;
  scan.countAt = now;
  scan.count++;
  if (scan.count > scan.screen.rows.length) {
    scan.count = 0;
    beep(200, 0.3);
  } else {
    scan.row = scan.count - 1;
    beep(400 + scan.count * 80, 0.12);
  }
  renderLit();
}

const flatItems = () => scan.screen.rows.flat();

function currentItem() {
  return scan.screen.scan === "flat" ? flatItems()[scan.item] : scan.screen.rows[scan.row][scan.item];
}

export function advanceScan(now) {
  if (alarmOn() || isResting() || isCounting() || now < cooldownUntil || now - lastStepAt < settings.step) return;
  lastStepAt = now;
  const { rows } = scan.screen;
  if (scan.screen.scan === "flat") {
    scan.item = (scan.item + 1) % flatItems().length;
  } else if (scan.level === "row") {
    scan.row = (scan.row + 1) % rows.length;
  } else if (++scan.item >= rows[scan.row].length) {
    scan.item = 0;
    if (++scan.passes >= ITEM_PASSES) {
      scan.level = "row";
      scan.passes = 0;
    }
  }
  renderLit();
}

// a blink (or Space): counts toward a row, picks a row, or picks the lit item
export function activate(now) {
  if (alarmOn() || cancelRestWarning(now)) return;
  markActive(now);
  if (isResting()) {
    restBlink(now);
    return;
  }
  if (isCounting()) {
    countBlink(now);
    return;
  }
  cooldownUntil = now + COOLDOWN_MS;
  lastStepAt = now;
  beep(660, 0.1);

  if (scan.screen.scan === "rows" && scan.level === "row") {
    scan.level = "item";
    scan.item = 0;
    scan.passes = 0;
    renderLit();
    return;
  }

  const item = currentItem();
  const before = scan.screenId;
  if (item.run) item.run(ctx);
  else if (item.go) openScreen(item.go);
  else if (item.say) speakAndLog(item.say);
  // dynamic screens (predictions, saved list) depend on state the item just changed
  if (scan.screenId === before) openScreen(before);
  else renderText();
}

// ---- rendering ----

function renderScreen() {
  const { rows, cols, phoneCols } = scan.screen;
  grid.replaceChildren();
  grid.classList.toggle("compact", rows.length > 4);
  grid.classList.toggle("numbered", scan.screen.pick === "count");
  grid.dataset.screen = scan.screenId;
  dom = rows.map((items, rowIndex) => {
    const rowEl = document.createElement("div");
    rowEl.className = "row";
    rowEl.style.setProperty("--cols", cols ?? items.length);
    rowEl.style.setProperty("--cols-phone", phoneCols ?? cols ?? items.length);
    const rowFill = document.createElement("div");
    rowFill.className = "rowfill";
    rowEl.append(rowFill);
    if (scan.screen.pick === "count") {
      const badge = document.createElement("span");
      badge.className = "badge";
      badge.textContent = rowIndex + 1;
      rowEl.append(badge);
    }
    const tiles = items.map((item) => {
      const el = document.createElement("div");
      el.className = ["choice", item.key && "key", item.icon && "with-icon"].filter(Boolean).join(" ");
      el.setAttribute("role", "option");
      el.style.setProperty("--len", Math.max(item.label.length, 2));
      if (item.icon) el.append(iconEl(item.icon));
      const label = document.createElement("span");
      label.className = "label";
      label.textContent = item.label;
      const fill = document.createElement("div");
      fill.className = "fill";
      el.append(label, fill);
      rowEl.append(el);
      return { el, fill };
    });
    grid.append(rowEl);
    return { rowEl, rowFill, tiles };
  });
  renderLit();
}

// maps the scan cursor to the DOM row and tile it points at
function litPosition() {
  if (scan.screen.scan === "rows") return { row: scan.row, tile: scan.item };
  let i = scan.item;
  for (let row = 0; row < dom.length; row++) {
    if (i < dom[row].tiles.length) return { row, tile: i };
    i -= dom[row].tiles.length;
  }
}

function renderLit() {
  const { row, tile } = litPosition();
  const rowLevel = scan.screen.scan === "rows" && scan.level === "row";
  const rowShown = rowLevel && (scan.screen.pick !== "count" || scan.count > 0);
  dom.forEach((entry, r) => {
    entry.rowEl.classList.toggle("row-lit", rowShown && r === row);
    entry.rowEl.classList.toggle("row-active", !rowLevel && scan.screen.scan === "rows" && r === row);
    entry.rowFill.style.height = "0";
    entry.tiles.forEach((t, i) => {
      t.el.classList.toggle("lit", !rowLevel && r === row && i === tile);
      t.fill.style.height = "0";
    });
  });
  renderHint();
}

export function renderHint() {
  let text = "";
  if (scan.screen.pick === "count") {
    if (scan.level === "item") text = `Row ${scan.row + 1}: blink once when your letter is lit`;
    else if (scan.count) text = `Row ${scan.count}: wait to confirm, or blink again for row ${scan.count + 1}`;
    else text = "Blink once for row 1, twice for row 2, and so on. Then pause.";
  }
  const secs = (ms) => (ms / 1000).toFixed(0);
  const holds = [`Hold ${secs(settings.alarmHold)} s for the alarm`];
  if (scan.screenId !== "home") holds.unshift(`Hold ${secs(settings.backHold)} s to go back`);
  $("hint").textContent = [text, ...holds].filter(Boolean).join("    ");
}

// eye-hold feedback: the lit tile (or row) fills as the blink approaches its minimum length
export function showHold(fraction) {
  if (!dom.length) return;
  const { row, tile } = litPosition();
  let target;
  if (isCounting()) target = dom[Math.min(scan.count, dom.length - 1)].rowFill;
  else if (scan.screen.scan === "rows" && scan.level === "row") target = dom[row].rowFill;
  else target = dom[row].tiles[tile].fill;
  target.style.height = `${fraction * 100}%`;
}

function tidy(text) {
  return text
    .replace(/(^|[.?!]\s+)([a-z])/g, (_, lead, ch) => lead + ch.toUpperCase())
    .replace(/\bi\b/g, "I");
}

export function renderText() {
  if (scan.screenId === "type") {
    message.textContent = buffer ? `${tidy(buffer)}▍` : "Type with blinks… ▍";
  } else {
    message.textContent = lastSpoken || "Start the camera, then blink slowly to choose.";
  }
  $("log").replaceChildren(
    ...conversation.slice(-LOG_LINES).map((line) => {
      const p = document.createElement("p");
      p.textContent = line;
      return p;
    }),
  );
}

export function announce(text) {
  message.textContent = text;
  setTimeout(renderText, 1000);
}

function speakAndLog(text) {
  const spoken = tidy(text);
  lastSpoken = spoken;
  conversation.push(spoken);
  if (settings.speak) speakCue(spoken, settings.rate);
}
