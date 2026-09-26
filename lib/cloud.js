// lib/cloud.js
"use strict";

/* eslint-disable jsdoc/require-param-description, jsdoc/require-returns-description, jsdoc/require-jsdoc */

const https = require("node:https");
const { URL } = require("node:url");

const AUTH_BASE = "https://api.autodarts.com/auth/v1";
const MS_BASE = "https://play.ws.autodarts.com/ms/v0";
const CLIENT_ID = "autodarts-play";
const CHANNEL_BOARDS = "autodarts.boards";
const CHANNEL_MATCHES = "autodarts.matches";

/**
 * HTTPS JSON helper (POST/GET).
 *
 * @param {string} urlString
 * @param {{ method?: string, headers?: Record<string, string>, body?: object|null }} options
 * @returns {Promise<object>}
 */
function requestJson(urlString, options = {}) {
	const method = options.method || "GET";
	const headers = { Accept: "application/json", ...(options.headers || {}) };
	let body = null;
	if (options.body != null) {
		body = JSON.stringify(options.body);
		headers["Content-Type"] = "application/json";
		headers["Content-Length"] = Buffer.byteLength(body);
	}

	return new Promise((resolve, reject) => {
		const url = new URL(urlString);
		const req = https.request(
			{
				hostname: url.hostname,
				port: url.port || 443,
				path: `${url.pathname}${url.search}`,
				method,
				headers,
				timeout: 15000,
			},
			res => {
				let data = "";
				res.on("data", chunk => (data += chunk));
				res.on("end", () => {
					let parsed = null;
					try {
						parsed = data ? JSON.parse(data) : {};
					} catch {
						reject(new Error(`Invalid JSON from ${url.pathname}: ${data.substring(0, 120)}`));
						return;
					}
					if (res.statusCode && res.statusCode >= 400) {
						const msg =
							parsed?.error?.message ||
							parsed?.message ||
							parsed?.error_description ||
							`HTTP ${res.statusCode}`;
						const err = new Error(msg);
						err.statusCode = res.statusCode;
						err.payload = parsed;
						reject(err);
						return;
					}
					resolve(parsed);
				});
			},
		);
		req.on("error", reject);
		req.on("timeout", () => {
			req.destroy();
			reject(new Error("Request timeout"));
		});
		if (body) {
			req.write(body);
		}
		req.end();
	});
}

/**
 * Map Autodarts match turn throws into local board-state throw objects.
 *
 * @param {object} matchState Match `.state` payload
 * @returns {object[]|null}
 */
function extractThrowsFromMatchState(matchState) {
	if (!matchState || typeof matchState !== "object") {
		return null;
	}

	const turns = matchState.turns;
	if (Array.isArray(turns) && turns.length > 0) {
		const lastTurn = turns[turns.length - 1];
		if (Array.isArray(lastTurn?.throws)) {
			return lastTurn.throws;
		}
	}

	if (turns && typeof turns === "object" && Array.isArray(turns.throws)) {
		return turns.throws;
	}

	return null;
}

/**
 * Normalize board / match payloads into the local `/api/state` shape.
 *
 * @param {object} data Raw cloud message data
 * @param {string} [topic] Subscription topic
 * @returns {{ status?: string, event?: string, throws?: object[], connected?: boolean, running?: boolean, numThrows?: number }|null}
 */
function normalizeCloudState(data, topic) {
	if (!data || typeof data !== "object") {
		return null;
	}

	// Board state stream often mirrors local /api/state
	if (
		Object.prototype.hasOwnProperty.call(data, "throws") ||
		Object.prototype.hasOwnProperty.call(data, "numThrows") ||
		Object.prototype.hasOwnProperty.call(data, "status")
	) {
		return {
			connected: data.connected,
			running: data.running,
			status: data.status,
			event: data.event,
			numThrows: data.numThrows,
			throws: Array.isArray(data.throws) ? data.throws : [],
		};
	}

	// Board event envelope: { event: "Throw detected", ... }
	if (typeof data.event === "string" && !topic?.endsWith(".state")) {
		const mapped = {
			event: data.event,
			status: undefined,
			throws: Array.isArray(data.throws) ? data.throws : undefined,
		};
		const ev = data.event.toLowerCase();
		if (ev.includes("takeout")) {
			mapped.status = "Takeout";
		} else if (ev.includes("throw") || ev.includes("reset") || ev.includes("started")) {
			mapped.status = "Throw";
		} else if (ev.includes("stopped")) {
			mapped.status = "Stopped";
		}
		return mapped;
	}

	// Match state: turns[].throws
	const matchThrows = extractThrowsFromMatchState(data);
	if (matchThrows) {
		return {
			status: "Throw",
			event: matchThrows.length ? "Throw detected" : data.event,
			throws: matchThrows,
			numThrows: matchThrows.length,
		};
	}

	return null;
}

/**
 * Cloud client for Autodarts v2 (auth + message bus).
 */
class CloudClient {
	/**
	 * @param {import("@iobroker/adapter-core").AdapterInstance} adapter
	 */
	constructor(adapter) {
		this.adapter = adapter;
		this.accessToken = null;
		this.refreshToken = null;
		this.tokenExpiresAt = 0;
		this.ws = null;
		this.stopped = false;
		this.reconnectTimer = null;
		this.refreshTimer = null;
		this.currentMatchId = null;
		this.reconnectDelayMs = 3000;
	}

	/**
	 * Start authentication and WebSocket.
	 */
	async start() {
		this.stopped = false;
		await this.login();
		await this.connectWs();
	}

	/**
	 * Stop timers and WebSocket.
	 */
	stop() {
		this.stopped = true;
		if (this.reconnectTimer) {
			this.adapter.clearTimeout(this.reconnectTimer);
			this.reconnectTimer = null;
		}
		if (this.refreshTimer) {
			this.adapter.clearTimeout(this.refreshTimer);
			this.refreshTimer = null;
		}
		if (this.ws) {
			try {
				this.ws.close();
			} catch {
				// ignore
			}
			this.ws = null;
		}
	}

	/**
	 * Login with email/password.
	 */
	async login() {
		const username = String(this.adapter.config.cloudEmail || "").trim();
		const password = String(this.adapter.config.cloudPassword || "");
		if (!username || !password) {
			throw new Error("Cloud mode requires email and password");
		}

		const token = await requestJson(`${AUTH_BASE}/login`, {
			method: "POST",
			body: {
				username,
				password,
				client_id: CLIENT_ID,
			},
		});

		this.applyToken(token);
		this.adapter.log.info("Autodarts cloud login successful");
	}

	/**
	 * Refresh access token.
	 */
	async refreshAccessToken() {
		if (!this.refreshToken) {
			await this.login();
			return;
		}
		try {
			const token = await requestJson(`${AUTH_BASE}/refresh`, {
				method: "POST",
				body: {
					refresh_token: this.refreshToken,
					client_id: CLIENT_ID,
				},
			});
			this.applyToken(token);
			this.adapter.log.debug("Autodarts cloud token refreshed");
		} catch (err) {
			this.adapter.log.warn(`Cloud token refresh failed, re-login: ${err.message}`);
			await this.login();
		}
	}

	/**
	 * @param {object} token
	 */
	applyToken(token) {
		this.accessToken = token.access_token;
		this.refreshToken = token.refresh_token || this.refreshToken;
		const expiresIn = Number(token.expires_in) || 900;
		this.tokenExpiresAt = Date.now() + expiresIn * 1000;
		this.scheduleRefresh(expiresIn);
	}

	/**
	 * @param {number} expiresInSec
	 */
	scheduleRefresh(expiresInSec) {
		if (this.refreshTimer) {
			this.adapter.clearTimeout(this.refreshTimer);
		}
		const delay = Math.max(30_000, Math.floor(expiresInSec * 0.8) * 1000);
		this.refreshTimer = this.adapter.setTimeout(() => {
			this.refreshAccessToken().catch(err => {
				this.adapter.log.error(`Cloud token refresh error: ${err.message}`);
			});
		}, delay);
	}

	/**
	 * Ensure access token is still valid.
	 */
	async ensureToken() {
		if (!this.accessToken || Date.now() > this.tokenExpiresAt - 60_000) {
			await this.refreshAccessToken();
		}
	}

	/**
	 * Request a short-lived WS ticket.
	 *
	 * @returns {Promise<string|null>}
	 */
	async fetchTicket() {
		await this.ensureToken();
		try {
			const data = await requestJson(`${MS_BASE}/tickets`, {
				method: "POST",
				headers: {
					Authorization: `Bearer ${this.accessToken}`,
				},
			});
			return data.code || null;
		} catch (err) {
			this.adapter.log.debug(`Cloud WS ticket request failed: ${err.message}`);
			return null;
		}
	}

	/**
	 * Open message-bus WebSocket.
	 */
	async connectWs() {
		if (this.stopped) {
			return;
		}

		await this.ensureToken();
		const boardId = String(this.adapter.config.boardId || "").trim();
		if (!boardId) {
			throw new Error("Cloud mode requires board ID");
		}

		const code = await this.fetchTicket();
		let wsUrl = `${MS_BASE.replace("https://", "wss://")}/subscribe`;
		if (code) {
			wsUrl += `?code=${encodeURIComponent(code)}`;
		}

		this.adapter.log.info("Connecting to Autodarts cloud message bus");
		const ws = new WebSocket(wsUrl);
		this.ws = ws;

		ws.addEventListener("open", () => {
			this.reconnectDelayMs = 3000;
			this.adapter.log.info("Autodarts cloud WebSocket connected");
			this.setOnline(true);
			this.send({
				type: "subscribe",
				channel: CHANNEL_BOARDS,
				topic: `${boardId}.events`,
			});
			this.send({
				type: "subscribe",
				channel: CHANNEL_BOARDS,
				topic: `${boardId}.state`,
			});
			this.send({
				type: "subscribe",
				channel: CHANNEL_BOARDS,
				topic: `${boardId}.matches`,
			});
		});

		ws.addEventListener("message", event => {
			this.handleMessage(String(event.data || "")).catch(err => {
				this.adapter.log.debug(`Cloud message handling error: ${err.message}`);
			});
		});

		ws.addEventListener("close", () => {
			this.ws = null;
			if (this.stopped) {
				return;
			}
			this.adapter.log.warn("Autodarts cloud WebSocket closed, reconnecting…");
			this.setOnline(false);
			this.scheduleReconnect();
		});

		ws.addEventListener("error", () => {
			this.adapter.log.warn("Autodarts cloud WebSocket error");
		});
	}

	scheduleReconnect() {
		if (this.stopped || this.reconnectTimer) {
			return;
		}
		const delay = this.reconnectDelayMs;
		this.reconnectDelayMs = Math.min(this.reconnectDelayMs * 2, 60_000);
		this.reconnectTimer = this.adapter.setTimeout(() => {
			this.reconnectTimer = null;
			this.connectWs().catch(err => {
				this.adapter.log.error(`Cloud reconnect failed: ${err.message}`);
				this.scheduleReconnect();
			});
		}, delay);
	}

	/**
	 * @param {object} payload
	 */
	send(payload) {
		if (this.ws && this.ws.readyState === WebSocket.OPEN) {
			this.ws.send(JSON.stringify(payload));
		}
	}

	/**
	 * @param {boolean} online
	 */
	async setOnline(online) {
		this.adapter.isConnected = online;
		this.adapter.offline = !online;
		await this.adapter.setState("online", online, true);
		await this.adapter.setState("info.connection", online, true);
		if (!online) {
			const trafficLight = require("./trafficLight");
			await trafficLight.setStatus(this.adapter, "red");
			await this.adapter.setState("status.boardStatus", { val: "offline", ack: true });
		}
	}

	/**
	 * @param {string} raw
	 */
	async handleMessage(raw) {
		let msg;
		try {
			msg = JSON.parse(raw);
		} catch {
			return;
		}
		if (!msg || msg.type === "error") {
			return;
		}

		const channel = msg.channel;
		const topic = msg.topic || "";
		const data = msg.data;

		if (channel === CHANNEL_BOARDS && topic.endsWith(".matches")) {
			await this.handleBoardMatchEvent(data);
			return;
		}

		const normalized = normalizeCloudState(data, topic);
		if (!normalized) {
			return;
		}

		await this.adapter.processBoardState(normalized);
	}

	/**
	 * @param {object} data
	 */
	async handleBoardMatchEvent(data) {
		if (!data || typeof data !== "object") {
			return;
		}
		const event = data.event;
		const matchId = data.id;
		if (event === "start" && matchId) {
			if (this.currentMatchId && this.currentMatchId !== matchId) {
				this.send({
					type: "unsubscribe",
					channel: CHANNEL_MATCHES,
					topic: `${this.currentMatchId}.state`,
				});
			}
			this.currentMatchId = matchId;
			this.send({
				type: "subscribe",
				channel: CHANNEL_MATCHES,
				topic: `${matchId}.state`,
			});
			this.adapter.log.info(`Subscribed to Autodarts match ${matchId}`);
		} else if ((event === "finish" || event === "delete") && matchId) {
			this.send({
				type: "unsubscribe",
				channel: CHANNEL_MATCHES,
				topic: `${matchId}.state`,
			});
			if (this.currentMatchId === matchId) {
				this.currentMatchId = null;
			}
		}
	}
}

module.exports = {
	CloudClient,
	normalizeCloudState,
	extractThrowsFromMatchState,
	CLIENT_ID,
	AUTH_BASE,
	MS_BASE,
};
