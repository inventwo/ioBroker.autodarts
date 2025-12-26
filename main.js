"use strict";

const utils = require("@iobroker/adapter-core");
const http = require("http");
const throwLogic = require("./lib/throw");
const visit = require("./lib/visit");
const trafficLight = require("./lib/trafficLight");

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
		this.triggerResetMsRuntime = null;
		this.tripleResetTimer = null;
		this.bullResetTimer = null;
	}

	async onReady() {
		this.log.info("Autodarts adapter started");

		// Defaults aus io-package.json absichern
		this.config.host ??= "127.0.0.1";
		this.config.port ??= 3180;
		this.config.interval ??= 1000;
		// eslint-disable-next-line jsdoc/check-tag-names
		/** @ts-expect-error tripleMinScore is defined in io-package.json but not in AdapterConfig */
		this.config.tripleMinScore ??= 1; // Mindestpunktzahl für Triple-Flag
		// eslint-disable-next-line jsdoc/check-tag-names
		/** @ts-expect-error tripleMaxScore is defined in io-package.json but not in AdapterConfig */
		this.config.tripleMaxScore ??= 20; // Maximalpunktzahl für Triple-Flag
		// eslint-disable-next-line jsdoc/check-tag-names
		/** @ts-expect-error triggerResetMs is defined in io-package.json/jsonConfig but not in AdapterConfig */
		this.config.triggerResetMs ??= 0; // 0 = kein Auto-Reset

		// Visit-Struktur anlegen (ausgelagert)
		await visit.init(this);

		// Throw-Channel und States anlegen (ausgelagert)
		await throwLogic.init(this);

		// Online-Datenpunkt
		await this.setObjectNotExistsAsync("online", {
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
		await this.setObjectNotExistsAsync("system", {
			type: "channel",
			common: {
				name: {
					en: "Information about the system",
					de: "Informationen zum System",
				},
			},
			native: {},
		});

		await this.setObjectNotExistsAsync("system.boardVersion", {
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
		await this.setObjectNotExistsAsync("system.cam0", {
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

		await this.setObjectNotExistsAsync("system.cam1", {
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

		await this.setObjectNotExistsAsync("system.cam2", {
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

		// Config-Channel und States für tripleMinScore / tripleMaxScore / triggerResetMs (zur Laufzeit änderbar)
		await this.setObjectNotExistsAsync("config", {
			type: "channel",
			common: {
				name: {
					en: "Runtime configuration",
					de: "Laufzeitkonfiguration",
				},
			},
			native: {},
		});

		await this.setObjectNotExistsAsync("config.tripleMinScore", {
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

		await this.setObjectNotExistsAsync("config.tripleMaxScore", {
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

		await this.setObjectNotExistsAsync("config.triggerResetMs", {
			type: "state",
			common: {
				name: {
					en: "Triple/Bull reset (ms)",
					de: "Triple/Bull Reset (ms)",
				},
				type: "number",
				role: "value",
				read: true,
				write: true,
				desc: {
					en: "Time in ms after which isTriple and isBullseye are reset to false",
					de: "Zeit in ms, nach der isTriple und isBullseye wieder auf false gesetzt werden",
				},
			},
			native: {},
		});

		// Laufzeitwerte initial aus Adapter-Config setzen
		// eslint-disable-next-line jsdoc/check-tag-names
		/** @ts-expect-error tripleMinScore is defined in io-package.json but not in AdapterConfig */
		this.tripleMinScoreRuntime = Number(this.config.tripleMinScore) || 1;
		// eslint-disable-next-line jsdoc/check-tag-names
		/** @ts-expect-error tripleMaxScore is defined in io-package.json but not in AdapterConfig */
		this.tripleMaxScoreRuntime = Number(this.config.tripleMaxScore) || 20;
		// eslint-disable-next-line jsdoc/check-tag-names
		/** @ts-expect-error triggerResetMs is defined in io-package.json/jsonConfig but not in AdapterConfig */
		this.triggerResetMsRuntime = Number(this.config.triggerResetMs) || 0; // 0 = kein Auto-Reset

		await this.setStateAsync("config.tripleMinScore", {
			val: this.tripleMinScoreRuntime,
			ack: true,
		});
		await this.setStateAsync("config.tripleMaxScore", {
			val: this.tripleMaxScoreRuntime,
			ack: true,
		});

		await this.setStateAsync("config.triggerResetMs", {
			val: this.triggerResetMsRuntime,
			ack: true,
		});

		// Ampel-States anlegen
		await trafficLight.init(this);

		// Auf Änderungen am Config-State hören
		this.subscribeStates("config.tripleMinScore");
		this.subscribeStates("config.tripleMaxScore");
		this.subscribeStates("config.triggerResetMs");

		// Zustand zurücksetzen
		this.lastThrowsCount = 0;
		this.lastSignature = "";

		// Polling starten
		this.pollTimer = setInterval(() => this.fetchState(), this.config.interval);
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
	 * Reaktion auf State-Änderungen (z. B. config.tripleMinScore / config.tripleMaxScore / config.triggerResetMs)
	 *
	 * @param {string} id  Full state id
	 * @param {ioBroker.State | null | undefined} state  New state value (ack=false on user write)
	 */
	onStateChange(id, state) {
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
			this.setState("config.tripleMinScore", { val, ack: true });
		} else if (idShort === "config.tripleMaxScore") {
			const val = Number(state.val);
			if (!Number.isFinite(val) || val <= 0) {
				this.log.warn(`Invalid tripleMaxScore value: ${state.val}`);
				return;
			}

			this.tripleMaxScoreRuntime = val;
			this.log.info(`Runtime tripleMaxScore updated to ${val}`);

			// Wert mit ack bestätigen
			this.setState("config.tripleMaxScore", { val, ack: true });
		} else if (idShort === "config.triggerResetMs") {
			const val = Number(state.val);
			if (!Number.isFinite(val) || val < 0) {
				this.log.warn(`Invalid triggerResetMs value: ${state.val}`);
				return;
			}

			this.triggerResetMsRuntime = val;
			this.log.info(`Runtime triggerResetMs updated to ${val} ms`);

			// Wert mit ack bestätigen
			this.setState("config.triggerResetMs", { val, ack: true });
		}
	}

	/**
	 * Autodarts API abfragen und Visit-Summe schreiben
	 */
	fetchState() {
		const options = {
			host: this.config.host,
			port: this.config.port,
			path: "/api/state",
			method: "GET",
			timeout: 1500,
		};

		const req = http.request(options, res => {
			let data = "";

			res.on("data", chunk => (data += chunk));
			res.on("end", async () => {
				this.offline = false;
				this.setState("online", true, true); // Server erreichbar

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
					this.setState("online", true, true);
				}
			});
		});

		req.on("error", async () => {
			if (!this.offline) {
				this.log.warn("Autodarts not reachable");
				this.offline = true;
			}
			await trafficLight.setStatus(this, "red"); // Ampel = rot
			this.setState("online", false, true); // Server offline
		});

		req.on("timeout", async () => {
			req.destroy();
			if (!this.offline) {
				this.log.warn("Autodarts not reachable");
				this.offline = true;
			}
			await trafficLight.setStatus(this, "red"); // Ampel = rot
			this.setState("online", false, true); // Server offline bei Timeout
		});

		req.end();
	}

	/**
	 * Boardmanager Version abfragen
	 */
	fetchVersion() {
		const options = {
			host: this.config.host,
			port: this.config.port,
			path: "/api/version",
			method: "GET",
			timeout: 1500,
		};

		const req = http.request(options, res => {
			let data = "";
			res.on("data", chunk => (data += chunk));
			res.on("end", () => {
				try {
					const version = data.trim();
					this.setState("system.boardVersion", { val: version, ack: true });
				} catch (e) {
					this.log.warn(`Fehler beim Lesen der Version: ${e.message}`);
				}
			});
		});

		req.on("error", () => {
			// Keine Log-Warnung, nur State leeren
			this.setState("system.boardVersion", { val: "", ack: true });
		});

		req.on("timeout", () => {
			req.destroy();
			// Keine Log-Warnung, nur State leeren
			this.setState("system.boardVersion", { val: "", ack: true });
		});

		req.end();
	}

	/**
	 * Board-Konfiguration abfragen (Kameras)
	 */
	fetchConfig() {
		const options = {
			host: this.config.host,
			port: this.config.port,
			path: "/api/config",
			method: "GET",
			timeout: 1500,
		};

		const req = http.request(options, res => {
			let data = "";
			res.on("data", chunk => (data += chunk));
			res.on("end", () => {
				try {
					const cfg = JSON.parse(data);

					const cam = cfg.cam || {};
					const camInfo = {
						width: cam.width ?? 1280,
						height: cam.height ?? 720,
						fps: cam.fps ?? 20,
					};

					const json = JSON.stringify(camInfo);

					this.setState("system.cam0", { val: json, ack: true });
					this.setState("system.cam1", { val: json, ack: true });
					this.setState("system.cam2", { val: json, ack: true });
				} catch (e) {
					this.log.warn(`Fehler beim Lesen der Config: ${e.message} | Daten: ${data.substring(0, 200)}...`);
				}
			});
		});

		req.on("error", () => {
			// Keine Log-Warnung mehr
		});

		req.on("timeout", () => {
			req.destroy();
			// Keine Log-Warnung mehr
		});

		req.end();
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
