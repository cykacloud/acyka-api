import { contract } from '$lib/server/contract';
import { slug } from '$lib/slug';

/**
 * Every operation, thinned to what the playground needs.
 *
 * Not the whole contract: the page has to reach the browser, and shipping
 * twenty-eight shapes and their documentation for a form that shows parameters
 * would put the entire document in front of every reader who opens it.
 */
export function load() {
	return {
		ops: contract().ops.map((op) => ({
			id: op.id,
			slug: slug(op.id),
			tag: op.tag,
			method: op.method,
			path: op.path,
			summary: op.summary ?? '',
			scope: op.scope,
			writes: op.method !== 'GET',
			body: op.body?.model,
			params: op.params.map((p) => ({
				name: p.name,
				where: p.where,
				required: p.required,
				doc: p.doc ?? '',
				kind: p.ty.k
			}))
		}))
	};
}
