![Logo](admin/autodarts.svg)
## Adapter for Autodarts Integration

![Number of Installations](https://iobroker.live/badges/autodarts-installed.svg)<!--![Current version in stable repository](https://iobroker.live/badges/autodarts-stable.svg)-->
[![NPM Version](https://nodei.co/npm/iobroker.autodarts.svg?style=shields&data=v,u,d&color=orange)](https://www.npmjs.com/package/iobroker.autodarts)
<!--[![Downloads](https://img.shields.io/npm/dm/iobroker.autodarts.svg)](https://www.npmjs.com/package/iobroker.autodarts)-->

[![Paypal Donation](https://img.shields.io/badge/paypal-donate%20|%20spenden-green.svg)](https://www.paypal.com/donate/?hosted_button_id=7W6M3TFZ4W9LW)


## What this adapter does

Connects to your local Autodarts Board Manager (via IP and port, e.g. `192.168.x.x:3180`) and exposes ioBroker states for home automation:

- Turn on lights when a game starts
- Play a sound on a bullseye
- Announce the next throw via text-to-speech (TTS)
- Control board hardware (lighting, power)
- Trigger any other ioBroker automation based on dart events

## Documentation

- 🇺🇸 [Documentation](./docs/en/README.md)
- 🇩🇪 [Dokumentation](./docs/de/README.md)


## Features

### Game State & Throws
- **`visit.score`**: Total score of the last complete visit (3 darts)
- **`throw.current`**: Numeric score of the last thrown dart
- **`throw.isTriple`**: Boolean flag for triple hits within configurable segment range (default: 1–20)
- **`throw.isDouble`**: Boolean flag for double hits only (all segments)
- **`throw.isBullseye`**: Boolean flag for bullseye hits only
- **`throw.isMiss`**: Boolean flag that is true when the dart does not hit any valid scoring segment (pure miss, no score)

### Board Status
- **`status.boardStatus`**: Status indicator of board event (e.g. `"Stopped"`, `"Calibration finished"`, `"Started"`).
- **`status.trafficLightColor`**: HEX color of current board status
- **`status.trafficLightState`**: Status indicator
  - `green` = Player may throw
  - `yellow` = Remove darts
  - `red` = Board offline/error

### System Information
- **`system.software.*`**: Autodarts versions (boardVersion, desktopVersion), OS and platform details
- **`system.hardware.*`**: CPU model, kernel architecture, hostname
- **`system.cams.cam0/1/2`**: Camera configuration (width, height, fps) as JSON

### Hardware Control
- **`system.hardware.light`**: Control board lighting (bidirectional with external states)
- **`system.hardware.power`**: Control board power (bidirectional with external states)

### Runtime Configuration
- **`config.tripleMinScore/tripleMaxScore`**: Adjust triple trigger thresholds during runtime
- **`config.triggerResetSec`**: Auto-reset time for triple/double/bullseye/miss flags

### Tools Addon Integration
- **`tools.RAW`**: Input state used to receive events from browser tools (e.g. busted, gameon, gameshot, 180, matchshot, takeout).
- **`trigger.is180/isBusted/isGameon/isGameshot/isMatchshot/isTakeout`**: Read-only trigger flags set when corresponding events received via `tools.RAW`.
- **`tools.config.url*`**: Pre-generated HTTP URLs (simple-api calls) that can be copied into Tools for Autodarts browser extension.

## What this adapter does NOT do

- ❌ No data is sent to the internet or to third-party servers
- ❌ No history, statistics, or personal data is stored or shared
- ❌ No access to other people's boards or remote boards over the internet
- ❌ No cloud features or analytics

All data stays local on your ioBroker system.

## Configuration

![Configuration Screenshot](docs/config-screenshot.png)

### The adapter settings are split into four tabs: **OPTIONS**, **MAPPINGS**, **TOOLS ADDON INTEGRATION** and **HELP & FAQ**.

### Tab: OPTIONS

In **OPTIONS** you configure how the adapter connects to your local Autodarts Board Manager and how often it polls data:

- **Board Manager IP**  
  IP address of your Autodarts Board Manager (e.g. `192.168.178.50` or `127.0.0.1`).

- **Port**  
  TCP port of the Board Manager (usually `3180`).

- **Triple trigger range**  
  Two dropdowns to define the **minimum** and **maximum** field number (1–20) that should be considered for `throw.isTriple`.  
  Triples outside this range will not trigger the flag.

- **Trigger reset (s)**  
  Time in seconds after which triple, double, bullseye and miss flags are reset.  
  `0` means no automatic reset.

- **Polling interval (s)**  
  How often the adapter polls the Board Manager for new data (e.g. `0.5`, `1`, `2` seconds).

### Tab: MAPPINGS

In **MAPPINGS** you can link existing ioBroker states to the hardware related adapter states:

- **Light Target ID**  
  ioBroker state ID that is synchronized with `system.hardware.light`  
  (e.g. `0_userdata.0.Autodarts.LIGHT` or a state of a smart light/LED ring).

- **Power Target ID**  
  ioBroker state ID that is synchronized with `system.hardware.power`  
  (e.g. `0_userdata.0.Autodarts.POWER` or a state of a smart plug).


When configured, changes on either side (adapter state or external state) are synchronized bidirectionally so you can both control the board from ioBroker and react on board events.

### Tab: TOOLS ADDON INTEGRATION
- Configure IP, port and instance so the adapter can generate HTTP URLs that point to your ioBroker simple-api endpoint.
​
- The final URLs for Busted, Game On and Gameshot are exposed as states under autodarts.X.tools.config.urlBusted/urlGameon/urlGameshot and can be copied into the Tools for Autodarts browser extension.

### Tab: HELP & FAQ

In **HELP & FAQ** you will find general information and help about the adapter and its configuration.


## Privacy & Data Handling

- This adapter only reads data from your **local** Autodarts Board Manager in your own network.
- No personal data is sent to external servers or stored in the cloud.
- All data stays on your own system; no statistics or throw history are collected or shared.
- This adapter is designed to work only with your own dartboard, not with remote or other people’s boards.

## Changelog
<!--
	### **WORK IN PROGRESS**
-->

### 1.0.0 (2026-01-11)
- (skvarel) BREAKING CHANGE: All triggers to unified trigger.is structure
- (skvarel) Manual cleanup required: Delete old autodarts.X.throw.is and tools. states after update
- (skvarel) Unchanged: tools.RAW, tools.config.url, all timers/functionality

### 0.8.3 (2026-01-06)
- (skvarel) Added: CHANGELOG_OLD.md
- (skvarel) Improved: Link to documentation added to the help section.

### 0.8.2 (2026-01-05)
- (skvarel) Fixed: ImageURL

### 0.8.1 (2026-01-05)
- (skvarel) Added: New DE/EN adapter documentation under `/docs` with separate pages for all config tabs (Options, Mappings, Tools addon integration, Help & FAQ).
- (skvarel) Improved: Main README cleaned up and linked to the new documentation (badges, feature overview, configuration section).
- (skvarel) Improved: Clarified Tools addon integration flow (Simple-API requirements, generated URLs, WLED usage).

### 0.8.0 (2026-01-04)
- (skvarel) Added: New **TOOLS ADDON INTEGRATION** tab and runtime-generated URL states under `tools.config.*` for browser-based integrations (e.g. Tools for Autodarts).

### 0.7.3 (2026-01-03)
- (skvarel) Fix Adapter Checker Warnings

## Older changes
- [CHANGELOG_OLD.md](CHANGELOG_OLD.md)

## License
MIT License

Copyright (c) 2026 skvarel <sk@inventwo.com>

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
