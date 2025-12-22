"use strict";

const utils = require("@iobroker/adapter-core");
const http = require("http");

class Autodarts extends utils.Adapter {
	constructor(options) {
		super({
			...options,
			name: "autodarts",
		});

		this.on("ready", this.onReady.bind(this));
		this.on("unload", this.onUnload.bind(this));

		this.pollTimer = null;
		this.lastThrowsCount = 0; // Anzahl Darts im aktuellen Visit
		this.lastSignature = ""; // Verhindert doppelte Verarbeitung gleicher Würfe
		this.offline = false;
		this.versionTimer = null; // Timer für Versionsabfrage
	}

	async onReady() {
		this.log.info("Autodarts adapter started");

		// Defaults aus io-package.json absichern
		this.config.host ??= "127.0.0.1";
		this.config.port ??= 3180;
		this.config.interval ??= 1000;

		// Visit-Struktur anlegen
		await this.setObjectNotExistsAsync("visit", {
			type: "channel",
			common: {
				name: {
					en: "Current visit",
					de: "Aktuelle Aufnahme",
				},
			},
			native: {},
		});

		await this.setObjectNotExistsAsync("visit.score", {
			type: "state",
			common: {
				name: {
					en: "Visit score (Total of 3 darts)",
					de: "Aufnahme (Summe dreier Darts)",
				},
				type: "number",
				role: "value",
				read: true,
				write: false,
				desc: {
					en: "Total of the last complete visit",
					de: "Summe der letzten vollständigen Aufnahme",
				},
			},
			native: {},
		});

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

		// Zustand zurücksetzen
		this.lastThrowsCount = 0;
		this.lastSignature = "";

		// Polling starten
		this.pollTimer = setInterval(() => this.fetchState(), this.config.interval);
		this.fetchState();

		// Boardmanager-Version abfragen und alle 5 Minuten aktualisieren
		this.fetchVersion();
		this.versionTimer = setInterval(() => this.fetchVersion(), 5 * 60 * 1000);
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
			res.on("end", () => {
				this.offline = false;
				this.setState("online", true, true); // Server erreichbar

				try {
					const state = JSON.parse(data);

					// Nur weiter, wenn throws existieren, Array ist und nicht leer
					if (!state.throws || !Array.isArray(state.throws) || state.throws.length === 0) {
						return;
					}

					const currentThrows = state.throws;
					const currentCount = currentThrows.length;

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

					// Nur schreiben, wenn:
					// - genau 3 Darts geworfen wurden
					// - vorher weniger als 3 waren (Visit gerade abgeschlossen)
					if (currentCount === 3 && this.lastThrowsCount < 3) {
						const lastThrows = currentThrows.slice(-3);
						const visitSum = lastThrows.reduce((sum, dart) => sum + this.calcScore(dart), 0);

						// WICHTIG: Immer schreiben, auch wenn Wert gleich bleibt
						this.setState("visit.score", { val: visitSum, ack: true });
					}

					// Zustand speichern
					this.lastThrowsCount = currentCount;
				} catch (e) {
					this.log.warn(`Autodarts API Fehler: ${e.message} | Daten: ${data.substring(0, 200)}...`);
					// Bei JSON-Fehler: Board war erreichbar, aber Antwort kaputt
					this.setState("online", true, true);
				}
			});
		});

		req.on("error", () => {
			if (!this.offline) {
				this.log.warn("Autodarts not reachable");
				this.offline = true;
			}
			this.setState("online", false, true); // Server offline
		});

		req.on("timeout", () => {
			req.destroy();
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
			this.log.warn("Version-API nicht erreichbar");
			this.setState("system.boardVersion", { val: "", ack: true });
		});

		req.on("timeout", () => {
			req.destroy();
			this.setState("system.boardVersion", { val: "", ack: true });
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
			callback();
			// eslint-disable-next-line @typescript-eslint/no-unused-vars
		} catch (e) {
			callback();
		}
	}
}

if (require.main !== module) {
	module.exports = options => new Autodarts(options);
} else {
	new Autodarts();
}
