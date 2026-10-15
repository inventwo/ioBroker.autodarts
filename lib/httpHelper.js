// lib/httpHelper.js
"use strict";

const http = require("node:http");

/**
 * Makes an HTTP request to the Autodarts Board Manager.
 *
 * @param {import("@iobroker/adapter-core").AdapterInstance} adapter Adapter instance
 * @param {string} path API path (e.g., "/api/state")
 * @param {number|{ timeout?: number, method?: string }} [timeoutOrOptions] Timeout in ms (legacy) or options
 * @returns {Promise<string>} Response data as string
 */
function makeRequest(adapter, path, timeoutOrOptions = 1500) {
	let timeout = 1500;
	let method = "GET";

	if (typeof timeoutOrOptions === "number") {
		timeout = timeoutOrOptions;
	} else if (timeoutOrOptions && typeof timeoutOrOptions === "object") {
		timeout = timeoutOrOptions.timeout ?? 1500;
		method = timeoutOrOptions.method || "GET";
	}

	return new Promise((resolve, reject) => {
		let settled = false;

		const options = {
			host: adapter.config.host,
			port: adapter.config.port,
			path: path,
			method: method,
			timeout: timeout,
		};

		const req = http.request(options, res => {
			let data = "";

			res.on("data", chunk => (data += chunk));
			res.on("end", () => {
				if (settled) {
					return;
				}
				settled = true;
				if (res.statusCode && res.statusCode >= 400) {
					reject(new Error(`HTTP ${res.statusCode} for ${method} ${path}`));
					return;
				}
				resolve(data);
			});
		});

		req.on("error", error => {
			if (!settled) {
				settled = true;
				reject(error);
			}
		});

		req.on("timeout", () => {
			if (!settled) {
				settled = true;
				req.destroy();
				reject(new Error("Request timeout"));
			}
		});

		req.end();
	});
}

module.exports = {
	makeRequest,
};
