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
	}

	async onReady() {
		this.log.info("Autodarts adapter started");

		// Defaults aus io-package.json absichern
		this.config.host ??= "127.0.0.1";
		this.config.port ??= 3180;
		this.config.interval ??= 2000;

		// Visit-Struktur anlegen
		await this.setObjectNotExistsAsync("visit", {
			type: "channel",
			common: { name: "Current visit" },
			native: {},
		});

		await this.setObjectNotExistsAsync("visit.score", {
			type: "state",
			common: {
				name: {
					en: "Visit score (Total of 3 darts)",
					de: "Visit-Punkte (Summe der 3 Darts)",
				},
				type: "number",
				role: "value",
				read: true,
				write: false,
				desc: {
					en: "Total of the last complete visit",
					de: "Summe des letzten vollständigen Visit",
				},
			},
			native: {},
		});

		// Online-Datenpunkt
		await this.setObjectNotExistsAsync("online", {
			type: "state",
			common: {
				name: {
					en: "Autodarts Board online",
					de: "Autodarts Board online",
				},
				type: "boolean",
				role: "indicator.reachable",
				read: true,
				write: false,
				desc: {
					en: "true = Board reachable, false = not reachable",
					de: "true = Board erreichbar, false = nicht erreichbar",
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

	onUnload(callback) {
		try {
			if (this.pollTimer) {
				clearInterval(this.pollTimer);
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
