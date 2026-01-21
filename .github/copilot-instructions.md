# GitHub Copilot Instructions: ioBroker Autodarts Adapter

**Version:** 1.0.2  
**Project:** ioBroker.autodarts - Dartboard integration  
**Architecture:** Modular polling-based adapter with state management & hardware control  

## Quick Start for AI Agents

This is an **ioBroker adapter** that connects a local Autodarts Board Manager (HTTP polling) to ioBroker's state system. Key files:
- **[main.js](main.js)** - Adapter entry point with polling loop & state routing
- **[lib/](lib/)** - Modular logic split by concern (throw, visit, trafficLight, hardware, config, etc.)
- **[admin/jsonConfig.json](admin/jsonConfig.json)** - UI config form (JSON-Config format)
- **[test/integration.js](test/integration.js)** - Integration tests via `@iobroker/testing`

**Core Pattern:** Load data from Board Manager → route through lib modules → write to ioBroker states

## Architecture Overview

### Autodarts Adapter Specifics

This adapter integrates with **Autodarts Board Manager**, a local system for electronic dartboard scoring and automation. Key characteristics:

- **Local Network Communication**: The adapter connects to a local Autodarts Board Manager via HTTP (default port 3180)
- **Polling Architecture**: Uses configurable polling intervals in seconds (default 1s, calculated to milliseconds in code) to fetch game state updates
- **No Cloud Dependencies**: All data stays local - no external API, authentication, or cloud services required
- **Real-time Game Events**: Tracks dart throws, visits (3-dart sequences), player information, and board status
- **State Management**: Creates ioBroker states for:
  - Current throw data (score, isTriple, isBullseye)
  - Visit scores (total of 3 darts)
  - Board status (traffic light system: green/yellow/red)
  - System information (board version, camera configurations)
  - Connection status
- **Modular Design**: Logic split into separate modules:
  - `lib/throw.js` - Throw detection and processing
  - `lib/visit.js` - Visit (3-dart sequence) handling
  - `lib/trafficLight.js` - Board status interpretation
- **Trigger Mechanisms**: Optional auto-reset timers for throw triggers (triple/bullseye flags)
- **No Authentication**: Local network access only, no credentials required

#### Configuration Options
- `host`: IP address of Autodarts Board Manager (e.g., "192.168.178.50")
- `port`: Board Manager port (default: 3180)
- `intervalSec`: Polling interval in seconds (default: 1)
- `tripleMinScore`: Minimum score for triple detection flag (default: 1)
- `tripleMaxScore`: Maximum score for triple detection flag (default: 20)
- `triggerResetSec`: Auto-reset time for throw triggers in seconds (0 = disabled)
- `toolsIp`: IP address for Tools addon integration (optional)
- `toolsPort`: Port for Tools addon (default: 8087)
- `toolsInstance`: ioBroker instance number for Tools (default: 0)

#### API Endpoints
The adapter polls these Board Manager endpoints:
- `/api/state` - Current game state and throws
- `/api/version` - Board Manager version
- `/api/config` - System configuration
- `/api/host` - Host information

#### Error Handling Patterns
- Gracefully handle network timeouts and connection failures
- Set `online` state to false when Board Manager is unreachable
- Update traffic light to red on connection errors
- Log detailed error messages for troubleshooting
- Implement retry logic with configurable intervals

## Codebase Architecture

### Module Organization (`lib/` directory)

The adapter uses **modular design** where each concern is isolated. Each module exports `init()` and processing functions:

#### Core Modules

1. **`lib/httpHelper.js`** - HTTP abstraction layer
   - `makeRequest(adapter, path, timeout)` - Handles GET requests to Board Manager
   - Used by all modules to fetch data from `/api/state`, `/api/version`, `/api/config`, `/api/host`
   - Returns Promise<string>; handles timeouts and errors
   - `updateThrow(adapter, lastDart)` - Detects dart throws, sets trigger flags based on score range
   - Tracks **triple** (configurable range via tripleMinScore/tripleMaxScore), **bullseye** (50 points), **double** (multiplier = 2), **miss** (0 points) triggers
   - Implements auto-reset timers for triggers via `triggerResetSecRuntime` stored in `adapter.resetTimers` objectgs)
   - `processThrow(adapter, currentThrows, lastThrowsCount)` - Detects new throws, sets trigger flags
   - Tracks **triple** (configurable range), **bullseye**, **double**, **miss** triggers
   - Implements auto-reset timers for triggers via `triggerResetSecRuntime`
all darts in a visit, updates score when new throws detected
   - Returns new `lastThrowsCount` for change detection (stored in adapter.lastThrowsCount)
   - `init(adapter)` - Creates `visit.score` state
   - `updateVisit(adapter, currentThrows, lastThrowsCount)` - Sums 3 darts when visit completes
   - Returns new `lastThrowsCount` for signature-based deduplication

4. **`lib/trafficLight.js`** - Board status indicator
   - `init(adapter)` - Creates `status.trafficLightColor` and `status.trafficLightState` states
   - Maps board events (Stopped, Running, Calibration) to traffic light colors (red, yellow, green)
   - Also updates `status.boardStatus` text state

5. **`lib/config.js`** - Runtime configuration management
   - `init(adapter)` - Creates `config.tripleMinScore`, `config.tripleMaxScore`, `config.triggerResetSec` states
   - `initializeRuntimeValues(adapter)` - Loads defaults from adapter settings
   - `handleStateChange(adapter, idShort, state)` - Updates runtime values when user changes config states

6. **`lib/hardware.js`** - Board hardware control & bidirectional sync
   - `init(adapter)` - Creates `system.hardware.light` and `system.hardware.power` states
   - `subscribeForeignStates(adapter)` - Sets up subscriptions for external ioBroker states (e.g., smart lights)
   - `handleForeignStateChange(adapter, id, state)` - Syncs external state changes to adapter hardware states
   - `handleStateChange(adapter, idShort, state)` - Syncs adapter hardware state changes to external states

7. **`lib/systemInfo.js`** - System and camera information
   - `init(adapter)` - Creates `system.software.*`, `system.hardware.*`, `system.cams.*` states
   - `fetchHost(adapter)`, `fetchConfig(adapter)` - Called on startup and every 5 minutes by timer in main.js (versionTimer)

8. **`lib/tools.js`** - Tools addon integration (browser extension events)
   - `init(adapter)` - Creates `tools.RAW` input state and `tools.config.url*` states
   - Generates HTTP URLs for browser extension based on configured toolsIp, toolsPort, toolsInstance
   - Supports Busted, GameOn, Gameshot events
   - `handleStateChange(adapter, idShort, state)` - Processes incoming tool events

#### Main Adapter Flow (`main.js`)

```javascript
class Autodarts extends utils.Adapter {
  constructor() {
    // Timer placeholders: pollTimer, versionTimer, resetTimers
    this.lastSignature = ""; // Deduplicates API responses
    this.lastThrowsCount = 0; // Tracks throw count for visit detection
  }

  async onReady() {
    // 1. Load & apply defaults from config
    // 2. Initialize all modules in order (hardware → systemInfo → config → visit → throw → trafficLight → tools)
    // 3. Subscribe to foreign states for hardware sync
    // 4. Start pollLoop()
    // 5. Schedule systemInfo refresh every 5 minutes
  }

  pollLoop() {
    // 1. Make HTTP request to /api/state
    // 2. If connection error: set online=false, trafficLight=red, skip processing
    // 3. If valid response:
    //    - Calculate signature from throws array for deduplication (JSON.stringify)
    //    - Check if signature changed - skip processing if unchanged (lastSignature check)
    //    - Route data to: trafficLight.update() → visit.updateVisit() → throw.updateThrow() → config updates
    //    - Set online=true
    // 4. Reschedule based on configured onlineIntervalMs (polling interval in milliseconds)
  }

  async onStateChange(id, state) {
    // Route state changes to modules in order:
    // 1. hardware.handleForeignStateChange() - external state sync
    // 2. tools.handleStateChange() - tool events
    // 3. config.handleStateChange() - config updates
    // 4. hardware.handleStateChange() - hardware control
  }
}
```

### Data Flow Diagram

```
Board Manager API
    ↓
httpHelper.makeRequest()
    ↓
[Signature deduplication: lastSignature check]
    ↓
┌─ trafficLight.update() → status.trafficLight*
├─ visit.updateVisit() → visit.score
├─ throw.processThrow() → throw.current, trigger.is*
├─ config.updateRuntime() → config.*
├─ tools.update() → tools.*
└─ systemInfo.update() → system.*
    ↓
onlineIntervalMs reschedule
```

### Key Patterns

#### Signature-Based Deduplication
The adapter prevents duplicate processing of unchanged API responses:
```javascript
const signature = JSON.stringify(matchData.throws || []);
if (signature === this.lastSignature) {
  // Skip processing if throws array is identical
  this.log.debug("Skipping processing - no new throws");
  // Still reschedule the next poll
  this.pollTimer = setTimeout(() => this.pollLoop(), this.onlineIntervalMs);
  return;
}
this.lastSignature = signature;
```

#### Module Initialization Pattern
Every module follows this contract:
```javascript
// Module exports
async function init(adapter) { /* Create states */ }
async function updateX/miss flags auto-reset based on `triggerResetSecRuntime`:
```javascript
// In throw.js updateThrow()
if (isTriple) {
  await adapter.setStateAsync('trigger.isTriple', true);
  // Clear existing timer if present
  if (adapter.resetTimers.isTriple) {
    clearTimeout(adapter.resetTimers.isTriple);
  }
  // Set auto-reset timer if configured
  if (adapter.triggerResetSecRuntime > 0) {
    adapter.resetTimers.isTriple = setTimeout(() => {
      adapter.setStateAsyncThrow()
if (shouldTriggerTriple) {
  adapter.setState('trigger.isTriple', true);
  clearTimeout(adapter.resetTimers.triple);
  if (adapter.triggerResetSecRuntime > 0) {
    adapter.resetTimers.triple = setTimeout(() => {
      adapter.setState('trigger.isTriple', false);
    }, adapter.triggerResetSecRuntime * 1000);
  }
}
```

#### Multilingual State Names
All states use structured `name` and `desc` with English & German:
```javascript
common: {
  name: { en: "Current dart score", de: "Punkte aktueller Dart" },
  desc: { en: "Score of last thrown dart", de: "Punktzahl des letzten Wurfs" }
}
```

### Development Commands

| Command | Purpose |
|---------|---------|
| `npm run check` | TypeScript type checking (no emit) |
| `npm run lint` | ESLint code validation |
| `npm run test:js` | Run Jest unit tests (*.test.js files) |
| `npm test` | Run `test:js` + `test:package` |
| `npm run test:integration` | Run @iobroker/testing integration tests |
| `npm run dev-server` | Start dev server for admin UI testing |

### Code Style Rules

- **Imports**: Use `node:` prefix for Node.js built-ins (e.g., `const http = require("node:http")`)
- **Async/Await**: Preferred over callbacks where possible
- **Timer Cleanup**: Always clear timers in `onUnload()` to prevent memory leaks
- **State Roles**: Follow ioBroker role conventions (`indicator`, `value`, `level.*`, `text`, etc.)
- **Configuration**: Runtime values stored in adapter instance (e.g., `this.tripleMinScoreRuntime`)
- **Error Handling**: Catch HTTP errors, set `online=false`, log with `this.log.error()`

## Testing

### Unit Testing
- Use Jest as the primary testing framework for ioBroker adapters
- Create tests for all adapter main functions and helper methods
- Test error handling scenarios and edge cases
- Mock external API calls and hardware dependencies
- For adapters connecting to APIs/devices not reachable by internet, provide example data files to allow testing of functionality without live connections
- Example test structure:
  ```javascript
  describe('AdapterName', () => {
    let adapter;
    
    beforeEach(() => {
      // Setup test adapter instance
    });
    
    test('should initialize correctly', () => {
      // Test adapter initialization
    });
  });
  ```

### Integration Testing

**IMPORTANT**: Use the official `@iobroker/testing` framework for all integration tests. This is the ONLY correct way to test ioBroker adapters.

**Official Documentation**: https://github.com/ioBroker/testing

#### Framework Structure
Integration tests MUST follow this exact pattern:

```javascript
const path = require('path');
const { tests } = require('@iobroker/testing');

// Define test coordinates or configuration
const TEST_COORDINATES = '52.520008,13.404954'; // Berlin
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

// Use tests.integration() with defineAdditionalTests
tests.integration(path.join(__dirname, '..'), {
    defineAdditionalTests({ suite }) {
        suite('Test adapter with specific configuration', (getHarness) => {
            let harness;

            before(() => {
                harness = getHarness();
            });

            it('should configure and start adapter', function () {
                return new Promise(async (resolve, reject) => {
                    try {
                        harness = getHarness();
                        
                        // Get adapter object using promisified pattern
                        const obj = await new Promise((res, rej) => {
                            harness.objects.getObject('system.adapter.your-adapter.0', (err, o) => {
                                if (err) return rej(err);
                                res(o);
                            });
                        });
                        
                        if (!obj) {
                            return reject(new Error('Adapter object not found'));
                        }

                        // Configure adapter properties
                        Object.assign(obj.native, {
                            position: TEST_COORDINATES,
                            createCurrently: true,
                            createHourly: true,
                            createDaily: true,
                            // Add other configuration as needed
                        });

                        // Set the updated configuration
                        harness.objects.setObject(obj._id, obj);

                        console.log('✅ Step 1: Configuration written, starting adapter...');
                        
                        // Start adapter and wait
                        await harness.startAdapterAndWait();
                        
                        console.log('✅ Step 2: Adapter started');

                        // Wait for adapter to process data
                        const waitMs = 15000;
                        await wait(waitMs);

                        console.log('🔍 Step 3: Checking states after adapter run...');
                        
                        // Get all states created by adapter
                        const stateIds = await harness.dbConnection.getStateIDs('your-adapter.0.*');
                        
                        console.log(`📊 Found ${stateIds.length} states`);

                        if (stateIds.length > 0) {
                            console.log('✅ Adapter successfully created states');
                            
                            // Show sample of created states
                            const allStates = await new Promise((res, rej) => {
                                harness.states.getStates(stateIds, (err, states) => {
                                    if (err) return rej(err);
                                    res(states || []);
                                });
                            });
                            
                            console.log('📋 Sample states created:');
                            stateIds.slice(0, 5).forEach((stateId, index) => {
                                const state = allStates[index];
                                console.log(`   ${stateId}: ${state && state.val !== undefined ? state.val : 'undefined'}`);
                            });
                            
                            await harness.stopAdapter();
                            resolve(true);
                        } else {
                            console.log('❌ No states were created by the adapter');
                            reject(new Error('Adapter did not create any states'));
                        }
                    } catch (error) {
                        reject(error);
                    }
                });
            }).timeout(40000);
        });
    }
});
```

#### Testing Both Success AND Failure Scenarios

**IMPORTANT**: For every "it works" test, implement corresponding "it doesn't work and fails" tests. This ensures proper error handling and validates that your adapter fails gracefully when expected.

```javascript
// Example: Testing successful configuration
it('should configure and start adapter with valid configuration', function () {
    return new Promise(async (resolve, reject) => {
        // ... successful configuration test as shown above
    });
}).timeout(40000);

// Example: Testing failure scenarios
it('should NOT create daily states when daily is disabled', function () {
    return new Promise(async (resolve, reject) => {
        try {
            harness = getHarness();
            
            console.log('🔍 Step 1: Fetching adapter object...');
            const obj = await new Promise((res, rej) => {
                harness.objects.getObject('system.adapter.your-adapter.0', (err, o) => {
                    if (err) return rej(err);
                    res(o);
                });
            });
            
            if (!obj) return reject(new Error('Adapter object not found'));
            console.log('✅ Step 1.5: Adapter object loaded');

            console.log('🔍 Step 2: Updating adapter config...');
            Object.assign(obj.native, {
                position: TEST_COORDINATES,
                createCurrently: false,
                createHourly: true,
                createDaily: false, // Daily disabled for this test
            });

            await new Promise((res, rej) => {
                harness.objects.setObject(obj._id, obj, (err) => {
                    if (err) return rej(err);
                    console.log('✅ Step 2.5: Adapter object updated');
                    res(undefined);
                });
            });

            console.log('🔍 Step 3: Starting adapter...');
            await harness.startAdapterAndWait();
            console.log('✅ Step 4: Adapter started');

            console.log('⏳ Step 5: Waiting 20 seconds for states...');
            await new Promise((res) => setTimeout(res, 20000));

            console.log('🔍 Step 6: Fetching state IDs...');
            const stateIds = await harness.dbConnection.getStateIDs('your-adapter.0.*');

            console.log(`📊 Step 7: Found ${stateIds.length} total states`);

            const hourlyStates = stateIds.filter((key) => key.includes('hourly'));
            if (hourlyStates.length > 0) {
                console.log(`✅ Step 8: Correctly ${hourlyStates.length} hourly weather states created`);
            } else {
                console.log('❌ Step 8: No hourly states created (test failed)');
                return reject(new Error('Expected hourly states but found none'));
            }

            // Check daily states should NOT be present
            const dailyStates = stateIds.filter((key) => key.includes('daily'));
            if (dailyStates.length === 0) {
                console.log(`✅ Step 9: No daily states found as expected`);
            } else {
                console.log(`❌ Step 9: Daily states present (${dailyStates.length}) (test failed)`);
                return reject(new Error('Expected no daily states but found some'));
            }

            await harness.stopAdapter();
            console.log('🛑 Step 10: Adapter stopped');

            resolve(true);
        } catch (error) {
            reject(error);
        }
    });
}).timeout(40000);

// Example: Testing missing required configuration  
it('should handle missing required configuration properly', function () {
    return new Promise(async (resolve, reject) => {
        try {
            harness = getHarness();
            
            console.log('🔍 Step 1: Fetching adapter object...');
            const obj = await new Promise((res, rej) => {
                harness.objects.getObject('system.adapter.your-adapter.0', (err, o) => {
                    if (err) return rej(err);
                    res(o);
                });
            });
            
            if (!obj) return reject(new Error('Adapter object not found'));

            console.log('🔍 Step 2: Removing required configuration...');
            // Remove required configuration to test failure handling
            delete obj.native.position; // This should cause failure or graceful handling

            await new Promise((res, rej) => {
                harness.objects.setObject(obj._id, obj, (err) => {
                    if (err) return rej(err);
                    res(undefined);
                });
            });

            console.log('🔍 Step 3: Starting adapter...');
            await harness.startAdapterAndWait();

            console.log('⏳ Step 4: Waiting for adapter to process...');
            await new Promise((res) => setTimeout(res, 10000));

            console.log('🔍 Step 5: Checking adapter behavior...');
            const stateIds = await harness.dbConnection.getStateIDs('your-adapter.0.*');

            // Check if adapter handled missing configuration gracefully
            if (stateIds.length === 0) {
                console.log('✅ Adapter properly handled missing configuration - no invalid states created');
                resolve(true);
            } else {
                // If states were created, check if they're in error state
                const connectionState = await new Promise((res, rej) => {
                    harness.states.getState('your-adapter.0.info.connection', (err, state) => {
                        if (err) return rej(err);
                        res(state);
                    });
                });
                
                if (!connectionState || connectionState.val === false) {
                    console.log('✅ Adapter properly failed with missing configuration');
                    resolve(true);
                } else {
                    console.log('❌ Adapter should have failed or handled missing config gracefully');
                    reject(new Error('Adapter should have handled missing configuration'));
                }
            }

            await harness.stopAdapter();
        } catch (error) {
            console.log('✅ Adapter correctly threw error with missing configuration:', error.message);
            resolve(true);
        }
    });
}).timeout(40000);
```

#### Advanced State Access Patterns

For testing adapters that create multiple states, use bulk state access methods to efficiently verify large numbers of states:

```javascript
it('should create and verify multiple states', () => new Promise(async (resolve, reject) => {
    // Configure and start adapter first...
    harness.objects.getObject('system.adapter.tagesschau.0', async (err, obj) => {
        if (err) {
            console.error('Error getting adapter object:', err);
            reject(err);
            return;
        }

        // Configure adapter as needed
        obj.native.someConfig = 'test-value';
        harness.objects.setObject(obj._id, obj);

        await harness.startAdapterAndWait();

        // Wait for adapter to create states
        setTimeout(() => {
            // Access bulk states using pattern matching
            harness.dbConnection.getStateIDs('tagesschau.0.*').then(stateIds => {
                if (stateIds && stateIds.length > 0) {
                    harness.states.getStates(stateIds, (err, allStates) => {
                        if (err) {
                            console.error('❌ Error getting states:', err);
                            reject(err); // Properly fail the test instead of just resolving
                            return;
                        }

                        // Verify states were created and have expected values
                        const expectedStates = ['tagesschau.0.info.connection', 'tagesschau.0.articles.0.title'];
                        let foundStates = 0;
                        
                        for (const stateId of expectedStates) {
                            if (allStates[stateId]) {
                                foundStates++;
                                console.log(`✅ Found expected state: ${stateId}`);
                            } else {
                                console.log(`❌ Missing expected state: ${stateId}`);
                            }
                        }

                        if (foundStates === expectedStates.length) {
                            console.log('✅ All expected states were created successfully');
                            resolve();
                        } else {
                            reject(new Error(`Only ${foundStates}/${expectedStates.length} expected states were found`));
                        }
                    });
                } else {
                    reject(new Error('No states found matching pattern tagesschau.0.*'));
                }
            }).catch(reject);
        }, 20000); // Allow more time for multiple state creation
    });
})).timeout(45000);
```

#### Key Integration Testing Rules

1. **NEVER test API URLs directly** - Let the adapter handle API calls
2. **ALWAYS use the harness** - `getHarness()` provides the testing environment  
3. **Configure via objects** - Use `harness.objects.setObject()` to set adapter configuration
4. **Start properly** - Use `harness.startAdapterAndWait()` to start the adapter
5. **Check states** - Use `harness.states.getState()` to verify results
6. **Use timeouts** - Allow time for async operations with appropriate timeouts
7. **Test real workflow** - Initialize → Configure → Start → Verify States

#### Workflow Dependencies
Integration tests should run ONLY after lint and adapter tests pass:

```yaml
integration-tests:
  needs: [check-and-lint, adapter-tests]
  runs-on: ubuntu-latest
  steps:
    - name: Run integration tests
      run: npx mocha test/integration-*.js --exit
```

#### What NOT to Do
❌ Direct API testing: `axios.get('https://api.example.com')`
❌ Mock adapters: `new MockAdapter()`  
❌ Direct internet calls in tests
❌ Bypassing the harness system

#### What TO Do
✅ Use `@iobroker/testing` framework
✅ Configure via `harness.objects.setObject()`
✅ Start via `harness.startAdapterAndWait()`
✅ Test complete adapter lifecycle
✅ Verify states via `harness.states.getState()`
✅ Allow proper timeouts for async operations

### API Testing with Credentials
For adapters that connect to external APIs requiring authentication, implement comprehensive credential testing:

#### Password Encryption for Integration Tests
When creating integration tests that need encrypted passwords (like those marked as `encryptedNative` in io-package.json):

1. **Read system secret**: Use `harness.objects.getObjectAsync("system.config")` to get `obj.native.secret`
2. **Apply XOR encryption**: Implement the encryption algorithm:
   ```javascript
   async function encryptPassword(harness, password) {
       const systemConfig = await harness.objects.getObjectAsync("system.config");
       if (!systemConfig || !systemConfig.native || !systemConfig.native.secret) {
           throw new Error("Could not retrieve system secret for password encryption");
       }
       
       const secret = systemConfig.native.secret;
       let result = '';
       for (let i = 0; i < password.length; ++i) {
           result += String.fromCharCode(secret[i % secret.length].charCodeAt(0) ^ password.charCodeAt(i));
       }
       return result;
   }
   ```
3. **Store encrypted password**: Set the encrypted result in adapter config, not the plain text
4. **Result**: Adapter will properly decrypt and use credentials, enabling full API connectivity testing

#### Demo Credentials Testing Pattern
- Use provider demo credentials when available (e.g., `demo@api-provider.com` / `demo`)
- Create separate test file (e.g., `test/integration-demo.js`) for credential-based tests
- Add npm script: `"test:integration-demo": "mocha test/integration-demo --exit"`
- Implement clear success/failure criteria with recognizable log messages
- Expected success pattern: Look for specific adapter initialization messages
- Test should fail clearly with actionable error messages for debugging

#### Enhanced Test Failure Handling
```javascript
it("Should connect to API with demo credentials", async () => {
    // ... setup and encryption logic ...
    
    const connectionState = await harness.states.getStateAsync("adapter.0.info.connection");
    
    if (connectionState && connectionState.val === true) {
        console.log("✅ SUCCESS: API connection established");
        return true;
    } else {
        throw new Error("API Test Failed: Expected API connection to be established with demo credentials. " +
            "Check logs above for specific API errors (DNS resolution, 401 Unauthorized, network issues, etc.)");
    }
}).timeout(120000); // Extended timeout for API calls
```

## README Updates

### Required Sections
When updating README.md files, ensure these sections are present and well-documented:

1. **Installation** - Clear npm/ioBroker admin installation steps
2. **Configuration** - Detailed configuration options with examples
3. **Usage** - Practical examples and use cases
4. **Changelog** - Version history and changes (use "## **WORK IN PROGRESS**" section for ongoing changes following AlCalzone release-script standard)
5. **License** - License information (typically MIT for ioBroker adapters)
6. **Support** - Links to issues, discussions, and community support

### Documentation Standards
- Use clear, concise language
- Include code examples for configuration
- Add screenshots for admin interface when applicable
- Maintain multilingual support (at minimum English and German)
- When creating PRs, add entries to README under "## **WORK IN PROGRESS**" section following ioBroker release script standard
- Always reference related issues in commits and PR descriptions (e.g., "solves #xx" or "fixes #xx")

### Mandatory README Updates for PRs
For **every PR or new feature**, always add a user-friendly entry to README.md:

- Add entries under `## **WORK IN PROGRESS**` section before committing
- Use format: `* (author) **TYPE**: Description of user-visible change`
- Types: **NEW** (features), **FIXED** (bugs), **ENHANCED** (improvements), **TESTING** (test additions), **CI/CD** (automation)
- Focus on user impact, not technical implementation details
- Example: `* (DutchmanNL) **FIXED**: Adapter now properly validates login credentials instead of always showing "credentials missing"`

### Documentation Workflow Standards
- **Mandatory README updates**: Establish requirement to update README.md for every PR/feature
- **Standardized documentation**: Create consistent format and categories for changelog entries
- **Enhanced development workflow**: Integrate documentation requirements into standard development process

### Changelog Management with AlCalzone Release-Script
Follow the [AlCalzone release-script](https://github.com/AlCalzone/release-script) standard for changelog management:

#### Format Requirements
- Always use `## **WORK IN PROGRESS**` as the placeholder for new changes
- Add all PR/commit changes under this section until ready for release
- Never modify version numbers manually - only when merging to main branch
- Maintain this format in README.md or CHANGELOG.md:

```markdown
# Changelog


## **WORK IN PROGRESS**

-   Did some changes
-   Did some more changes

## v0.1.0 (2023-01-01)
Initial release
```

#### Workflow Process
- **During Development**: All changes go under `## **WORK IN PROGRESS**`
- **For Every PR**: Add user-facing changes to the WORK IN PROGRESS section
- **Before Merge**: Version number and date are only added when merging to main
- **Release Process**: The release-script automatically converts the placeholder to the actual version

#### Change Entry Format
Use this consistent format for changelog entries:
- `- (author) **TYPE**: User-friendly description of the change`
- Types: **NEW** (features), **FIXED** (bugs), **ENHANCED** (improvements)
- Focus on user impact, not technical implementation details
- Reference related issues: "fixes #XX" or "solves #XX"

#### Example Entry
```markdown
## **WORK IN PROGRESS**

- (DutchmanNL) **FIXED**: Adapter now properly validates login credentials instead of always showing "credentials missing" (fixes #25)
- (DutchmanNL) **NEW**: Added support for device discovery to simplify initial setup
```

## Dependency Updates

### Package Management
- Always use `npm` for dependency management in ioBroker adapters
- When working on new features in a repository with an existing package-lock.json file, use `npm ci` to install dependencies. Use `npm install` only when adding or updating dependencies.
- Keep dependencies minimal and focused
- Only update dependencies to latest stable versions when necessary or in separate Pull Requests. Avoid updating dependencies when adding features that don't require these updates.
- When you modify `package.json`:
  1. Run `npm install` to update and sync `package-lock.json`.
  2. If `package-lock.json` was updated, commit both `package.json` and `package-lock.json`.

### Dependency Best Practices
- Prefer built-in Node.js modules when possible
- Use `@iobroker/adapter-core` for adapter base functionality
- Avoid deprecated packages
- Document any specific version requirements

## JSON-Config Admin Instructions

### Configuration Schema
When creating admin configuration interfaces:

- Use JSON-Config format for modern ioBroker admin interfaces
- Provide clear labels and help text for all configuration options
- Include input validation and error messages
- Group related settings logically
- Example structure:
  ```json
  {
    "type": "panel",
    "items": {
      "host": {
        "type": "text",
        "label": "Host address",
        "help": "IP address or hostname of the device"
      }
    }
  }
  ```

### Admin Interface Guidelines
- Use consistent naming conventions
- Provide sensible default values
- Include validation for required fields
- Add tooltips for complex configuration options
- Ensure translations are available for all supported languages (minimum English and German)
- Write end-user friendly labels and descriptions, avoiding technical jargon where possible

## Best Practices for Dependencies

### HTTP Client Libraries
- **Preferred:** Use native `fetch` API (Node.js 20+ required for adapters; built-in since Node.js 18)
- **Avoid:** `axios` unless specific features are required (reduces bundle size)

### Example with fetch:
```javascript
try {
  const response = await fetch('https://api.example.com/data');
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  const data = await response.json();
} catch (error) {
  this.log.error(`API request failed: ${error.message}`);
}
```

### Other Dependency Recommendations
- **Logging:** Use adapter built-in logging (`this.log.*`)
- **Scheduling:** Use adapter built-in timers and intervals
- **File operations:** Use Node.js `fs/promises` for async file operations
- **Configuration:** Use adapter config system rather than external config libraries

## Error Handling

### Adapter Error Patterns
- Always catch and log errors appropriately
- Use adapter log levels (error, warn, info, debug)
- Provide meaningful, user-friendly error messages that help users understand what went wrong
- Handle network failures gracefully
- Implement retry mechanisms where appropriate
- Always clean up timers, intervals, and other resources in the `unload()` method

### Example Error Handling:
```javascript
try {
  await this.connectToDevice();
} catch (error) {
  this.log.error(`Failed to connect to device: ${error.message}`);
  this.setState('info.connection', false, true);
  // Implement retry logic if needed
}
```

### Timer and Resource Cleanup:
```javascript
// In your adapter class
private connectionTimer?: NodeJS.Timeout;

async onReady() {
  this.connectionTimer = setInterval(() => {
    this.checkConnection();
  }, 30000);
}

onUnload(callback) {
  try {
    // Clean up timers and intervals
    if (this.connectionTimer) {
      clearInterval(this.connectionTimer);
      this.connectionTimer = undefined;
    }
    // Close connections, clean up resources
    callback();
  } catch (e) {
    callback();
  }
}
```

## Code Style and Standards

- Follow JavaScript/TypeScript best practices
- Use async/await for asynchronous operations
- Implement proper resource cleanup in `unload()` method
- Use semantic versioning for adapter releases
- Include proper JSDoc comments for public methods

## CI/CD and Testing Integration

### GitHub Actions for API Testing
For adapters with external API dependencies, implement separate CI/CD jobs:

```yaml
# Tests API connectivity with demo credentials (runs separately)
demo-api-tests:
  if: contains(github.event.head_commit.message, '[skip ci]') == false
  
  runs-on: ubuntu-22.04
  
  steps:
    - name: Checkout code
      uses: actions/checkout@v4
      
    - name: Use Node.js 20.x
      uses: actions/setup-node@v4
      with:
        node-version: 20.x
        cache: 'npm'
        
    - name: Install dependencies
      run: npm ci
      
    - name: Run demo API tests
      run: npm run test:integration-demo
```

### CI/CD Best Practices
- Run credential tests separately from main test suite
- Use ubuntu-22.04 for consistency
- Don't make credential tests required for deployment
- Provide clear failure messages for API connectivity issues
- Use appropriate timeouts for external API calls (120+ seconds)

### Package.json Script Integration
Add dedicated script for credential testing:
```json
{
  "scripts": {
    "test:integration-demo": "mocha test/integration-demo --exit"
  }
}
```

### Practical Example: Complete API Testing Implementation
Here's a complete example based on lessons learned from the Discovergy adapter:

#### test/integration-demo.js
```javascript
const path = require("path");
const { tests } = require("@iobroker/testing");

// Helper function to encrypt password using ioBroker's encryption method
async function encryptPassword(harness, password) {
    const systemConfig = await harness.objects.getObjectAsync("system.config");
    
    if (!systemConfig || !systemConfig.native || !systemConfig.native.secret) {
        throw new Error("Could not retrieve system secret for password encryption");
    }
    
    const secret = systemConfig.native.secret;
    let result = '';
    for (let i = 0; i < password.length; ++i) {
        result += String.fromCharCode(secret[i % secret.length].charCodeAt(0) ^ password.charCodeAt(i));
    }
    
    return result;
}

// Run integration tests with demo credentials
tests.integration(path.join(__dirname, ".."), {
    defineAdditionalTests({ suite }) {
        suite("API Testing with Demo Credentials", (getHarness) => {
            let harness;
            
            before(() => {
                harness = getHarness();
            });

            it("Should connect to API and initialize with demo credentials", async () => {
                console.log("Setting up demo credentials...");
                
                if (harness.isAdapterRunning()) {
                    await harness.stopAdapter();
                }
                
                const encryptedPassword = await encryptPassword(harness, "demo_password");
                
                await harness.changeAdapterConfig("your-adapter", {
                    native: {
                        username: "demo@provider.com",
                        password: encryptedPassword,
                        // other config options
                    }
                });

                console.log("Starting adapter with demo credentials...");
                await harness.startAdapter();
                
                // Wait for API calls and initialization
                await new Promise(resolve => setTimeout(resolve, 60000));
                
                const connectionState = await harness.states.getStateAsync("your-adapter.0.info.connection");
                
                if (connectionState && connectionState.val === true) {
                    console.log("✅ SUCCESS: API connection established");
                    return true;
                } else {
                    throw new Error("API Test Failed: Expected API connection to be established with demo credentials. " +
                        "Check logs above for specific API errors (DNS resolution, 401 Unauthorized, network issues, etc.)");
                }
            }).timeout(120000);
        });
    }
});
```

### Autodarts-Specific Coding Patterns

#### HTTP Request Pattern
Use Node.js built-in `http` module for polling the Board Manager:
```javascript
const options = {
    hostname: this.config.host,
    port: this.config.port,
    path: "/api/state",
    method: "GET",
    timeout: 5000
};

const req = http.request(options, (res) => {
    let data = "";
    res.on("data", (chunk) => data += chunk);
    res.on("end", () => {
        try {
            const parsed = JSON.parse(data);
            // Process data
        } catch (error) {
            this.log.error(`Failed to parse response: ${error.message}`);
        }
    });
});

req.on("error", (error) => {
    this.log.error(`HTTP request failed: ${error.message}`);
    this.setState("online", false, true);
});

req.on("timeout", () => {
    req.destroy();
    this.log.warn("Request timeout");
});

req.end();
```

#### State Creation Pattern
Always use `extendObjectAsync` instead of `setObjectNotExistsAsync` to ensure proper object structure:
```javascript
await this.extendObjectAsync("throw.current", {
    type: "state",
    common: {
        name: {
            en: "Current throw score",
            de: "Aktueller Wurf-Score"
        },
        type: "number",
        role: "value",
        read: true,
        write: false
    },
    native: {}
});
```

#### Module Pattern for Logic Separation
Extract complex logic into separate modules in `lib/` directory:
```javascript
// lib/throw.js
module.exports = {
    async init(adapter) {
        // Initialize throw-related states
    },
    async processThrow(adapter, throwData) {
        // Process individual throw
    }
};

// main.js
const throwLogic = require("./lib/throw");
await throwLogic.init(this);
```

#### Timer Cleanup Pattern
Always clean up timers in `onUnload` to prevent memory leaks:
    this.pollTimer = null;           // Polling loop timer
    this.versionTimer = null;        // System info refresh timer (5 min interval)
    this.resetTimers = {};           // Object for individual trigger reset timers
  }

  onUnload(callback) {
    try {
      if (this.pollTimer) clearTimeout(this.pollTimer);
      if (this.versionTimer) clearInterval(this.versionTimer);
      // Clear all individual reset timers
      Object.values(this.resetTimers).forEach(timer => {
        if (timer) clearTimeout(timer);
      });       } catch (e) {
            callback();
        }
    }
}
```

#### Signature-Based Deduplication
Prevent duplicate processing of the same throw data:
```javascript
const signature = JSON.stringify(matchData.throws || []);
if (signature === this.lastSignature) {
    // Skip - same data as before
    return;
}
this.lastSignature = signature;
```

#### Multilingual State Names
Always provide at least English and German translations:
```javascript
common: {
    name: {
        en: "Traffic light state",
        de: "Ampel-Status"
    },
    // ...
}
```
