// This file extends the AdapterConfig type from "@iobroker/types"
// using the actual properties present in io-package.json
// in order to provide typings for adapter.config properties

import { native } from "../io-package.json";

type _AdapterConfig = typeof native;

// Augment the globally declared type ioBroker.AdapterConfig
declare global {
	namespace ioBroker {
		interface AdapterConfig extends _AdapterConfig {
			// Additional properties defined in jsonConfig but not in io-package.json native
			tripleMinScore?: number;
			tripleMaxScore?: number;
			triggerResetMs?: number;
		}
	}
}

// this is required so the above AdapterConfig is found by TypeScript / type checking
export {};