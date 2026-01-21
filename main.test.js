"use strict";

/**
 * Unit tests for ioBroker Autodarts Adapter
 * Tests core modules and adapter functionality
 */

const { expect } = require("chai");
const sinon = require("sinon");

// Test for throw.js module
describe("lib/throw.js => Throw detection and trigger management", () => {
	let mockAdapter;

	beforeEach(() => {
		mockAdapter = {
			config: {
				tripleMinScore: 1,
				tripleMaxScore: 20,
				triggerResetSec: 0,
			},
			tripleMinScoreRuntime: 1,
			tripleMaxScoreRuntime: 20,
			triggerResetSecRuntime: 0,
			resetTimers: {},
			setStateAsync: sinon.stub().resolves(),
			log: { error: sinon.stub() },
			calcScore: (dart) => {
				if (!dart?.segment) return 0;
				return (dart.segment.number || 0) * (dart.segment.multiplier || 0);
			},
		};
	});

	it("should detect triple correctly", async () => {
		const throwLogic = require("./lib/throw");

		const dart = {
			segment: {
				name: "Triple 20",
				number: 20,
				multiplier: 3,
			},
		};

		await throwLogic.updateThrow(mockAdapter, dart);

		const tripleCall = mockAdapter.setStateAsync.args.find((call) =>
			call[0].includes("trigger.isTriple"),
		);
		expect(tripleCall).to.exist;
		expect(tripleCall[1].val).to.be.true;
	});

	it("should detect bullseye correctly", async () => {
		const throwLogic = require("./lib/throw");

		const dart = {
			segment: {
				name: "Bullseye",
				number: 25,
				multiplier: 2,
			},
		};

		await throwLogic.updateThrow(mockAdapter, dart);

		const bullseyeCall = mockAdapter.setStateAsync.args.find((call) =>
			call[0].includes("trigger.isBullseye"),
		);
		expect(bullseyeCall).to.exist;
		expect(bullseyeCall[1].val).to.be.true;
	});

	it("should detect miss correctly", async () => {
		const throwLogic = require("./lib/throw");

		const dart = {
			segment: null,
		};

		await throwLogic.updateThrow(mockAdapter, dart);

		const missCall = mockAdapter.setStateAsync.args.find((call) =>
			call[0].includes("trigger.isMiss"),
		);
		expect(missCall).to.exist;
		expect(missCall[1].val).to.be.true;
	});

	it("should set throw.current state with score", async () => {
		const throwLogic = require("./lib/throw");

		const dart = {
			segment: {
				name: "Double 20",
				number: 20,
				multiplier: 2,
			},
		};

		await throwLogic.updateThrow(mockAdapter, dart);

		const scoreCall = mockAdapter.setStateAsync.args.find((call) =>
			call[0].includes("throw.current"),
		);
		expect(scoreCall).to.exist;
		expect(scoreCall[1].val).to.equal(40); // 20 * 2
	});
});

// Test for visit.js module
describe("lib/visit.js => Visit tracking (3-dart sequences)", () => {
	let mockAdapter;

	beforeEach(() => {
		mockAdapter = {
			setStateAsync: sinon.stub().resolves(),
			log: { error: sinon.stub() },
			calcScore: (dart) => {
				if (!dart?.segment) return 0;
				return (dart.segment.number || 0) * (dart.segment.multiplier || 0);
			},
		};
	});

	it("should update visit score when 3 darts are thrown", async () => {
		const visit = require("./lib/visit");
		await visit.init(mockAdapter);

		const throws = [
			{ segment: { number: 20, multiplier: 1 } },
			{ segment: { number: 20, multiplier: 1 } },
			{ segment: { number: 20, multiplier: 1 } },
		];

		const newCount = await visit.updateVisit(mockAdapter, throws, 0);

		expect(newCount).to.equal(3);
		const visitCall = mockAdapter.setStateAsync.args.find((call) =>
			call[0].includes("visit.score"),
		);
		expect(visitCall).to.exist;
	});

	it("should handle empty throws array", async () => {
		const visit = require("./lib/visit");

		const throws = [];
		const newCount = await visit.updateVisit(mockAdapter, throws, 0);

		expect(newCount).to.equal(0);
	});
});

// Test for httpHelper.js
describe("lib/httpHelper.js => HTTP requests to Board Manager", () => {
	it("should create a request promise", async () => {
		const httpHelper = require("./lib/httpHelper");

		const mockAdapter = {
			config: {
				host: "192.168.1.100",
				port: 3180,
			},
		};

		// Test that the function returns a promise
		const requestPromise = httpHelper.makeRequest(mockAdapter, "/api/state", 1000);
		expect(requestPromise).to.be.a("promise");
	});
});

// Test for trafficLight.js
describe("lib/trafficLight.js => Board status indication", () => {
	let mockAdapter;

	beforeEach(() => {
		mockAdapter = {
			setStateAsync: sinon.stub().resolves(),
			log: { debug: sinon.stub() },
		};
	});

	it("should set traffic light to green for 'Throw' status", async () => {
		const trafficLight = require("./lib/trafficLight");
		await trafficLight.init(mockAdapter);

		await trafficLight.setStatus(mockAdapter, "green");

		const lightCall = mockAdapter.setStateAsync.args.find((call) =>
			call[0].includes("trafficLightColor"),
		);
		expect(lightCall).to.exist;
	});

	it("should set traffic light to red on error", async () => {
		const trafficLight = require("./lib/trafficLight");

		await trafficLight.setStatus(mockAdapter, "red");

		const lightCall = mockAdapter.setStateAsync.args.find((call) =>
			call[0].includes("trafficLightColor"),
		);
		expect(lightCall).to.exist;
	});
});

// Test for config.js
describe("lib/config.js => Runtime configuration management", () => {
	let mockAdapter;

	beforeEach(() => {
		mockAdapter = {
			config: {
				tripleMinScore: 5,
				tripleMaxScore: 15,
				triggerResetSec: 3,
			},
			setStateAsync: sinon.stub().resolves(),
			getStateAsync: sinon.stub().resolves({ val: null }),
		};
	});

	it("should initialize runtime values from config", async () => {
		const config = require("./lib/config");
		await config.init(mockAdapter);
		await config.initializeRuntimeValues(mockAdapter);

		expect(mockAdapter.tripleMinScoreRuntime).to.equal(5);
		expect(mockAdapter.tripleMaxScoreRuntime).to.equal(15);
		expect(mockAdapter.triggerResetSecRuntime).to.equal(3);
	});

	it("should handle state change for tripleMinScore", async () => {
		const config = require("./lib/config");
		await config.handleStateChange(mockAdapter, "config.tripleMinScore", { val: 10 });

		expect(mockAdapter.tripleMinScoreRuntime).to.equal(10);
	});
});