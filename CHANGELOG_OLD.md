# Older changes
## 0.8.0 (2026-01-04)
- (skvarel) **Added**: New **TOOLS ADDON INTEGRATION** tab and runtime-generated URL states under `tools.config.*` for browser-based integrations (e.g. Tools for Autodarts).

## 0.7.3 (2026-01-03)
- (skvarel) **Fixed**: Adapter Checker Warnings

## 0.7.2 (2026-01-03)
- (skvarel) **Fixed**: Copyright Year

## 0.7.1 (2025-12-31)
- (skvarel) **Changed**: Reduced reconnect delay after offline.

## 0.7.0 (2025-12-31)
- (skvarel) **Added**: New `status.boardStatus` state. Status indicator of board event (e.g. `"Stopped"`, `"Calibration finished"`, `"Started"`).

## 0.6.3 (2025-12-30)
- (skvarel) **Improved**: Connection handling now uses `info.connection` and clearly marks the adapter as offline when the Autodarts Board Manager is not reachable (including better timeout/ECONNRESET handling).
- (skvarel) **Changed**: Reduced log noise when the board is offline – only one warning is logged when the connection is lost, subsequent timeouts are written as debug messages.
- (skvarel) **Improved**: Minor tweaks to the HELP & FAQ tab texts and configuration descriptions.

## 0.6.2 (2025-12-29)
- (skvarel) **Improved**: Settings page reworked to use three tabs (`OPTIONS`, `MAPPINGS` and `HELP & FAQ`) for better clarity.

## 0.6.1 (2025-12-29)
- (skvarel) **New**: Settings page reworked to use two tabs (`OPTIONS` and `MAPPINGS`) for better clarity.
- (skvarel) **New**: Mapping of ioBroker objects for board light and board power in the **MAPPINGS** tab.
- (skvarel) **Improved**: Layout of the configuration page (field widths, spacing, texts) for a more symmetric and clean UI.
- (skvarel) **Improved**: Updated option descriptions in the admin UI.

## 0.6.0 (2025-12-28)
- (skvarel) **Added**: New throw.isMiss state to detect and trigger automations on missed darts (including auto-reset via triggerResetSec).
- (skvarel) **Added**: New throw.isDouble state to detect and trigger automations on double segments (including auto-reset via triggerResetSec).

## 0.5.1 (2025-12-28)
- (skvarel) **Fixed**: Hardware light/power mapping now respects configured target IDs and works on all systems.

## 0.5.0 (2025-12-28)
- (skvarel) **Added**: Bidirectional hardware control states `system.hardware.light` and `system.hardware.power`
- (skvarel) **Added**: Configuration options to map light/power states to external ioBroker states (e.g., 0_userdata)
- (skvarel) **Changed**: Hardware states now support read/write operations for full automation integration

## 0.4.0 (2025-12-28)
- (skvarel) **Changed**: Restructured system information into dedicated `system.hardware`, `system.software` and `system.cams` channels.
- (skvarel) **Added**: New software info states (`desktopVersion`, `boardVersion`, `platform`, `os`) and hardware info states (`kernelArch`, `cpuModel`, `hostname`).
- (skvarel) **Added**: Camera configuration states `system.cams.cam0/1/2` containing JSON with width, height and fps.
- (skvarel) **Changed**: Adapter configuration for polling interval and triple trigger thresholds is now fully driven via jsonConfig (dropdowns and number fields).
- (skvarel) **Removed**: Experimental light/power alias mapping from internal logic (no user-visible feature was released).

## 0.3.3 (2025-12-27)
- (skvarel) **Changed**: Configuration fields interval and triggerReset now use seconds instead of milliseconds in the admin UI.

## 0.3.2 (2025-12-27)
- (DrozmotiX) **Enhanced**: Fixed all TypeScript type errors by adding proper type definitions for config properties
- (DrozmotiX) **Enhanced**: Refactored HTTP request handling - created reusable httpHelper module to eliminate code duplication
- (DrozmotiX) **Enhanced**: Converted HTTP callback-based requests to async/await pattern for better error handling
- (DrozmotiX) **Enhanced**: Improved connection state logging - now logs when connection is restored after being offline
- (DrozmotiX) **Enhanced**: Standardized async/await usage across all state change handlers for consistency
- (DrozmotiX) **Fixed**: Removed unused error variable in fetchVersion method
- (DrozmotiX) **Fixed**: Added proper error type checking in fetchConfig to prevent runtime errors
- (DrozmotiX) **Testing**: Added comprehensive unit tests for httpHelper module covering success, timeout, and error scenarios

## 0.3.1 (2025-12-27)
- (skvarel) **Changed**: Object creation now uses extendObjectAsync with proper roles and types instead of setObjectNotExistsAsync.

## 0.3.0 (2025-12-26)
- (skvarel) **Added**: Traffic light states (`status.trafficLightColor`, `status.trafficLightState`) mapped from Board Manager status (`Throw` / `Takeout` / connection errors).
- (skvarel) **Refactored code**: visit handling, throw handling (triple / bull) and traffic light logic moved to separate modules.

## 0.2.2 (2025-12-25)
- (skvarel) **Fixed** Some bugs

## 0.2.1 (2025-12-25)
- (skvarel) **Added**: Reset for triple and bullseye trigger added

## 0.2.0 (2025-12-25)
- (skvarel) **Added**: Datapoint for bulls-hit
- (skvarel) **Added** Maximun triple-hit flag score
- (skvarel) **Update** Config
- (skvarel) **Fixed**: Warning in log cleared

## 0.1.0 (2025-12-23)
- (skvarel) **Added**: States for visit score, current dart score, triple-hit flag with configurable minimum score
- (skvarel) **Added**: Camera configuration states (cam0–cam2)
- (skvarel) **Changed**: Cleaned up adapter logic and internal polling/timing
- (skvarel) **Changed**: Updated translations

## 0.0.14 - 0.0.2 (2025-12-21 - 2025-12-22)
- (skvarel) **Initial release** with multiple fixes for adapter checker compliance and documentation improvements
