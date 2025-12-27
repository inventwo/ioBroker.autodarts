"use strict";

const utils = require("@iobroker/adapter-core");
const throwLogic = require("./lib/throw");
const visit = require("./lib/visit");
const trafficLight = require("./lib/trafficLight");
const httpHelper = require("./lib/httpHelper");

class Autodarts extends utils.Adapter {
	constructor(options) {
		super({
			...options,
			name: "autodarts",
		});

		this.on("ready", this.onReady.bind(this));
		this.on("stateChange", this.onStateChange.bind(this));
		this.on("unload", this.onUnload.bind(this));

		this.pollTimer = null;
		this.lastThrowsCount = 0; // Anzahl Darts im aktuellen Visit
		this.lastSignature = ""; // Verhindert doppelte Verarbeitung gleicher Würfe
		this.offline = false;
		this.versionTimer = null; // Timer für Versions- und Config-Abfrage

		this.tripleMinScoreRuntime = null; // Laufzeitwert für Triple-Minschwelle
		this.tripleMaxScoreRuntime = null; // Laufzeitwert für Triple-Maxschwelle

		// NEU: Reset-Timeout + Timer für isTriple/isBullseye
		this.triggerResetSecRuntime = null;
		this.tripleResetTimer = null;
		this.bullResetTimer = null;
	}

	async onReady() {
		this.log.info("Autodarts adapter started");

		// Defaults aus io-package.json absichern
		this.config.host ??= "127.0.0.1";
		this.config.port ??= 3180;
		this.config.intervalSec ??= 1; // Sekunden
		this.config.tripleMinScore ??= 1;
		this.config.tripleMaxScore ??= 20;
		this.config.triggerResetSec ??= 0; // 0 = kein Auto-Reset

		// Visit-Struktur anlegen (ausgelagert)
		await visit.init(this);

		// Throw-Channel und States anlegen (ausgelagert)
		await throwLogic.init(this);

		// Online-Datenpunkt
		await this.extendObjectAsync("online", {
			type: "state",
			common: {
				name: {
					en: "Autodarts board online",
					de: "Autodarts Board online",
				},
				type: "boolean",
				role: "indicator.reachable",
				read: true,
				write: false,
				desc: {
					en: "true = Board reachable, false = Board not reachable",
					de: "true = Board erreichbar, false = Board nicht erreichbar",
				},
			},
			native: {},
		});

		// System-Channel und BoardVersion-Datenpunkt anlegen
		await this.extendObjectAsync("system", {
			type: "channel",
			common: {
				name: {
					en: "Information about the system",
					de: "Informationen zum System",
				},
			},
			native: {},
		});

		await this.extendObjectAsync("system.boardVersion", {
			type: "state",
			common: {
				name: {
					en: "Board manager version",
					de: "Version des Board-Manager",
				},
				type: "string",
				role: "info.version",
				read: true,
				write: false,
				desc: {
					en: "Version of the board manager",
					de: "Version des Board-Manager",
				},
			},
			native: {},
		});

		// Kamera-Infos als JSON-States
		await this.extendObjectAsync("system.cam0", {
			type: "state",
			common: {
				name: {
					en: "Camera 0 config",
					de: "Kamera 0 Konfiguration",
				},
				type: "string",
				role: "json",
				read: true,
				write: false,
				desc: {
					en: "JSON with camera 0 parameters (width, height, fps)",
					de: "JSON mit Kamera-0-Parametern (width, height, fps)",
				},
			},
			native: {},
		});

		await this.extendObjectAsync("system.cam1", {
			type: "state",
			common: {
				name: {
					en: "Camera 1 config",
					de: "Kamera 1 Konfiguration",
				},
				type: "string",
				role: "json",
				read: true,
				write: false,
				desc: {
					en: "JSON with camera 1 parameters (width, height, fps)",
					de: "JSON mit Kamera-1-Parametern (width, height, fps)",
				},
			},
			native: {},
		});

		await this.extendObjectAsync("system.cam2", {
			type: "state",
			common: {
				name: {
					en: "Camera 2 config",
					de: "Kamera 2 Konfiguration",
				},
				type: "string",
				role: "json",
				read: true,
				write: false,
				desc: {
					en: "JSON with camera 2 parameters (width, height, fps)",
					de: "JSON mit Kamera-2-Parametern (width, height, fps)",
				},
			},
			native: {},
		});

		// Config-Channel und States für tripleMinScore / tripleMaxScore / triggerResetSec (zur Laufzeit änderbar)
		await this.extendObjectAsync("config", {
			type: "channel",
			common: {
				name: {
					en: "Runtime configuration",
					de: "Laufzeitkonfiguration",
				},
			},
			native: {},
		});

		await this.extendObjectAsync("config.tripleMinScore", {
			type: "state",
			common: {
				name: {
					en: "Triple minimum score",
					de: "Triple Mindestpunktzahl",
				},
				type: "number",
				role: "value",
				read: true,
				write: true,
				desc: {
					en: "Minimum score for triple flag (overrides adapter config while running)",
					de: "Mindestpunktzahl für den Triple-Trigger (überschreibt Adapter-Config zur Laufzeit)",
				},
			},
			native: {},
		});

		await this.extendObjectAsync("config.tripleMaxScore", {
			type: "state",
			common: {
				name: {
					en: "Triple maximum score",
					de: "Triple Maximalpunktzahl",
				},
				type: "number",
				role: "value",
				read: true,
				write: true,
				desc: {
					en: "Maximum score for triple flag (overrides adapter config while running)",
					de: "Maximalpunktzahl für den Triple-Trigger (überschreibt Adapter-Config zur Laufzeit)",
				},
			},
			native: {},
		});

		await this.extendObjectAsync("config.triggerResetSec", {
			type: "state",
			common: {
				name: {
					en: "Triple/Bull reset (s)",
					de: "Triple/Bull Reset (s)",
				},
				type: "number",
				role: "value",
				read: true,
				write: true,
				desc: {
					en: "Time in seconds after which isTriple and isBullseye are reset to false",
					de: "Zeit in Sekunden, nach der isTriple und isBullseye wieder auf false gesetzt werden",
				},
			},
			native: {},
		});

		// Laufzeitwerte initial aus Adapter-Config setzen
		this.tripleMinScoreRuntime = Number(this.config.tripleMinScore) || 1;
		this.tripleMaxScoreRuntime = Number(this.config.tripleMaxScore) || 20;
		this.triggerResetSecRuntime = Number(this.config.triggerResetSec) || 0; // 0 = kein Auto-Reset

		await this.setStateAsync("config.tripleMinScore", {
			val: this.tripleMinScoreRuntime,
			ack: true,
		});
		await this.setStateAsync("config.tripleMaxScore", {
			val: this.tripleMaxScoreRuntime,
			ack: true,
		});

		await this.setStateAsync("config.triggerResetSec", {
			val: this.triggerResetSecRuntime,
			ack: true,
		});

		// Ampel-States anlegen
		await trafficLight.init(this);

		// Auf Änderungen am Config-State hören
		this.subscribeStates("config.tripleMinScore");
		this.subscribeStates("config.tripleMaxScore");
		this.subscribeStates("config.triggerResetSec");

		// Zustand zurücksetzen
		this.lastThrowsCount = 0;
		this.lastSignature = "";

		// Polling-Intervall aus Sekunden in Millisekunden umrechnen
		const pollIntervalMs = (Number(this.config.intervalSec) || 1) * 1000;

		// Polling starten
		this.pollTimer = setInterval(() => this.fetchState(), pollIntervalMs);
		this.fetchState();

		// Boardmanager-Version und Kameras abfragen und alle 5 Minuten aktualisieren
		this.fetchVersion();
		this.fetchConfig();
		this.versionTimer = setInterval(
			() => {
				this.fetchVersion();
				this.fetchConfig();
			},
			5 * 60 * 1000,
		);
	}

	/**
	 * Punkte eines Dart berechnen
	 *
	 * @param {object} dart - Ein Dart-Objekt aus Autodarts throws
	 * @returns {number} Punkte
	 */
	calcScore(dart) {
		if (!dart?.segment) {
			return 0;
		}
		return (dart.segment.number || 0) * (dart.segment.multiplier || 0);
	}

	/**
	 * Reaktion auf State-Änderungen (z. B. config.tripleMinScore / config.tripleMaxScore / config.triggerResetSec)
	 *
	 * @param {string} id  Full state id
	 * @param {ioBroker.State | null | undefined} state  New state value (ack=false on user write)
	 */
	async onStateChange(id, state) {
		if (!state) {
			return;
		}

		// Nur auf Schreibaktionen reagieren (ack === false)
		if (state.ack) {
			return;
		}

		const idShort = id.replace(`${this.namespace}.`, "");

		if (idShort === "config.tripleMinScore") {
			const val = Number(state.val);
			if (!Number.isFinite(val) || val <= 0) {
				this.log.warn(`Invalid tripleMinScore value: ${state.val}`);
				return;
			}

			this.tripleMinScoreRuntime = val;
			this.log.info(`Runtime tripleMinScore updated to ${val}`);

			// Wert mit ack bestätigen
			await this.setStateAsync("config.tripleMinScore", { val, ack: true });
		} else if (idShort === "config.tripleMaxScore") {
			const val = Number(state.val);
			if (!Number.isFinite(val) || val <= 0) {
				this.log.warn(`Invalid tripleMaxScore value: ${state.val}`);
				return;
			}

			this.tripleMaxScoreRuntime = val;
			this.log.info(`Runtime tripleMaxScore updated to ${val}`);

			// Wert mit ack bestätigen
			await this.setStateAsync("config.tripleMaxScore", { val, ack: true });
		} else if (idShort === "config.triggerResetSec") {
			const val = Number(state.val);
			if (!Number.isFinite(val) || val < 0) {
				this.log.warn(`Invalid triggerResetSec value: ${state.val}`);
				return;
			}

			this.triggerResetSecRuntime = val;
			this.log.info(`Runtime triggerResetSec updated to ${val} s`);

			// Wert mit ack bestätigen
			await this.setStateAsync("config.triggerResetSec", { val, ack: true });
		}
	}

	/**
	 * Autodarts API abfragen und Visit-Summe schreiben
	 */
	async fetchState() {
		try {
			const data = await httpHelper.makeRequest(this, "/api/state");

			// Log wenn Verbindung wiederhergestellt wurde
			if (this.offline) {
				this.log.info("Autodarts connection restored");
			}
			this.offline = false;
			await this.setStateAsync("online", true, true); // Server erreichbar

			try {
				const state = JSON.parse(data);
				const boardStatus = state.status || ""; // z.B. "Throw" oder "Takeout"

				if (boardStatus === "Throw") {
					await trafficLight.setStatus(this, "green");
				} else if (boardStatus === "Takeout") {
					await trafficLight.setStatus(this, "yellow");
				}

				// Nur weiter, wenn throws existieren, Array ist und nicht leer
				if (!state.throws || !Array.isArray(state.throws) || state.throws.length === 0) {
					return;
				}

				const currentThrows = state.throws;

				// Prüfen, ob sich die Würfe geändert haben
				const signature = JSON.stringify(
					currentThrows.map(d => ({
						name: d.segment?.name || "",
						mult: d.segment?.multiplier || 0,
					})),
				);

				if (signature === this.lastSignature) {
					return;
				}
				this.lastSignature = signature;

				// letzten Dart in States schreiben (ausgelagert)
				const lastDart = currentThrows[currentThrows.length - 1];
				await throwLogic.updateThrow(this, lastDart);

				// Visit-Summe aktualisieren (ausgelagert)
				this.lastThrowsCount = await visit.updateVisit(this, currentThrows, this.lastThrowsCount);
			} catch (e) {
				this.log.warn(`Autodarts API Fehler: ${e.message} | Daten: ${data.substring(0, 200)}...`);
				// Bei JSON-Fehler: Board war erreichbar, aber Antwort kaputt
				await this.setStateAsync("online", true, true);
			}
		} catch (error) {
			if (!this.offline) {
				this.log.warn(`Autodarts not reachable: ${error.message}`);
				this.offline = true;
			}
			await trafficLight.setStatus(this, "red"); // Ampel = rot
			await this.setStateAsync("online", false, true); // Server offline
		}
	}

	/**
	 * Boardmanager Version abfragen
	 */
	async fetchVersion() {
		try {
			const data = await httpHelper.makeRequest(this, "/api/version");
			const version = data.trim();
			await this.setStateAsync("system.boardVersion", { val: version, ack: true });
		} catch {
			// Bei Fehler State leeren (keine Log-Warnung)
			await this.setStateAsync("system.boardVersion", { val: "", ack: true });
		}
	}

	/**
	 * Board-Konfiguration abfragen (Kameras)
	 */
	async fetchConfig() {
		try {
			const data = await httpHelper.makeRequest(this, "/api/config");
			const cfg = JSON.parse(data);

			const cam = cfg.cam || {};
			const camInfo = {
				width: cam.width ?? 1280,
				height: cam.height ?? 720,
				fps: cam.fps ?? 20,
			};

			const json = JSON.stringify(camInfo);

			await this.setStateAsync("system.cam0", { val: json, ack: true });
			await this.setStateAsync("system.cam1", { val: json, ack: true });
			await this.setStateAsync("system.cam2", { val: json, ack: true });
		} catch (error) {
			// Bei Fehler keine Log-Warnung
			if (
				error &&
				typeof error === "object" &&
				typeof error.message === "string" &&
				error.message.includes("JSON")
			) {
				this.log.debug(`Could not parse camera config: ${error.message}`);
			}
		}
	}

	onUnload(callback) {
		try {
			if (this.pollTimer) {
				clearInterval(this.pollTimer);
			}
			if (this.versionTimer) {
				clearInterval(this.versionTimer);
			}
			if (this.tripleResetTimer) {
				clearTimeout(this.tripleResetTimer);
			}
			if (this.bullResetTimer) {
				clearTimeout(this.bullResetTimer);
			}
			callback();
		} catch {
			callback();
		}
	}
}

if (require.main !== module) {
	module.exports = options => new Autodarts(options);
} else {
	new Autodarts();
}
