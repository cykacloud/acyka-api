import { error } from '@sveltejs/kit';
import { bySlug, contract } from '$lib/server/contract';
import { coloured } from '$lib/server/highlight';
import { samples } from '$lib/server/samples';
import { links } from '$lib/type';
import type { Model, Ty } from '$tools/spec';

/**
 * One operation, with every shape it mentions.
 *
 * The shapes are gathered transitively and rendered on the same page rather than
 * linked away to a page of their own, because reading a reference is reading a
 * shape and the shapes it contains — and three clicks to find out what a `Voice`
 * is, is how a reference stops being read.
 */
export async function load({ params }) {
	const op = bySlug(params.op);
	if (!op) error(404, 'there is no operation at that address');

	const api = contract();
	const found = new Map<string, Model>();

	const walk = (t: Ty | null | undefined) => {
		const name = t ? links(t) : undefined;
		if (!name || found.has(name)) return;
		const model = api.models.find((m) => m.name === name);
		if (!model) return;
		found.set(name, model);
		for (const field of model.fields) walk(field.ty);
	};

	walk(op.ok.ty);
	if (op.body) {
		const body = api.models.find((m) => m.name === op.body!.model);
		if (body) {
			found.set(body.name, body);
			for (const field of body.fields) walk(field.ty);
		}
	}

	const written = samples(op);

	return {
		op,
		shapes: [...found.values()],
		samples: await Promise.all(
			written.map(async (sample) => ({
				...sample,
				html: await coloured(sample.code, sample.id === 'curl' ? 'bash' : sample.id)
			}))
		)
	};
}
