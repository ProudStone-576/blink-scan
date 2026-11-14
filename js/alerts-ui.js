import { KEYS } from "./config.js";
import { $, timeNow } from "./dom.js";
import { settings } from "./state.js";
import { subscribeLink, sendAlert } from "./notify.js";
import { logEvent } from "./records.js";
import { writeJson } from "./storage.js";

const save = () => writeJson(KEYS.settings, settings);

// a long random topic is the only secret between the iPad and the carer's phone
function randomTopic() {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return `blink-scan-${[...bytes].map((b) => b.toString(36).padStart(2, "0")).join("")}`;
}

function setStatus(text) {
  $("notify-status").textContent = text;
}

export function syncAlerts() {
  $("notify-on").checked = settings.notifyOn;
  $("notify-topic").value = settings.notifyTopic;
  $("notify-server").value = settings.notifyServer;
  const hasTopic = settings.notifyTopic.trim().length > 0;
  $("notify-test").disabled = !hasTopic;
  $("notify-copy").disabled = !hasTopic;
}

export function initAlerts() {
  $("notify-on").addEventListener("change", (e) => {
    settings.notifyOn = e.target.checked;
    save();
    logEvent(settings.notifyOn ? "Phone alerts turned on" : "Phone alerts turned off");
  });
  $("notify-topic").addEventListener("change", (e) => {
    settings.notifyTopic = e.target.value.trim();
    save();
    syncAlerts();
  });
  $("notify-server").addEventListener("change", (e) => {
    settings.notifyServer = e.target.value.trim() || "https://ntfy.sh";
    save();
    syncAlerts();
  });
  $("notify-generate").addEventListener("click", () => {
    settings.notifyTopic = randomTopic();
    save();
    syncAlerts();
    setStatus("New topic made. Subscribe to it on the carer's phone, then send a test alert.");
  });
  $("notify-copy").addEventListener("click", () => {
    navigator.clipboard?.writeText(subscribeLink()).then(() => setStatus("Subscribe link copied."), () => setStatus(subscribeLink()));
  });
  $("notify-test").addEventListener("click", async () => {
    setStatus("Sending…");
    try {
      await sendAlert({ title: "Test alert", message: `Blink Scan test at ${timeNow()}.`, priority: 3, tags: ["test_tube"] });
      logEvent("Phone alert sent (test)");
      setStatus(`Sent at ${timeNow()}. Check that it arrived on the carer's phone.`);
    } catch (err) {
      logEvent(`Phone alert failed (${err.message})`);
      setStatus(`It did not go through: ${err.message}. Check the topic, the server and the internet connection.`);
    }
  });
  syncAlerts();
}
