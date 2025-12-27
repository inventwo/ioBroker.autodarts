![Logo](admin/autodarts.svg)
## Adapter for Autodarts Integration

![Number of Installations](https://iobroker.live/badges/autodarts-installed.svg)
![Current version in stable repository](https://iobroker.live/badges/autodarts-stable.svg)
[![NPM Version](https://nodei.co/npm/iobroker.autodarts.svg?style=shields&data=v,u,d&color=orange)](https://www.npmjs.com/package/iobroker.autodarts)

[![Downloads](https://img.shields.io/npm/dm/iobroker.autodarts.svg)](https://www.npmjs.com/package/iobroker.autodarts)

[![Paypal Donation](https://img.shields.io/badge/paypal-donate%20|%20spenden-green.svg)](https://www.paypal.com/donate/?hosted_button_id=7W6M3TFZ4W9LW)


## What this adapter does
<!-- - Reads current game state, active player, and dart throws (e.g. `T20`, `D1`, `S19`). -->
- Connects to your local Autodarts Board Manager (via IP and port, e.g. `192.168.x.x:3180`).
- Exposes ioBroker states and events so you can:
  - Turn on lights when a game starts.
  - Play a sound on a bullseye.
  - Announce the current player via TTS.
  - Trigger other automations in ioBroker.

It also provides:

- `visit.score`: Total score of the last complete visit (3 darts).
- `throw.current`: Numeric score of the last thrown dart.
- `throw.isTriple`: Boolean flag that turns true for triple hits within a configurable segment range (e.g. 1–20)
- `throw.isBullseye`: Boolean flag that only turns true for bullseye hits.
- `system.boardVersion`: Reported Board Manager version.
- `system.cam0/1/2`: JSON with camera settings (width, height, fps).
- `status.trafficLightColor`: HEX color of the current board status.
- `status.trafficLightState`: `green` (player may throw), `yellow` (remove darts), `red` (board error).


## What this adapter does NOT do

- ❌ No data is sent to the internet or to third-party servers.
- ❌ No history, statistics, or personal data is stored or shared.
- ❌ No access to other people’s boards or remote boards over the internet.
- ❌ No cloud features or analytics.

All data stays local on your ioBroker system.

## Configuration

In the adapter settings, enter:

- **Board Manager IP**: IP address of your Autodarts Board Manager (e.g. `192.168.178.50`).
- **Port**: Usually `3180` (default for Board Manager).
- **Polling interval (ms)**: (default for 2000ms)

## Privacy & Data Handling

- This adapter only reads data from your **local** Autodarts Board Manager in your own network.
- No personal data is sent to external servers or stored in the cloud.
- All data stays on your own system; no statistics or throw history are collected or shared.
- This adapter is designed to work only with your own dartboard, not with remote or other people’s boards.

## Changelog
<!--
	### **WORK IN PROGRESS**
-->
### **WORK IN PROGRESS**
- Changed: Configuration fields interval and triggerReset now use seconds instead of milliseconds in the admin UI.

### 0.3.2 (2025-12-27)
- (DrozmotiX) **ENHANCED**: Fixed all TypeScript type errors by adding proper type definitions for config properties
- (DrozmotiX) **ENHANCED**: Refactored HTTP request handling - created reusable httpHelper module to eliminate code duplication
- (DrozmotiX) **ENHANCED**: Converted HTTP callback-based requests to async/await pattern for better error handling
- (DrozmotiX) **ENHANCED**: Improved connection state logging - now logs when connection is restored after being offline
- (DrozmotiX) **ENHANCED**: Standardized async/await usage across all state change handlers for consistency
- (DrozmotiX) **FIXED**: Removed unused error variable in fetchVersion method
- (DrozmotiX) **FIXED**: Added proper error type checking in fetchConfig to prevent runtime errors
- (DrozmotiX) **TESTING**: Added comprehensive unit tests for httpHelper module covering success, timeout, and error scenarios

### 0.3.1 (2025-12-27)
- Changed: Object creation now uses extendObjectAsync with proper roles and types instead of setObjectNotExistsAsync.

### 0.3.0 (2025-12-26)
- Added traffic light datapoints (`status.trafficLightColor`, `status.trafficLightState`) mapped from Board Manager status (`Throw` / `Takeout` / connection errors).
- Refactored code: visit handling, throw handling (triple / bull) and traffic light logic moved to separate modules.

### 0.2.2 (2025-12-25)
- bugfix

### 0.2.1 (2025-12-25)
- Reset for triple and bullseye trigger added

### 0.2.0 (2025-12-25)
- Added datapoint for bulls-hit
- Added maximun triple-hit flag score
- Update config
- Warning in log cleared

### 0.1.0 (2025-12-23)
- Added datapoints for visit score, current dart score, triple-hit flag with configurable minimum score, and camera configuration (cam0–cam2).
- Cleaned up adapter logic and internal polling/timing.
- Updated translations.

### 0.0.14 (2025-12-22)
- fix

### 0.0.13 (2025-12-22)
- translate

### 0.0.12 (2025-12-22)
- fix

### 0.0.11 (2025-12-22)
- fix

### 0.0.10 (2025-12-22)
- fix

### 0.0.9 (2025-12-22)
- fix

### 0.0.8 (2025-12-21)
- fix - Adapter Checker

### 0.0.7 (2025-12-21)
- fix - Adapter Checker

### 0.0.6 (2025-12-21)
- fix - Adapter Checker

### 0.0.5 (2025-12-21)
- Update Description

### 0.0.4 (2025-12-21)
- Privacy & Data Handling

### 0.0.3 (2025-12-21)
- init

### 0.0.2 (2025-12-21)
- initial release

## License
MIT License

Copyright (c) 2025 skvarel <sk@inventwo.com>

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