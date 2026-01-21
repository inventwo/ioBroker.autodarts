/* eslint-disable jsdoc/require-param-description */
// lib/config.js
"use strict";

/**
 * Initialisiert Config-Channel und Runtime-Config-States.
 *
 * @param {import("@iobroker/adapter-core").AdapterInstance} adapter
 */
async function init(adapter) {
	// Config-Channel
	await adapter.extendObjectAsync("config", {
		type: "channel",
		common: {
			name: {
				en: "Runtime configuration",
				de: "Laufzeitkonfiguration",
			},
		},
		native: {},
	});

	// tripleMinScore
	await adapter.extendObjectAsync("config.tripleMinScore", {
		type: "state",
		common: {
			name: {
				en: "Triple minimum score",
				de: "Triple Mindestpunktzahl",
			},
			type: "number",
			role: "level.min",
			read: true,
			write: true,
			desc: {
				en: "Minimum score for triple flag (overrides adapter config while running)",
				de: "Mindestpunktzahl für den Triple-Trigger (überschreibt Adapter-Config zur Laufzeit)",
			},
		},
		native: {},
	});

	// tripleMaxScore
	await adapter.extendObjectAsync("config.tripleMaxScore", {
		type: "state",
		common: {
			name: {
				en: "Triple maximum score",
				de: "Triple Maximalpunktzahl",
			},
			type: "number",
			role: "level.max",
			read: true,
			write: true,
			desc: {
				en: "Maximum score for triple flag (overrides adapter config while running)",
				de: "Maximalpunktzahl für den Triple-Trigger (überschreibt Adapter-Config zur Laufzeit)",
			},
		},
		native: {},
	});

	// triggerResetSec
	await adapter.extendObjectAsync("config.triggerResetSec", {
		type: "state",
		common: {
			name: {
				en: "Triple/Bull reset (s)",
				de: "Triple/Bull Reset (s)",
			},
			type: "number",
			role: "level.timer",
			read: true,
			write: true,
			desc: {
				en: "Time in seconds after which isTriple and isBullseye are reset to false",
				de: "Zeit in Sekunden, nach der isTriple und isBullseye wieder auf false gesetzt werden",
			},
		},
		native: {},
	});

	// Subscribe to config state changes
	adapter.subscribeStates("config.tripleMinScore");
	adapter.subscribeStates("config.tripleMaxScore");
	adapter.subscribeStates("config.triggerResetSec");
}

/**
 * Initialisiert die Runtime-Werte der Config aus der Adapter-Config
 * und schreibt sie in die entsprechenden States.
 *
 * @param {import("@iobroker/adapter-core").AdapterInstance} adapter
 */
async function initializeRuntimeValues(adapter) {
	adapter.tripleMinScoreRuntime = Number(adapter.config.tripleMinScore) || 1;
	adapter.tripleMaxScoreRuntime = Number(adapter.config.tripleMaxScore) || 20;
	adapter.triggerResetSecRuntime = Number(adapter.config.triggerResetSec) || 0;

	await adapter.setStateAsync("config.tripleMinScore", {
		val: adapter.tripleMinScoreRuntime,
		ack: true,
	});
	await adapter.setStateAsync("config.tripleMaxScore", {
		val: adapter.tripleMaxScoreRuntime,
		ack: true,
	});
	await adapter.setStateAsync("config.triggerResetSec", {
		val: adapter.triggerResetSecRuntime,
		ack: true,
	});
}

/**
 * Verarbeitet State-Change-Events für Config-States.
 * Wird aus main.js:onStateChange aufgerufen.
 *
 * @param {import("@iobroker/adapter-core").AdapterInstance} adapter
 * @param {string} idShort State-ID ohne Namespace
 * @param {ioBroker.State} state Neuer State (ack=false für User-Writes)
 * @returns {boolean} true, wenn der State verarbeitet wurde
 */
async function handleStateChange(adapter, idShort, state) {
	if (idShort === "config.tripleMinScore") {
		const val = Number(state.val);
		if (!Number.isFinite(val) || val <= 0) {
			adapter.log.warn(`Invalid tripleMinScore value: ${state.val}`);
			return true;
		}

		adapter.tripleMinScoreRuntime = val;
		adapter.log.info(`Runtime tripleMinScore updated to ${val}`);
		await adapter.setStateAsync("config.tripleMinScore", { val, ack: true });
		return true;
	}

	if (idShort === "config.tripleMaxScore") {
		const val = Number(state.val);
		if (!Number.isFinite(val) || val <= 0) {
			adapter.log.warn(`Invalid tripleMaxScore value: ${state.val}`);
			return true;
		}

		adapter.tripleMaxScoreRuntime = val;
		adapter.log.info(`Runtime tripleMaxScore updated to ${val}`);
		await adapter.setStateAsync("config.tripleMaxScore", { val, ack: true });
		return true;
	}

	if (idShort === "config.triggerResetSec") {
		const val = Number(state.val);
		if (!Number.isFinite(val) || val < 0) {
			adapter.log.warn(`Invalid triggerResetSec value: ${state.val}`);
			return true;
		}

		adapter.triggerResetSecRuntime = val;
		adapter.log.info(`Runtime triggerResetSec updated to ${val} s`);
		await adapter.setStateAsync("config.triggerResetSec", { val, ack: true });
		return true;
	}

	return false;
}

module.exports = {
	init,
	initializeRuntimeValues,
	handleStateChange,
};
