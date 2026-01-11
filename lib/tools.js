// lib/tools.js
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
	await adapter.setStateAsync("trigger.isBusted", { val: false, ack: true });
	await adapter.setStateAsync("trigger.isGameon", { val: false, ack: true });
	await adapter.setStateAsync("trigger.isGameshot", { val: false, ack: true });
	await adapter.setStateAsync("trigger.is180", { val: false, ack: true });
	await adapter.setStateAsync("trigger.isMatchshot", { val: false, ack: true });
	await adapter.setStateAsync("trigger.isTakeout", { val: false, ack: true });

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

	/* Alle Trigger zuerst zurücksetzen
	await adapter.setStateAsync("tools.busted", { val: false, ack: true });
	await adapter.setStateAsync("tools.gameon", { val: false, ack: true });
	await adapter.setStateAsync("tools.gameshot", { val: false, ack: true });
	await adapter.setStateAsync("tools.180", { val: false, ack: true });
	await adapter.setStateAsync("tools.matchshot", { val: false, ack: true });
	await adapter.setStateAsync("tools.takeout", { val: false, ack: true });
	*/

	if (val === "busted") {
		await setPulse(adapter, "trigger.isBusted", timeoutMs);
	} else if (val === "gameon") {
		await setPulse(adapter, "trigger.isGameon", timeoutMs);
	} else if (val === "gameshot") {
		await setPulse(adapter, "trigger.isGameshot", timeoutMs);
	} else if (val === "180") {
		await setPulse(adapter, "trigger.is180", timeoutMs);
	} else if (val === "matchshot") {
		await setPulse(adapter, "trigger.isMatchshot", timeoutMs);
	} else if (val === "takeout") {
		await setPulse(adapter, "trigger.isTakeout", timeoutMs);
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
	// Falls das Objekt für die Timer noch nicht existiert, kurz anlegen
	adapter.resetTimers = adapter.resetTimers || {};

	// 1) Auf true setzen
	await adapter.setStateAsync(id, { val: true, ack: true });

	if (timeoutMs > 0) {
		// 2) Bestehenden Timer NUR für diese ID löschen
		if (adapter.resetTimers[id]) {
			clearTimeout(adapter.resetTimers[id]);
		}

		// 3) Neuen Timer für diese ID starten
		adapter.resetTimers[id] = setTimeout(async () => {
			await adapter.setStateAsync(id, { val: false, ack: true });
			delete adapter.resetTimers[id]; // Timer-Referenz nach Ablauf aufräumen
		}, timeoutMs);
	}
}

module.exports = {
	init,
	handleStateChange,
};
