/* eslint-disable jsdoc/require-param-description */
"use strict";

/**
 * Init für Tools-Integration.
 * Legt Startwerte und Subscription für tools.RAW an.
 *
 * @param {import("@iobroker/adapter-core").AdapterInstance} adapter
 */
async function init(adapter) {
	// Initialzustand setzen
	await adapter.setStateAsync("tools.RAW", { val: "", ack: true });
	await adapter.setStateAsync("tools.busted", { val: false, ack: true });
	await adapter.setStateAsync("tools.gameon", { val: false, ack: true });
	await adapter.setStateAsync("tools.gameshot", { val: false, ack: true });

	// Auf Änderungen von tools.RAW hören
	adapter.subscribeStates("tools.RAW");
}

/**
 * Verarbeitet Änderungen an tools.* States.
 * Wird aus main.js:onStateChange aufgerufen.
 *
 * @param {import("@iobroker/adapter-core").AdapterInstance} adapter
 * @param {string} idShort  State-ID ohne Namespace (z.B. "tools.RAW")
 * @param {ioBroker.State} state  Neuer State (ack=false auf User/HTTP-Schreibzugriff)
 */
async function handleStateChange(adapter, idShort, state) {
	if (idShort !== "tools.RAW") {
		return;
	}

	const val = String(state.val || "").toLowerCase();
	const timeoutMs = (adapter.triggerResetSecRuntime || 0) * 1000;

	// Alle Trigger zuerst zurücksetzen
	await adapter.setStateAsync("tools.busted", { val: false, ack: true });
	await adapter.setStateAsync("tools.gameon", { val: false, ack: true });
	await adapter.setStateAsync("tools.gameshot", { val: false, ack: true });

	if (val === "busted") {
		await setPulse(adapter, "tools.busted", timeoutMs);
	} else if (val === "gameon") {
		await setPulse(adapter, "tools.gameon", timeoutMs);
	} else if (val === "gameshot") {
		await setPulse(adapter, "tools.gameshot", timeoutMs);
	}
}

/**
 * Hilfsfunktion: setzt einen Bool-State kurz auf true und ggf. per Timeout wieder auf false.
 *
 * // eslint-disable-next-line jsdoc/require-param-description
 *
 * @param {import("@iobroker/adapter-core").AdapterInstance} adapter
 * @param {string} id
 * @param {number} timeoutMs
 */
async function setPulse(adapter, id, timeoutMs) {
	await adapter.setStateAsync(id, { val: true, ack: true });

	if (timeoutMs > 0) {
		if (adapter.resetTimer) {
			clearTimeout(adapter.resetTimer);
		}
		adapter.resetTimer = setTimeout(() => {
			adapter.setState(id, { val: false, ack: true });
			adapter.resetTimer = null;
		}, timeoutMs);
	}
}

module.exports = {
	init,
	handleStateChange,
};
