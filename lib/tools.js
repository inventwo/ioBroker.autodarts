// lib/tools.js
/* eslint-disable jsdoc/require-param-description */
"use strict";

/**
 * Init für Tools-Integration.
 * Legt Tools-Channel, States, Startwerte und Subscription an.
 *
 * @param {import("@iobroker/adapter-core").AdapterInstance} adapter
 */
async function init(adapter) {
	const toolsIpTrimmed = (adapter.config.toolsIp || "").trim();

	if (!toolsIpTrimmed) {
		adapter.log.info("Tools integration disabled: no toolsIp configured");
		return;
	}

	// Tools-Channel anlegen
	await adapter.extendObjectAsync("tools", {
		type: "channel",
		common: {
			name: {
				en: "Tools for Autodarts integration",
				de: "Tools for Autodarts Integration",
			},
		},
		native: {},
	});

	// RAW Input State
	await adapter.extendObjectAsync("tools.RAW", {
		type: "state",
		common: {
			name: {
				en: "RAW event from Tools for Autodarts",
				de: "RAW-Ereignis von Tools for Autodarts",
			},
			type: "string",
			role: "text",
			read: true,
			write: true,
		},
		native: {},
	});

	// Trigger-States für Tools-Events
	await adapter.extendObjectAsync("trigger.isBusted", {
		type: "state",
		common: {
			name: {
				en: "Busted (trigger from tools)",
				de: "Busted (Trigger aus Tools)",
			},
			type: "boolean",
			role: "indicator",
			read: true,
			write: false,
		},
		native: {},
	});

	await adapter.extendObjectAsync("trigger.isGameon", {
		type: "state",
		common: {
			name: {
				en: "Game on (trigger from tools)",
				de: "Game on (Trigger aus Tools)",
			},
			type: "boolean",
			role: "indicator",
			read: true,
			write: false,
		},
		native: {},
	});

	await adapter.extendObjectAsync("trigger.isGameshot", {
		type: "state",
		common: {
			name: {
				en: "Gameshot (trigger from tools)",
				de: "Gameshot (Trigger aus Tools)",
			},
			type: "boolean",
			role: "indicator",
			read: true,
			write: false,
		},
		native: {},
	});

	await adapter.extendObjectAsync("trigger.is180", {
		type: "state",
		common: {
			name: {
				en: "180 (trigger from tools)",
				de: "180 (Trigger aus Tools)",
			},
			type: "boolean",
			role: "indicator",
			read: true,
			write: false,
		},
		native: {},
	});

	await adapter.extendObjectAsync("trigger.isMatchshot", {
		type: "state",
		common: {
			name: {
				en: "Matchshot (trigger from tools)",
				de: "Matchshot (Trigger aus Tools)",
			},
			type: "boolean",
			role: "indicator",
			read: true,
			write: false,
		},
		native: {},
	});

	await adapter.extendObjectAsync("trigger.isTakeout", {
		type: "state",
		common: {
			name: {
				en: "Takeout (trigger from tools)",
				de: "Takeout (Trigger aus Tools)",
			},
			type: "boolean",
			role: "indicator",
			read: true,
			write: false,
		},
		native: {},
	});

	// Tools-Config-Channel für URLs
	await adapter.extendObjectAsync("tools.config", {
		type: "channel",
		common: {
			name: {
				en: "Tools configuration",
				de: "Tools-Konfiguration",
			},
		},
		native: {},
	});

	// URL States
	const urlConfigs = [
		["urlBusted", "Busted"],
		["urlGameon", "Game on"],
		["urlGameshot", "Gameshot"],
		["url180", "180"],
		["urlMatchshot", "Matchshot"],
		["urlTakeout", "Takeout"],
	];

	for (const [id, label] of urlConfigs) {
		await adapter.extendObjectAsync(`tools.config.${id}`, {
			type: "state",
			common: {
				name: {
					en: `URL for ${label}`,
					de: `URL für ${label}`,
				},
				type: "string",
				role: "text.url",
				read: true,
				write: false,
			},
			native: {},
		});
	}

	// Initialzustand setzen
	await adapter.setStateAsync("tools.RAW", { val: "", ack: true });
	await adapter.setStateAsync("trigger.isBusted", { val: false, ack: true });
	await adapter.setStateAsync("trigger.isGameon", { val: false, ack: true });
	await adapter.setStateAsync("trigger.isGameshot", { val: false, ack: true });
	await adapter.setStateAsync("trigger.is180", { val: false, ack: true });
	await adapter.setStateAsync("trigger.isMatchshot", { val: false, ack: true });
	await adapter.setStateAsync("trigger.isTakeout", { val: false, ack: true });

	// URLs aktualisieren
	await updateToolsUrls(adapter);

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
 * @returns {boolean} true, wenn der State verarbeitet wurde
 */
async function handleStateChange(adapter, idShort, state) {
	// Tools-RAW Events
	if (idShort === "tools.RAW") {
		const val = String(state.val || "").toLowerCase();
		const timeoutMs = (adapter.triggerResetSecRuntime || 0) * 1000;

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
		return true;
	}

	// Tools-Konfiguration ändern
	if (idShort === "toolsIp" || idShort === "toolsPort" || idShort === "toolsInstance") {
		const val = state.val;

		if (idShort === "toolsIp") {
			adapter.config.toolsIp = String(val || "");
		} else if (idShort === "toolsPort") {
			adapter.config.toolsPort = Number(val) || 8087;
		} else if (idShort === "toolsInstance") {
			adapter.config.toolsInstance = Number(val) || 0;
		}

		await updateToolsUrls(adapter);
		return true;
	}

	return false;
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

/**
 * Generiert Tools-URLs aus IP, Port und Instanz und schreibt sie in States.
 *
 * @param {import("@iobroker/adapter-core").AdapterInstance} adapter
 */
async function updateToolsUrls(adapter) {
	const ip = (adapter.config.toolsIp || "").trim();
	const port = Number(adapter.config.toolsPort) || 8087;
	const inst = Number(adapter.config.toolsInstance) || 0;

	// Wenn keine IP gesetzt ist: URLs leeren
	if (!ip) {
		await adapter.setStateAsync("tools.config.urlBusted", { val: "", ack: true });
		await adapter.setStateAsync("tools.config.urlGameon", { val: "", ack: true });
		await adapter.setStateAsync("tools.config.urlGameshot", { val: "", ack: true });
		await adapter.setStateAsync("tools.config.url180", { val: "", ack: true });
		await adapter.setStateAsync("tools.config.urlMatchshot", { val: "", ack: true });
		await adapter.setStateAsync("tools.config.urlTakeout", { val: "", ack: true });
		return;
	}

	const base = `http://${ip}:${port}`;
	const id = `autodarts.${inst}`;

	const urlBusted = `${base}/set/${id}.tools.RAW?value=busted`;
	const urlGameon = `${base}/set/${id}.tools.RAW?value=gameon`;
	const urlGameshot = `${base}/set/${id}.tools.RAW?value=gameshot`;
	const url180 = `${base}/set/${id}.tools.RAW?value=180`;
	const urlMatchshot = `${base}/set/${id}.tools.RAW?value=matchshot`;
	const urlTakeout = `${base}/set/${id}.tools.RAW?value=takeout`;

	await adapter.setStateAsync("tools.config.urlBusted", { val: urlBusted, ack: true });
	await adapter.setStateAsync("tools.config.urlGameon", { val: urlGameon, ack: true });
	await adapter.setStateAsync("tools.config.urlGameshot", { val: urlGameshot, ack: true });
	await adapter.setStateAsync("tools.config.url180", { val: url180, ack: true });
	await adapter.setStateAsync("tools.config.urlMatchshot", { val: urlMatchshot, ack: true });
	await adapter.setStateAsync("tools.config.urlTakeout", { val: urlTakeout, ack: true });

	adapter.log.debug(
		`Updated Tools URLs: ${urlBusted}, ${urlGameon}, ${urlGameshot}, ${url180}, ${urlMatchshot}, ${urlTakeout}`,
	);
}

module.exports = {
	init,
	handleStateChange,
	updateToolsUrls,
};
