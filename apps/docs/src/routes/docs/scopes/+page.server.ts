import { contract } from '$lib/server/contract';
import { groups } from '$lib/server/contract';

/**
 * What each scope actually opens, read off the contract.
 *
 * A written list would be a list that goes stale the first time an operation
 * moves between scopes — and the whole argument of this page is that a scope is
 * exactly the set of things behind it.
 */
export function load() {
	const api = contract();
	const behind = new Map<string, { id: string; method: string; path: string }[]>();

	for (const op of api.ops) {
		if (!op.scope) continue;
		const already = behind.get(op.scope) ?? [];
		already.push({ id: op.id, method: op.method, path: op.path });
		behind.set(op.scope, already);
	}

	return {
		scopes: api.scopes.map((scope) => ({
			...scope,
			opens: behind.get(scope.key) ?? []
		})),
		tags: groups().map((g) => g.tag)
	};
}
