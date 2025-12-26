"use strict";

/**
 * Legt die beiden Ampel-Datenpunkte an.
 * Channel: autodarts.x.status
 * States:
 *  - trafficLightColor (HEX)
 *  - trafficLightState (String)
 *
 * @param {import("@iobroker/adapter-core").Adapter} adapter Adapter-Instanz dieses Autodarts-Adapters
 */
async function init(adapter) {
	const baseId = "status";

	// Channel anlegen
	await adapter.setObjectNotExistsAsync(baseId, {
		type: "channel",
		common: {
			name: "Status",
		},
		native: {},
	});

	// HEX-Farbe
	await adapter.setObjectNotExistsAsync(`${baseId}.trafficLightColor`, {
		type: "state",
		common: {
			name: {
				en: "Traffic light color (HEX)",
				de: "Ampelfarbe (HEX)",
			},
			type: "string",
			role: "value",
			read: true,
			write: false,
			desc: {
				en: "HEX color of the traffic light status",
				de: "HEX-Farbe des Ampelstatus",
			},
		},
		native: {},
	});

	// Text-Status
	await adapter.setObjectNotExistsAsync(`${baseId}.trafficLightState`, {
		type: "state",
		common: {
			name: {
				en: "Traffic light state",
				de: "Ampelstatus",
			},
			type: "string",
			role: "value",
			read: true,
			write: false,
			desc: {
				en: "Green = player may throw, yellow = remove darts, red = board error",
				de: "Grün = Spieler darf werfen, Gelb = Darts entfernen, Rot = Boardfehler",
			},
			states: {
				green: "Player may throw / Spieler darf werfen",
				yellow: "Remove darts / Darts entfernen",
				red: "Board error / Boardfehler",
			},
		},
		native: {},
	});

	// Optional: Initial auf "red" setzen
	await setStatus(adapter, "red");
}

/**
 * Setzt Ampel-Status.
 *
 * @param {import("@iobroker/adapter-core").Adapter} adapter Adapter-Instanz dieses Autodarts-Adapters
 * @param {"green"|"yellow"|"red"} status Gewünschter Ampelstatus (green/yellow/red)
 */
async function setStatus(adapter, status) {
	let colorHex = "#FF0000"; // default rot

	if (status === "green") {
		colorHex = "#00FF00";
	} else if (status === "yellow") {
		colorHex = "#FFFF00";
	} else if (status === "red") {
		colorHex = "#FF0000";
	} else {
		adapter.log.warn(`Unknown traffic light status: ${status}, using red`);
		status = "red";
	}

	const baseId = "status";

	await adapter.setStateAsync(`${baseId}.trafficLightColor`, {
		val: colorHex,
		ack: true,
	});

	await adapter.setStateAsync(`${baseId}.trafficLightState`, {
		val: status,
		ack: true,
	});
}

module.exports = {
	init,
	setStatus,
};
