/* global describe, it, before, after */
"use strict";

const { expect } = require("chai");
const http = require("node:http");
const httpHelper = require("./httpHelper");

describe("httpHelper", () => {
	describe("makeRequest", () => {
		let server;
		let port;

		before(done => {
			// Create a test HTTP server
			server = http.createServer((req, res) => {
				if (req.url === "/api/test") {
					res.writeHead(200, { "Content-Type": "text/plain" });
					res.end("test response");
				} else if (req.url === "/api/json") {
					res.writeHead(200, { "Content-Type": "application/json" });
					res.end(JSON.stringify({ status: "ok" }));
				} else if (req.url === "/api/timeout") {
					// Don't respond - let it timeout
					return;
				} else if (req.url === "/api/error") {
					req.socket.destroy();
				} else {
					res.writeHead(404);
					res.end("Not found");
				}
			});

			server.listen(0, "127.0.0.1", () => {
				port = server.address().port;
				done();
			});
		});

		after(done => {
			if (server) {
				server.close(done);
			} else {
				done();
			}
		});

		it("should successfully fetch data from a valid endpoint", async () => {
			const mockAdapter = {
				config: {
					host: "127.0.0.1",
					port: port,
				},
			};

			// @ts-expect-error - mockAdapter is a partial mock for testing
			const result = await httpHelper.makeRequest(mockAdapter, "/api/test");
			expect(result).to.equal("test response");
		});

		it("should successfully fetch JSON data", async () => {
			const mockAdapter = {
				config: {
					host: "127.0.0.1",
					port: port,
				},
			};

			// @ts-expect-error - mockAdapter is a partial mock for testing
			const result = await httpHelper.makeRequest(mockAdapter, "/api/json");
			const parsed = JSON.parse(result);
			expect(parsed).to.deep.equal({ status: "ok" });
		});

		it("should reject with timeout error when request times out", async () => {
			const mockAdapter = {
				config: {
					host: "127.0.0.1",
					port: port,
				},
			};

			try {
				// @ts-expect-error - mockAdapter is a partial mock for testing
				await httpHelper.makeRequest(mockAdapter, "/api/timeout", 100);
				expect.fail("Should have thrown timeout error");
			} catch (error) {
				expect(error).to.be.an("error");
				expect(error.message).to.equal("Request timeout");
			}
		});

		it("should reject with error when connection fails", async () => {
			const mockAdapter = {
				config: {
					host: "127.0.0.1",
					port: 99999, // Invalid port
				},
			};

			try {
				// @ts-expect-error - mockAdapter is a partial mock for testing
				await httpHelper.makeRequest(mockAdapter, "/api/test", 100);
				expect.fail("Should have thrown connection error");
			} catch (error) {
				expect(error).to.be.an("error");
				expect(error.code).to.match(/ECONNREFUSED|EADDRNOTAVAIL|ERR_SOCKET_BAD_PORT/);
			}
		});

		it("should handle socket destruction gracefully", async () => {
			const mockAdapter = {
				config: {
					host: "127.0.0.1",
					port: port,
				},
			};

			try {
				// @ts-expect-error - mockAdapter is a partial mock for testing
				await httpHelper.makeRequest(mockAdapter, "/api/error", 100);
				expect.fail("Should have thrown error");
			} catch (error) {
				expect(error).to.be.an("error");
			}
		});

		it("should use custom timeout value", async () => {
			const mockAdapter = {
				config: {
					host: "127.0.0.1",
					port: port,
				},
			};

			const startTime = Date.now();
			try {
				// @ts-expect-error - mockAdapter is a partial mock for testing
				await httpHelper.makeRequest(mockAdapter, "/api/timeout", 200);
				expect.fail("Should have thrown timeout error");
			} catch (error) {
				const elapsed = Date.now() - startTime;
				expect(error.message).to.equal("Request timeout");
				// Check that timeout happened roughly at the right time (with some tolerance)
				expect(elapsed).to.be.at.least(150);
				expect(elapsed).to.be.at.most(500);
			}
		});

		it("should use default timeout of 1500ms", async () => {
			const mockAdapter = {
				config: {
					host: "127.0.0.1",
					port: port,
				},
			};

			const startTime = Date.now();
			try {
				// @ts-expect-error - mockAdapter is a partial mock for testing
				await httpHelper.makeRequest(mockAdapter, "/api/timeout");
				expect.fail("Should have thrown timeout error");
			} catch (error) {
				const elapsed = Date.now() - startTime;
				expect(error.message).to.equal("Request timeout");
				// Check that default timeout of 1500ms was used (with tolerance)
				expect(elapsed).to.be.at.least(1400);
				expect(elapsed).to.be.at.most(2000);
			}
		});
	});
});
