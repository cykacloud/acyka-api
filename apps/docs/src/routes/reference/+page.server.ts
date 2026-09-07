import { groups } from '$lib/server/contract';

export function load() {
	return { groups: groups() };
}
