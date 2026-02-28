// lib/httpHelper.js
"use strict";

const http = require("node:http");

/**
 * Makes an HTTP request to the Autodarts Board Manager.
 *
 * @param {import("@iobroker/adapter-core").AdapterInstance} adapter Adapter instance
 * @param {string} path API path (e.g., "/api/state")
 * @param {number} timeout Timeout in milliseconds
 * @returns {Promise<string>} Response data as string
 */
function makeRequest(adapter, path, timeout = 1500) {
	return new Promise((resolve, reject) => {
		let settled = false;

		const options = {
			host: adapter.config.host,
			port: adapter.config.port,
			path: path,
			method: "GET",
			timeout: timeout,
		};

		const req = http.request(options, res => {
			let data = "";

			res.on("data", chunk => (data += chunk));
			res.on("end", () => {
				if (!settled) {
					settled = true;
					resolve(data);
				}
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
