// main.js
"use strict";

const utils = require("@iobroker/adapter-core");
const throwLogic = require("./lib/throw");
const visit = require("./lib/visit");
const trafficLight = require("./lib/trafficLight");
const tools = require("./lib/tools");
const config = require("./lib/config");
const hardware = require("./lib/hardware");
const systemInfo = require("./lib/systemInfo");
const httpHelper = require("./lib/httpHelper");

class Autodarts extends utils.Adapter {
	constructor(options) {
		super({
			...options,
			name: "autodarts",
		});

		this.isConnected = false;
		this.pollTimer = null;
		this.onlineIntervalMs = 1000; // Platzhalter, wird in onReady gesetzt
		this.offlineIntervalMs = 2000; // z.B. 2s

		this.on("ready", this.onReady.bind(this));
		this.on("stateChange", this.onStateChange.bind(this));
		this.on("unload", this.onUnload.bind(this));

		this.lastThrowsCount = 0; // Anzahl Darts im aktuellen Visit
		this.lastSignature = ""; // Verhindert doppelte Verarbeitung gleicher Würfe
		this.offline = false;
		this.versionTimer = null; // Timer für Versions- und Config-Abfrage

		this.tripleMinScoreRuntime = null; // Laufzeitwert für Triple-Minschwelle
		this.tripleMaxScoreRuntime = null; // Laufzeitwert für Triple-Maxschwelle

		// Reset-Timeout + Timer für isTriple/isBullseye/isDouble/isMiss
		this.triggerResetSecRuntime = null;
		this.resetTimer = null;
		this.resetTimers = {}; // NEU: Objekt für individuelle Timer initialisieren
	}

	async onReady() {
		this.log.info("Autodarts adapter started");

		// Defaults aus io-package.json absichern
		this.config.host ??= "127.0.0.1";
		this.config.port ??= 3180;
		this.config.intervalSec ??= 1;
		this.config.tripleMinScore ??= 1;
		this.config.tripleMaxScore ??= 20;
		this.config.triggerResetSec ??= 0;
		this.config.toolsIp ??= "";
		this.config.toolsPort ??= 8087;
		this.config.toolsInstance ??= 0;

		// Polling-Intervall aus Sekunden in Millisekunden berechnen
		this.onlineIntervalMs = (Number(this.config.intervalSec) || 1) * 1000;

		// Module initialisieren
		await hardware.init(this);
		await systemInfo.init(this);
		await config.init(this);
		await visit.init(this);
		await throwLogic.init(this);
		await trafficLight.init(this);
		await tools.init(this);

		// Runtime-Werte initialisieren
		await config.initializeRuntimeValues(this);

		// Hardware-Subscriptions
		hardware.subscribeForeignStates(this);

		// Zustand zurücksetzen
		this.lastThrowsCount = 0;
		this.lastSignature = "";

		// Polling starten
		this.pollLoop();

		// Host-Informationen und Kameras abfragen und alle 5 Minuten aktualisieren
		await systemInfo.fetchHost(this);
		await systemInfo.fetchConfig(this);
		this.versionTimer = setInterval(
			async () => {
				await systemInfo.fetchHost(this);
				await systemInfo.fetchConfig(this);
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
	 * Reaktion auf State-Änderungen
	 *
	 * @param {string} id  Full state id
	 * @param {ioBroker.State | null | undefined} state  New state value (ack=false on user write)
	 */
	async onStateChange(id, state) {
		if (!state) {
			return;
		}

		const idShort = id.replace(`${this.namespace}.`, "");

		// Foreign State Changes (bidirektionale Synchronisation)
		if (hardware.handleForeignStateChange(this, id, state)) {
			return;
		}

		// Ab hier nur noch eigene States: nur bei ack === false reagieren
		if (state.ack) {
			return;
		}

		// Tools-Events
		if (!state.ack && idShort.startsWith("tools.")) {
			if (await tools.handleStateChange(this, idShort, state)) {
				return;
			}
		}

		// Config-States
		if (await config.handleStateChange(this, idShort, state)) {
			return;
		}

		// Hardware-Control
		if (await hardware.handleStateChange(this, idShort, state)) {
			return;
		}
	}

	/**
	 * Autodarts API abfragen und Visit-Summe schreiben
	 */
	async fetchState() {
		try {
			const data = await httpHelper.makeRequest(this, "/api/state");

			// Log wenn Verbindung wiederhergestellt wurde
			if (this.offline || !this.isConnected) {
				this.log.info("Autodarts connection restored");
			}
			this.offline = false;
			this.isConnected = true;

			await this.setStateAsync("online", true, true); // eigener Online-State
			await this.setStateAsync("info.connection", true, true); // Admin-Status

			try {
				const state = JSON.parse(data);
				const boardStatus = state.status || ""; // z.B. "Throw" oder "Takeout"

				if (boardStatus === "Throw") {
					await trafficLight.setStatus(this, "green");
				} else if (boardStatus === "Takeout") {
					await trafficLight.setStatus(this, "yellow");
				}

				// Nur event-Wert in status.boardStatus schreiben
				if (state.event !== undefined) {
					await this.setStateAsync("status.boardStatus", {
						val: state.event,
						ack: true,
					});
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
			const msg = error?.message || String(error);
			const code = error?.code;

			const isNetErr =
				code === "ECONNREFUSED" ||
				code === "ETIMEDOUT" ||
				code === "EHOSTUNREACH" ||
				msg.includes("timeout") ||
				msg.includes("ECONNRESET");

			if (isNetErr) {
				if (!this.offline) {
					this.log.warn(`Autodarts not reachable: ${msg}`);
					this.offline = true;
				} else {
					this.log.debug(`Autodarts still offline: ${msg}`);
				}

				this.isConnected = false;
				await trafficLight.setStatus(this, "red");
				await this.setStateAsync("online", false, true);
				await this.setStateAsync("info.connection", false, true);
				await this.setStateAsync("status.boardStatus", {
					val: "offline",
					ack: true,
				});
			} else {
				this.log.error(`Autodarts request failed: ${msg}`);
			}
		}
	}

	scheduleNextPoll() {
		const delay = this.isConnected ? this.onlineIntervalMs : this.offlineIntervalMs;
		this.pollTimer = this.setTimeout(() => this.pollLoop(), delay);
	}

	async pollLoop() {
		await this.fetchState().catch(() => {
			// Fehler werden in fetchState geloggt
		});
		this.scheduleNextPoll();
	}

	onUnload(callback) {
		try {
			if (this.pollTimer) {
				clearTimeout(this.pollTimer);
			}
			if (this.versionTimer) {
				clearInterval(this.versionTimer);
			}
			// Alle individuellen Timer löschen
			if (this.resetTimers) {
				for (const id in this.resetTimers) {
					clearTimeout(this.resetTimers[id]);
				}
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
