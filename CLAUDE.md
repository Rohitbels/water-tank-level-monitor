# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install       # Install dependencies (requires Node >10)
npm start         # Start dev server with HMR at http://localhost:3500
npm run build     # Build production bundle to dist/
```

There are no test or lint commands configured in this project.

## Architecture

This project is a two-component IoT system for monitoring water tank depth:

### Embedded Firmware (`nodeMcuAPIServer/nodeMcuAPIServer.ino`)
Arduino sketch for NodeMCU 1.0 / HW-625 (ESP8266) that:
- Connects to WiFi with a static IP (`192.168.1.58`)
- Reads distance from a JSN-SR04T-style waterproof sensor (SR04M-2 board) on trigger GPIO 12 (D6), echo GPIO 14 (D5)
- Only measures when `/api` is requested (5 pings, median); requests within 1 s share one measurement
- `GET /api` returns `{ "d": <distance_cm> }`, or HTTP 503 `{ "d": null, "error": "no echo" }`
- `GET /` serves a small HTML page that loads `docs/tank.js` from GitHub Pages; if that fails it shows the raw distance every 3 s
- Compile check: `"/Applications/Arduino IDE.app/Contents/Resources/app/lib/backend/resources/arduino-cli" compile --fqbn esp8266:esp8266:nodemcuv2 nodeMcuAPIServer`

### Display (`docs/tank.js`)
Plain JavaScript, no build step, served by GitHub Pages from `master` `/docs`
(`https://rohitbels.github.io/water-tank-level-monitor/tank.js`):
- Polls `/api` every 3 s, stores `[time, d]` per day in localStorage (7 days)
- Tank is 70 cm (probe to floor); green while d > 25 cm, red at d <= 25 cm (sensor blind zone)
- After changing it, bump `?v=` in the firmware's page so phones fetch the new copy

### Web Frontend (`app/`)
Unused Webpack 5 boilerplate. Its `node-sass` dependency does not build on current Node.

### Data Flow
Phone opens http://192.168.1.58 → page loads tank.js → tank.js GETs /api every 3 s → NodeMCU pings sensor → returns distance JSON → tank.js draws level
