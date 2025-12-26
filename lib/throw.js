// lib/throw.js
"use strict";

/**
 * Legt Throw-Channel und States an.
 *
 * @param {import("@iobroker/adapter-core").Adapter} adapter Adapter-Instanz dieses Autodarts-Adapters
 */
async function init(adapter) {
	await adapter.setObjectNotExistsAsync("throw", {
		type: "channel",
		common: {
			name: {
				en: "Current throw",
				de: "Aktueller Wurf",
			},
		},
		native: {},
	});

	await adapter.setObjectNotExistsAsync("throw.current", {
		type: "state",
		common: {
			name: {
				en: "Current dart score",
				de: "Punkte aktueller Dart",
			},
			type: "number",
			role: "value",
			read: true,
			write: false,
			desc: {
				en: "Score of the last dart",
				de: "Punktzahl des letzten Dart",
			},
		},
		native: {},
	});

	await adapter.setObjectNotExistsAsync("throw.isTriple", {
		type: "state",
		common: {
			name: {
				en: "Triple hit",
				de: "Triple getroffen",
			},
			type: "boolean",
			role: "indicator",
			read: true,
			write: false,
			desc: {
				en: "true if the dart hit a triple segment (and passes score range)",
				de: "true, wenn ein Dart ein Triple-Segment getroffen hat (und innerhalb der Punkterange liegt)",
			},
		},
		native: {},
	});

	await adapter.setObjectNotExistsAsync("throw.isBullseye", {
		type: "state",
		common: {
			name: {
				en: "Bullseye hit",
				de: "Bullseye getroffen",
			},
			type: "boolean",
			role: "indicator",
			read: true,
			write: false,
			desc: {
				en: "true if the dart hit the bull or bullseye",
				de: "true, wenn ein Dart Bull oder Bullseye getroffen hat",
			},
		},
		native: {},
	});
}

/**
 * Aktualisiert die Throw-States für den letzten Dart inkl. Triple/Bull-Flags.
 *
 * @param {import("@iobroker/adapter-core").Adapter} adapter Adapter-Instanz dieses Autodarts-Adapters
 * @param {any} lastDart Letzter Dart aus state.throws
 */
async function updateThrow(adapter, lastDart) {
	const score = adapter.calcScore(lastDart);
	const segment = lastDart?.segment?.number || 0;

	// Score-Range aus Adapter übernehmen
	let minScore = adapter.tripleMinScoreRuntime;
	let maxScore = adapter.tripleMaxScoreRuntime;

	if (!Number.isFinite(minScore)) {
		// @ts-expect-error tripleMinScore is defined in io-package.json but not in AdapterConfig
		minScore = Number(adapter.config.tripleMinScore) || 1;
	}
	if (!Number.isFinite(maxScore)) {
		// @ts-expect-error tripleMaxScore is defined in io-package.json but not in AdapterConfig
		maxScore = Number(adapter.config.tripleMaxScore) || 20;
	}

	if (minScore > maxScore) {
		const tmp = minScore;
		minScore = maxScore;
		maxScore = tmp;
	}

	const isTriple =
		!!lastDart?.segment && lastDart.segment.multiplier === 3 && segment >= minScore && segment <= maxScore;

	const segName = (lastDart?.segment?.name || "").toUpperCase();
	const isBullseye = segName.includes("BULL") || lastDart?.segment?.number === 25;

	await adapter.setStateAsync("throw.current", { val: score, ack: true });

	// Timer für Auto-Reset abbrechen
	if (adapter.tripleResetTimer) {
		clearTimeout(adapter.tripleResetTimer);
		adapter.tripleResetTimer = null;
	}
	if (adapter.bullResetTimer) {
		clearTimeout(adapter.bullResetTimer);
		adapter.bullResetTimer = null;
	}

	await adapter.setStateAsync("throw.isTriple", { val: isTriple, ack: true });
	await adapter.setStateAsync("throw.isBullseye", { val: isBullseye, ack: true });

	const timeoutMs = Number(adapter.triggerResetMsRuntime) || 0;
	if (timeoutMs > 0) {
		if (isTriple) {
			adapter.tripleResetTimer = setTimeout(() => {
				adapter.setState("throw.isTriple", { val: false, ack: true });
				adapter.tripleResetTimer = null;
			}, timeoutMs);
		}
		if (isBullseye) {
			adapter.bullResetTimer = setTimeout(() => {
				adapter.setState("throw.isBullseye", { val: false, ack: true });
				adapter.bullResetTimer = null;
			}, timeoutMs);
		}
	}
}

module.exports = {
	init,
	updateThrow,
};
