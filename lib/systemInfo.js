/* eslint-disable jsdoc/require-param-description */
// lib/systemInfo.js
"use strict";

const httpHelper = require("./httpHelper");

/**
 * Initialisiert System-Information States (Channels und untergeordnete States).
 *
 * @param {import("@iobroker/adapter-core").AdapterInstance} adapter
 */
async function init(adapter) {
	// System-Channel und Unter-Channels
	await adapter.extendObjectAsync("system", {
		type: "channel",
		common: {
			name: {
				en: "Information about the system",
				de: "Informationen zum System",
			},
		},
		native: {},
	});

	await adapter.extendObjectAsync("system.hardware", {
		type: "channel",
		common: {
			name: {
				en: "Hardware",
				de: "Hardware",
			},
		},
		native: {},
	});

	await adapter.extendObjectAsync("system.software", {
		type: "channel",
		common: {
			name: {
				en: "Software",
				de: "Software",
			},
		},
		native: {},
	});

	await adapter.extendObjectAsync("system.cams", {
		type: "channel",
		common: {
			name: {
				en: "Camera configuration",
				de: "Kamera-Konfiguration",
			},
		},
		native: {},
	});

	// Software-Infos
	await adapter.extendObjectAsync("system.software.desktopVersion", {
		type: "state",
		common: {
			name: {
				en: "Desktop version",
				de: "Desktop-Version",
			},
			type: "string",
			role: "info.version",
			read: true,
			write: false,
			desc: {
				en: "Version of the Autodarts desktop application",
				de: "Version der Autodarts Desktop-Anwendung",
			},
		},
		native: {},
	});

	await adapter.extendObjectAsync("system.software.boardVersion", {
		type: "state",
		common: {
			name: {
				en: "Board manager version",
				de: "Version des Board-Manager",
			},
			type: "string",
			role: "info.version",
			read: true,
			write: false,
			desc: {
				en: "Version of the board manager",
				de: "Version des Board-Manager",
			},
		},
		native: {},
	});

	await adapter.extendObjectAsync("system.software.platform", {
		type: "state",
		common: {
			name: {
				en: "Platform",
				de: "Plattform",
			},
			type: "string",
			role: "info.name",
			read: true,
			write: false,
			desc: {
				en: "Operating system platform",
				de: "Betriebssystem-Plattform",
			},
		},
		native: {},
	});

	await adapter.extendObjectAsync("system.software.os", {
		type: "state",
		common: {
			name: {
				en: "Operating system",
				de: "Betriebssystem",
			},
			type: "string",
			role: "info.name",
			read: true,
			write: false,
			desc: {
				en: "Operating system name as reported by Autodarts host",
				de: "Vom Autodarts-Host gemeldetes Betriebssystem",
			},
		},
		native: {},
	});

	// Hardware-Infos
	await adapter.extendObjectAsync("system.hardware.kernelArch", {
		type: "state",
		common: {
			name: {
				en: "Kernel architecture",
				de: "Kernel-Architektur",
			},
			type: "string",
			role: "info.name",
			read: true,
			write: false,
			desc: {
				en: "System kernel architecture (e.g., x86_64, arm64)",
				de: "System-Kernel-Architektur (z.B. x86_64, arm64)",
			},
		},
		native: {},
	});

	await adapter.extendObjectAsync("system.hardware.cpuModel", {
		type: "state",
		common: {
			name: {
				en: "CPU model",
				de: "CPU-Modell",
			},
			type: "string",
			role: "info.name",
			read: true,
			write: false,
			desc: {
				en: "CPU model name",
				de: "CPU-Modellbezeichnung",
			},
		},
		native: {},
	});

	await adapter.extendObjectAsync("system.hardware.hostname", {
		type: "state",
		common: {
			name: {
				en: "Hostname",
				de: "Hostname",
			},
			type: "string",
			role: "info.name",
			read: true,
			write: false,
			desc: {
				en: "Hostname of the Autodarts system",
				de: "Hostname des Autodarts-Systems",
			},
		},
		native: {},
	});

	// LED State anlegen
	await adapter.extendObjectAsync("system.hardware.light", {
		type: "state",
		common: {
			name: { en: "Board light", de: "Board-Beleuchtung" },
			type: "boolean",
			role: "switch.light",
			read: true,
			write: true,
		},
		native: {},
	});

	// POWER State anlegen
	await adapter.extendObjectAsync("system.hardware.power", {
		type: "state",
		common: {
			name: { en: "Board power", de: "Board-Strom" },
			type: "boolean",
			role: "switch.power",
			read: true,
			write: true,
		},
		native: {},
	});

	// Kamera-Infos als JSON-States
	await adapter.extendObjectAsync("system.cams.cam0", {
		type: "state",
		common: {
			name: {
				en: "Camera 0 config",
				de: "Kamera 0 Konfiguration",
			},
			type: "string",
			role: "json",
			read: true,
			write: false,
			desc: {
				en: "JSON with camera 0 parameters (width, height, fps)",
				de: "JSON mit Kamera-0-Parametern (width, height, fps)",
			},
		},
		native: {},
	});

	await adapter.extendObjectAsync("system.cams.cam1", {
		type: "state",
		common: {
			name: {
				en: "Camera 1 config",
				de: "Kamera 1 Konfiguration",
			},
			type: "string",
			role: "json",
			read: true,
			write: false,
			desc: {
				en: "JSON with camera 1 parameters (width, height, fps)",
				de: "JSON mit Kamera-1-Parametern (width, height, fps)",
			},
		},
		native: {},
	});

	await adapter.extendObjectAsync("system.cams.cam2", {
		type: "state",
		common: {
			name: {
				en: "Camera 2 config",
				de: "Kamera 2 Konfiguration",
			},
			type: "string",
			role: "json",
			read: true,
			write: false,
			desc: {
				en: "JSON with camera 2 parameters (width, height, fps)",
				de: "JSON mit Kamera-2-Parametern (width, height, fps)",
			},
		},
		native: {},
	});
}

/**
 * Host-Informationen abfragen und in States schreiben.
 *
 * @param {import("@iobroker/adapter-core").AdapterInstance} adapter
 */
async function fetchHost(adapter) {
	try {
		const data = await httpHelper.makeRequest(adapter, "/api/host");
		const host = JSON.parse(data);

		// clientVersion als boardVersion schreiben
		await adapter.setState("system.software.boardVersion", {
			val: host.clientVersion || "",
			ack: true,
		});
		// desktopVersion
		await adapter.setState("system.software.desktopVersion", {
			val: host.desktopVersion || "",
			ack: true,
		});
		// platform
		await adapter.setState("system.software.platform", {
			val: host.platform || "",
			ack: true,
		});
		// os (Software)
		await adapter.setState("system.software.os", {
			val: host.os || "",
			ack: true,
		});
		// kernelArch
		await adapter.setState("system.hardware.kernelArch", {
			val: host.kernelArch || "",
			ack: true,
		});
		// cpuModel (aus cpu.model)
		await adapter.setState("system.hardware.cpuModel", {
			val: host.cpu?.model || "",
			ack: true,
		});
		// hostname (Hardware)
		await adapter.setState("system.hardware.hostname", {
			val: host.hostname || "",
			ack: true,
		});
	} catch (error) {
		if (error && typeof error === "object" && typeof error.message === "string" && error.message.includes("JSON")) {
			adapter.log.debug(`Could not parse host info: ${error.message}`);
		}
	}
}

/**
 * Board-Konfiguration abfragen (Kameras) und in States schreiben.
 *
 * @param {import("@iobroker/adapter-core").AdapterInstance} adapter
 */
async function fetchConfig(adapter) {
	try {
		const data = await httpHelper.makeRequest(adapter, "/api/config");
		const cfg = JSON.parse(data);

		const cam = cfg.cam || {};
		const camInfo = {
			width: cam.width ?? 1280,
			height: cam.height ?? 720,
			fps: cam.fps ?? 20,
		};

		const json = JSON.stringify(camInfo);

		await adapter.setState("system.cams.cam0", { val: json, ack: true });
		await adapter.setState("system.cams.cam1", { val: json, ack: true });
		await adapter.setState("system.cams.cam2", { val: json, ack: true });
	} catch (error) {
		if (error && typeof error === "object" && typeof error.message === "string" && error.message.includes("JSON")) {
			adapter.log.debug(`Could not parse camera config: ${error.message}`);
		}
	}
}

module.exports = {
	init,
	fetchHost,
	fetchConfig,
};
