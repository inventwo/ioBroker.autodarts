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
			name: {
				en: "Current throw",
				de: "Aktueller Wurf",
			},
		},
		native: {},
	});

	await adapter.extendObjectAsync("throw.current", {
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

	await adapter.extendObjectAsync("throw.isTriple", {
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

	await adapter.extendObjectAsync("throw.isBullseye", {
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
	await adapter.extendObjectAsync("throw.isMiss", {
		type: "state",
		common: {
			name: {
				en: "Miss",
				de: "Kein Treffer",
			},
			type: "boolean",
			role: "indicator",
			read: true,
			write: false,
			desc: {
				en: "true if the dart did not hit a valid scoring segment",
				de: "true, wenn der Dart kein gültiges Punktesegment getroffen hat",
			},
		},
		native: {},
	});
	await adapter.extendObjectAsync("throw.isDouble", {
		type: "state",
		common: {
			name: {
				en: "Double hit",
				de: "Doppel getroffen",
			},
			type: "boolean",
			role: "indicator",
			read: true,
			write: false,
			desc: {
				en: "true if the dart hit a double segment",
				de: "true, wenn ein Dart ein Doppel-Segment getroffen hat",
			},
		},
		native: {},
	});
}

/**
 * Aktualisiert die Throw-States für den letzten Dart inkl. Triple/Bull-Flags.
 *
 * @param {import("@iobroker/adapter-core").AdapterInstance} adapter Adapter-Instanz dieses Autodarts-Adapters
 * @param {any} lastDart Letzter Dart aus state.throws
 */
async function updateThrow(adapter, lastDart) {
	// @ts-expect-error - calcScore is a custom method in the Autodarts adapter class
	const score = adapter.calcScore(lastDart);
	const segment = lastDart?.segment?.number || 0;

	// Score-Range aus Adapter übernehmen
	// @ts-expect-error - tripleMinScoreRuntime is a custom property in the Autodarts adapter class
	let minScore = adapter.tripleMinScoreRuntime;
	// @ts-expect-error - tripleMaxScoreRuntime is a custom property in the Autodarts adapter class
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

	await adapter.setStateAsync("throw.current", { val: score, ack: true });

	// Timer für Auto-Reset abbrechen
	// @ts-expect-error - resetTimer is a custom property in the Autodarts adapter class
	if (adapter.resetTimer) {
		// @ts-expect-error - resetTimer is a custom property in the Autodarts adapter class
		clearTimeout(adapter.resetTimer);
		// @ts-expect-error - resetTimer is a custom property in the Autodarts adapter class
		adapter.resetTimer = null;
	}

	await adapter.setStateAsync("throw.isTriple", { val: isTriple, ack: true });
	await adapter.setStateAsync("throw.isDouble", { val: isDouble, ack: true });
	await adapter.setStateAsync("throw.isBullseye", { val: isBullseye, ack: true });
	await adapter.setStateAsync("throw.isMiss", { val: isMiss, ack: true });

	// @ts-expect-error - triggerResetSecRuntime is a custom property in the Autodarts adapter class
	const timeoutMs = (Number(adapter.triggerResetSecRuntime) || 0) * 1000;
	if (timeoutMs > 0) {
		adapter.resetTimer = setTimeout(() => {
			if (isTriple) {
				adapter.setState("throw.isTriple", { val: false, ack: true });
			}
			if (isDouble) {
				adapter.setState("throw.isDouble", { val: false, ack: true });
			}
			if (isBullseye) {
				adapter.setState("throw.isBullseye", { val: false, ack: true });
			}
			if (isMiss) {
				adapter.setState("throw.isMiss", { val: false, ack: true });
			}
			adapter.resetTimer = null;
		}, timeoutMs);
	}
}

module.exports = {
	init,
	updateThrow,
};
