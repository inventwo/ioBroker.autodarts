"use strict";

const { expect } = require("chai");
const { normalizeCloudState, extractThrowsFromMatchState } = require("./lib/cloud");

describe("lib/cloud.js => cloud state mapping", () => {
	it("should pass through local-style board state with throws", () => {
		const normalized = normalizeCloudState({
			connected: true,
			running: true,
			status: "Throw",
			event: "Throw detected",
			numThrows: 2,
			throws: [
				{ segment: { name: "T20", number: 20, multiplier: 3, bed: "Triple" } },
				{ segment: { name: "S18", number: 18, multiplier: 1, bed: "SingleOuter" } },
			],
		});

		expect(normalized).to.deep.include({
			status: "Throw",
			event: "Throw detected",
			numThrows: 2,
		});
		expect(normalized.throws).to.have.length(2);
		expect(normalized.throws[1].segment.name).to.equal("S18");
	});

	it("should map board event envelopes to status", () => {
		const takeout = normalizeCloudState({ event: "Takeout started" }, "board.events");
		expect(takeout.status).to.equal("Takeout");
		expect(takeout.event).to.equal("Takeout started");

		const thrown = normalizeCloudState({ event: "Throw detected" }, "board.events");
		expect(thrown.status).to.equal("Throw");
	});

	it("should extract throws from match state turns array", () => {
		const matchState = {
			turns: [
				{
					throws: [{ segment: { name: "T20", number: 20, multiplier: 3 } }],
				},
				{
					throws: [
						{ segment: { name: "S20", number: 20, multiplier: 1 } },
						{ segment: { name: "S18", number: 18, multiplier: 1 } },
					],
				},
			],
		};

		const throws = extractThrowsFromMatchState(matchState);
		expect(throws).to.have.length(2);
		expect(throws[0].segment.name).to.equal("S20");

		const normalized = normalizeCloudState(matchState, "match-id.state");
		expect(normalized.throws).to.have.length(2);
		expect(normalized.numThrows).to.equal(2);
		expect(normalized.event).to.equal("Throw detected");
	});

	it("should extract throws from match state turns object", () => {
		const throws = extractThrowsFromMatchState({
			turns: {
				throws: [{ segment: { name: "D16", number: 16, multiplier: 2 } }],
			},
		});
		expect(throws).to.have.length(1);
		expect(throws[0].segment.name).to.equal("D16");
	});

	it("should return null for unrelated payloads", () => {
		expect(normalizeCloudState(null)).to.equal(null);
		expect(normalizeCloudState({ foo: "bar" })).to.equal(null);
		expect(extractThrowsFromMatchState({})).to.equal(null);
	});
});
