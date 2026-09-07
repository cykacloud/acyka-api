// Generated from openapi.json by tools/generate.ts. Do not edit.

import type { Core } from '../core';
import { Account, Catalogue, People, Library, Social } from './operations';

export function namespaces(core: Core) {
	return {
		account: new Account(core),
		catalogue: new Catalogue(core),
		people: new People(core),
		library: new Library(core),
		social: new Social(core),
	};
}

/** Every namespace a client carries, for the interface `Acyka` merges with. */
export type Namespaces = ReturnType<typeof namespaces>;
