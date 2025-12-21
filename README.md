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