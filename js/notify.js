import { $, timeNow } from "./dom.js";
import { logEvent } from "./records.js";
import { settings } from "./state.js";

const REMIND_MS = 60000;
const RETRY_MS = 10000;
const MIN_TOPIC = 8;

let remindTimer = null;
let retryTimer = null;

export const notifyReady = () => settings.notifyOn && settings.notifyTopic.trim().length >= MIN_TOPIC;

export const subscribeLink = () => `${settings.notifyServer.replace(/\/+$/, "")}/${settings.notifyTopic.trim()}`;

// ntfy accepts a JSON publish at the server root; a string body keeps the request free of a CORS preflight
export async function sendAlert({ title, message, priority = 5, tags = ["rotating_light"] }) {
  const response = await fetch(settings.notifyServer.replace(/\/+$/, ""), {
    method: "POST",
    body: JSON.stringify({
      topic: settings.notifyTopic.trim(),
      title,
      message,
      priority,
      tags,
      click: location.origin + location.pathname,
    }),
  });
  if (!response.ok) throw new Error(`server answered ${response.status}`);
}

function showOnOverlay(text) {
  $("alarm-notify").textContent = text;
}

// sends, and keeps trying every few seconds while the alarm is still ringing
async function deliver(alert, { retry }) {
  try {
    await sendAlert(alert);
    logEvent(`Phone alert sent (${alert.title})`);
    showOnOverlay(`Carer's phone alerted at ${timeNow()}.`);
  } catch (err) {
    logEvent(`Phone alert failed (${err.message})`);
    showOnOverlay("The phone alert did not go through. Trying again.");
    if (retry) retryTimer = setTimeout(() => deliver(alert, { retry }), RETRY_MS);
  }
}

export function notifyRaised(test) {
  clearTimeout(retryTimer);
  clearInterval(remindTimer);
  showOnOverlay("");
  if (!notifyReady()) return;
  const at = timeNow();
  if (test) {
    deliver({ title: "Alarm test", message: "This is a test alert from Blink Scan.", priority: 3, tags: ["test_tube"] }, { retry: false });
    return;
  }
  deliver({ title: "Help needed", message: `The patient called for help at ${at}.` }, { retry: true });
  remindTimer = setInterval(
    () => deliver({ title: "Help still needed", message: `The alarm raised at ${at} has not been stopped.` }, { retry: false }),
    REMIND_MS,
  );
}

export function notifyStopped(test, how) {
  clearTimeout(retryTimer);
  clearInterval(remindTimer);
  if (test || !notifyReady()) return;
  deliver({ title: "Alarm stopped", message: `Stopped at ${timeNow()}: ${how}.`, priority: 2, tags: ["white_check_mark"] }, { retry: false });
}
