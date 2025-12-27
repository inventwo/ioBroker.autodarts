// lib/visit.js
"use strict";

/**
 * Legt Visit-Channel und States an.
 *
 * @param {import("@iobroker/adapter-core").AdapterInstance} adapter Adapter-Instanz dieses Autodarts-Adapters
 */
async function init(adapter) {
	await adapter.extendObjectAsync("visit", {
		type: "channel",
		common: {
			name: {
				en: "Current visit",
				de: "Aktuelle Aufnahme",
			},
		},
		native: {},
	});

	await adapter.extendObjectAsync("visit.score", {
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
}

/**
 * Berechnet und schreibt die Visit-Summe, wenn ein Visit abgeschlossen ist.
 *
 * @param {import("@iobroker/adapter-core").AdapterInstance} adapter Adapter-Instanz dieses Autodarts-Adapters
 * @param {any[]} currentThrows Array der aktuellen Würfe aus /api/state
 * @param {number} lastThrowsCount Anzahl Würfe beim letzten Poll (adapter.lastThrowsCount)
 * @returns {Promise<number>} Neue lastThrowsCount, damit du ihn im Adapter speichern kannst
 */
async function updateVisit(adapter, currentThrows, lastThrowsCount) {
	const currentCount = currentThrows.length;

	// Nur schreiben, wenn:
	// - genau 3 Darts geworfen wurden
	// - vorher weniger als 3 waren (Visit gerade abgeschlossen)
	if (currentCount === 3 && lastThrowsCount < 3) {
		const lastThree = currentThrows.slice(-3);
		// @ts-expect-error - calcScore is a custom method in the Autodarts adapter class
		const visitSum = lastThree.reduce((sum, dart) => sum + adapter.calcScore(dart), 0);

		await adapter.setStateAsync("visit.score", { val: visitSum, ack: true });
	}

	return currentCount;
}

module.exports = {
	init,
	updateVisit,
};
