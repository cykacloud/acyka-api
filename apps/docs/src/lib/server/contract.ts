/**
 * The contract, read once, on the server.
 *
 * `openapi.json` is 160 KB and the reader turns it into something with every
 * `allOf` flattened and every envelope resolved. Doing that in the browser would
 * ship the whole document to every reader for the sake of one page; doing it per
 * request would do it forty times a minute for a file that changes on a deploy.
 *
 * The same reader the six client libraries are generated from, imported rather
 * than copied. A second copy here would be a reference that could disagree with
 * the clients it documents — which is exactly the failure the one-reader rule
 * exists to prevent.
 */

import document from '$contract';
import { slug } from '../slug';
import { byTag, read, type Api, type Op } from '$tools/spec';

let held: Api | undefined;

/** The whole contract. */
export function contract(): Api {
	held ??= read(document as never);
	return held;
}

/** Every operation, grouped by the tag it was filed under. */
export function groups() {
	return byTag(contract());
}

/** One operation, by the id the document gave it. */
export function operation(id: string): Op | undefined {
	return contract().ops.find((op) => op.id === id);
}

/** One model, by name. */
export function model(name: string) {
	return contract().models.find((m) => m.name === name);
}

/** And back, for a route parameter. */
export function bySlug(id: string): Op | undefined {
	return contract().ops.find((op) => slug(op.id) === id);
}
