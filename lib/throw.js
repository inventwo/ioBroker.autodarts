/* eslint-disable jsdoc/require-param-description */
// lib/throw.js
"use strict";

/**
 * Legt Throw-Channel und States an.
 *
 * @param {import("@iobroker/adapter-core").AdapterInstance} adapter Adapter-Instanz dieses Autodarts-Adapters
 */
async function init(adapter) {
	await adapter.extendObjectAsync("throw", {
		type: "channel",
		common: {
			name: { en: "Current throw", de: "Aktueller Wurf" },
		},
		native: {},
	});

	await adapter.extendObjectAsync("throw.current", {
		type: "state",
		common: {
			name: { en: "Current dart score", de: "Punkte aktueller Dart" },
			type: "number",
			role: "value",
			read: true,
			write: false,
		},
		native: {},
	});

	await adapter.extendObjectAsync("trigger.isTriple", {
		type: "state",
		common: {
			name: { en: "Triple (trigger from Board)", de: "Triple (Trigger vom Board)" },
			type: "boolean",
			role: "indicator",
			read: true,
			write: false,
		},
		native: {},
	});

	await adapter.extendObjectAsync("trigger.isBullseye", {
		type: "state",
		common: {
			name: { en: "Bullseye (trigger from Board)", de: "Bullseye (Trigger vom Board)" },
			type: "boolean",
			role: "indicator",
			read: true,
			write: false,
		},
		native: {},
	});

	await adapter.extendObjectAsync("trigger.isMiss", {
		type: "state",
		common: {
			name: { en: "Miss (trigger from Board)", de: "Miss (Trigger vom Board)" },
			type: "boolean",
			role: "indicator",
			read: true,
			write: false,
		},
		native: {},
	});

	await adapter.extendObjectAsync("trigger.isDouble", {
		type: "state",
		common: {
			name: { en: "Double (trigger from Board)", de: "Doppel (Trigger vom Board)" },
			type: "boolean",
			role: "indicator",
			read: true,
			write: false,
		},
		native: {},
	});
}

/**
 * Aktualisiert die Throw-States für den letzten Dart inkl. Triple/Bull-Flags.
 *
 * @param {import("@iobroker/adapter-core").AdapterInstance} adapter
 * @param {any} lastDart
 */
async function updateThrow(adapter, lastDart) {
	// @ts-expect-error adapter has custom method calcScore
	const score = adapter.calcScore(lastDart);
	const segment = lastDart?.segment?.number || 0;

	// Score-Range aus Adapter übernehmen
	// @ts-expect-error adapter has custom prop tripleMinScoreRuntime
	let minScore = adapter.tripleMinScoreRuntime;
	// @ts-expect-error adapter has custom prop tripleMaxScoreRuntime
	let maxScore = adapter.tripleMaxScoreRuntime;

	if (!Number.isFinite(minScore)) {
		minScore = Number(adapter.config.tripleMinScore) || 1;
	}
	if (!Number.isFinite(maxScore)) {
		maxScore = Number(adapter.config.tripleMaxScore) || 20;
	}

	if (minScore > maxScore) {
		const tmp = minScore;
		minScore = maxScore;
		maxScore = tmp;
	}

	const isTriple =
		!!lastDart?.segment && lastDart.segment.multiplier === 3 && segment >= minScore && segment <= maxScore;
	const isDouble = !!lastDart?.segment && lastDart.segment.multiplier === 2;
	const segName = (lastDart?.segment?.name || "").toUpperCase();
	const isBullseye = segName.includes("BULL") || lastDart?.segment?.number === 25;
	const isMiss = !lastDart?.segment || score === 0;

	await adapter.setState("throw.current", { val: score, ack: true });

	// 1. Alten Timer für Auto-Reset abbrechen
	if (adapter.resetTimers["throw"]) {
		clearTimeout(adapter.resetTimers["throw"]);
		delete adapter.resetTimers["throw"];
	}

	// 2. States auf die neuen Werte setzen
	await adapter.setState("trigger.isTriple", { val: isTriple, ack: true });
	await adapter.setState("trigger.isDouble", { val: isDouble, ack: true });
	await adapter.setState("trigger.isBullseye", { val: isBullseye, ack: true });
	await adapter.setState("trigger.isMiss", { val: isMiss, ack: true });

	// 3. Neuen Reset-Timer setzen
	// @ts-expect-error adapter has custom prop triggerResetSecRuntime
	const timeoutMs = (Number(adapter.triggerResetSecRuntime) || 0) * 1000;

	if (timeoutMs > 0) {
		adapter.resetTimers["throw"] = setTimeout(async () => {
			if (isTriple) {
				await adapter.setState("trigger.isTriple", { val: false, ack: true });
			}
			if (isDouble) {
				await adapter.setState("trigger.isDouble", { val: false, ack: true });
			}
			if (isBullseye) {
				await adapter.setState("trigger.isBullseye", { val: false, ack: true });
			}
			if (isMiss) {
				await adapter.setState("trigger.isMiss", { val: false, ack: true });
			}

			delete adapter.resetTimers["throw"];
		}, timeoutMs);
	}
}

module.exports = { init, updateThrow };
