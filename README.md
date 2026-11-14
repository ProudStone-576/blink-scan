# Blink Scan

A communication aid: a patient who cannot speak or type picks words, phrases and an alarm with deliberate eye blinks. The device camera is read on the device by MediaPipe; nothing is recorded or sent.

Static site, no build step. Serve the folder over HTTPS (or `localhost`) and open `index.html`.

## Structure

```
index.html            markup: top bar, board, carer panel (dialog), alarm, calibration overlay
css/
  style.css           the app's styles (stamp, imports, board, panel, alarm, phone rules)
  tokens.css          design tokens (Hallmark "Dose" theme + shared scale)
  base.css            resets and base rules
js/
  main.js             entry point: fills the hooks, starts each module, handles Space and Escape
  config.js           constants, defaults, storage keys
  state.js            settings, stored records, live flags, and the hooks modules call through
  storage.js          localStorage read and write
  dom.js              element lookup, icons, notices, date helpers
  audio.js            beeps and speech
  eyes.js             camera, face model, blink gestures (pick, go back, alarm), camera-fault alert
  board.js            what is on screen: scanning, row counting, rendering, typed text
  screens.js          the screens: home, chat, quick, needs, saved, keyboard layouts
  words.js            word prediction that learns from what is typed
  alarm.js            siren, speech, start and stop
  calibrate.js        calibration state machine (open, closed, three blinks)
  calibration-ui.js   calibration overlay and wiring
  carer.js            carer panel: tabs, setup check, status chips
  settings-ui.js      settings controls
  records.js          event record
```

Modules that would import each other call through `hooks` in `state.js`, which `main.js` fills in.

## Gestures

| Eyes shut for | Result |
| --- | --- |
| the blink length (default 0.5 s) | pick the lit item, or count a row on the keyboard |
| 2 s | go back one level |
| 4 s | raise the alarm |

Space is a manual blink and Escape goes back, for testing without the camera.

## Not a certified medical device

See Safety and records in the carer panel.
