/* eslint-disable jsdoc/require-param-description */
// lib/hardware.js
"use strict";

/**
 * Initialisiert Basis-States (online, info.connection, status.boardStatus).
 *
 * @param {import("@iobroker/adapter-core").AdapterInstance} adapter
 */
async function init(adapter) {
	// Initial connection state
	await adapter.extendObjectAsync("info.connection", {
		type: "state",
		common: {
			name: "Connected to Autodarts Board Manager",
			type: "boolean",
			role: "indicator.connected",
			read: true,
			write: false,
		},
		native: {},
	});

	// Online-Datenpunkt
	await adapter.extendObjectAsync("online", {
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

	// status.boardStatus
	await adapter.extendObjectAsync("status.boardStatus", {
		type: "state",
		common: {
			name: {
				en: "Board event status",
				de: "Board-Ereignis-Status",
			},
			type: "string",
			role: "info.status",
			read: true,
			write: false,
			desc: {
				en: "Current event value from /api/state",
				de: "Aktueller event-Wert aus /api/state",
			},
		},
		native: {},
	});

	// Trigger-Channel
	await adapter.extendObjectAsync("trigger", {
		type: "channel",
		common: {
			name: {
				en: "Trigger states",
				de: "Trigger-Zustände",
			},
		},
		native: {},
	});

	// Setzen der Initialwerte
	await adapter.setState("info.connection", false, true);
	await adapter.setState("online", false, true);
	await adapter.setState("status.boardStatus", { val: "offline", ack: true });

	// Subscribe to hardware control states
	adapter.subscribeStates("system.hardware.light");
	adapter.subscribeStates("system.hardware.power");
}

/**
 * Verarbeitet State-Change-Events für Hardware-Control-States.
 * Wird aus main.js:onStateChange aufgerufen.
 *
 * @param {import("@iobroker/adapter-core").AdapterInstance} adapter
 * @param {string} idShort State-ID ohne Namespace
 * @param {ioBroker.State} state Neuer State (ack=false für User-Writes)
 * @returns {boolean} true, wenn der State verarbeitet wurde
 */
async function handleStateChange(adapter, idShort, state) {
	if (idShort === "system.hardware.light") {
		if (adapter.config.lightTargetId) {
			await adapter.setForeignStateAsync(adapter.config.lightTargetId, state.val, false);
		} else {
			adapter.log.warn("Light state changed, but no lightTargetId configured");
		}
		return true;
	}

	if (idShort === "system.hardware.power") {
		if (adapter.config.powerTargetId) {
			await adapter.setForeignStateAsync(adapter.config.powerTargetId, state.val, false);
		} else {
			adapter.log.warn("Power state changed, but no powerTargetId configured");
		}
		return true;
	}

	return false;
}

/**
 * Synchonisiert externe (Foreign) States mit internen Hardware-Control-States.
 * Wird aus main.js:onStateChange bei Foreign-State-Changes aufgerufen.
 *
 * @param {import("@iobroker/adapter-core").AdapterInstance} adapter
 * @param {string} id Vollständige State-ID (mit Namespace)
 * @param {ioBroker.State} state Neuer State
 * @returns {boolean} true, wenn ein Foreign-State verarbeitet wurde
 */
async function handleForeignStateChange(adapter, id, state) {
	if (adapter.config.lightTargetId && id === adapter.config.lightTargetId) {
		await adapter.setState("system.hardware.light", { val: state.val, ack: true });
		return true;
	}

	if (adapter.config.powerTargetId && id === adapter.config.powerTargetId) {
		await adapter.setState("system.hardware.power", { val: state.val, ack: true });
		return true;
	}

	return false;
}

/**
 * Registriert Foreign-State-Subscriptions basierend auf Adapter-Konfiguration.
 *
 * @param {import("@iobroker/adapter-core").AdapterInstance} adapter
 */
function subscribeForeignStates(adapter) {
	if (adapter.config.lightTargetId) {
		adapter.subscribeForeignStates(adapter.config.lightTargetId);
	}
	if (adapter.config.powerTargetId) {
		adapter.subscribeForeignStates(adapter.config.powerTargetId);
	}
}

module.exports = {
	init,
	handleStateChange,
	handleForeignStateChange,
	subscribeForeignStates,
};
