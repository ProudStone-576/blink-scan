import { KEYS, MAX_EVENTS, SHOWN_EVENTS } from "./config.js";
import { $ } from "./dom.js";
import { hooks, store } from "./state.js";
import { writeJson } from "./storage.js";

export function logEvent(text) {
  store.events = [{ t: new Date().toISOString(), text }, ...store.events].slice(0, MAX_EVENTS);
  writeJson(KEYS.events, store.events);
  renderEvents();
}

export function renderEvents() {
  $("events").replaceChildren(
    ...store.events.slice(0, SHOWN_EVENTS).map(({ t, text }) => {
      const row = document.createElement("tr");
      const when = document.createElement("td");
      const time = document.createElement("time");
      time.dateTime = t;
      time.textContent = new Date(t).toLocaleString([], { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", second: "2-digit" });
      when.append(time);
      const what = document.createElement("td");
      what.textContent = text;
      row.append(when, what);
      return row;
    }),
  );
  $("events-empty").hidden = store.events.length > 0;
}

export function initRecords() {
  $("copy-events").addEventListener("click", () => {
    const text = store.events.map(({ t, text: what }) => `${t}\t${what}`).join("\n");
    navigator.clipboard?.writeText(text).then(() => hooks.announce("Record copied."), () => {});
  });
  $("clear-events").addEventListener("click", () => {
    store.events = [];
    writeJson(KEYS.events, store.events);
    renderEvents();
  });
  renderEvents();
}
