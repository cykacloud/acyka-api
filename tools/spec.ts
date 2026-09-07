/**
 * `openapi.json`, read once into something six emitters can walk.
 *
 * The alternative — six emitters each reading the document — is six places that
 * have to agree about what `allOf` means and what `Items_TitleCard` is, and they
 * would not: the first language written would be right and the sixth would have
 * a subtly different idea of which fields are optional. There is one reader.
 *
 * Three things it normalises, and each is a fact about the document rather than
 * a preference:
 *
 * - **`allOf` is flattened.** A shape the server declares with
 *   `#[serde(flatten)]` arrives as `allOf: [$ref, {…}]`, and the JSON on the
 *   wire is one flat object. A client type that mirrored the `allOf` would make
 *   its caller write `voice.who.name` for a field the server sends as `name`.
 * - **`Items_X` becomes a page of `X`.** utoipa names a generic by mangling it
 *   and inlines the whole of `X` inside it, so the document has seventeen
 *   near-duplicate schemas for one envelope. Emitting them as written would give
 *   every language seventeen copies of the same type.
 * - **`type: ["string", "null"]` is an optional field.** OpenAPI 3.1 spells
 *   nullable that way, and this api uses it to mean exactly what
 *   `skip_serializing_if` means on the other side: the key may be absent.
 */

export type Ty =
	| { k: 'string' }
	| { k: 'int'; wide: boolean }
	| { k: 'float' }
	| { k: 'bool' }
	| { k: 'array'; of: Ty }
	| { k: 'ref'; name: string }
	/** the `{ items, total }` envelope every collection answers in */
	| { k: 'page'; of: Ty }
	| { k: 'unknown' };

export type Field = {
	name: string;
	ty: Ty;
	/** absent from the JSON when it has nothing to say — never `null` in place of a value */
	optional: boolean;
	doc?: string;
};

export type Model = {
	name: string;
	doc?: string;
	fields: Field[];
};

/** A schema that is a primitive wearing a name, like `PostId`. */
export type Alias = { name: string; ty: Ty; doc?: string };

export type Param = {
	name: string;
	ty: Ty;
	required: boolean;
	where: 'path' | 'query';
	doc?: string;
};

export type Op = {
	id: string;
	tag: string;
	method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
	/** with `/api` still on the front, exactly as a caller writes it */
	path: string;
	summary?: string;
	doc?: string;
	params: Param[];
	body?: { model: string; required: boolean };
	/** the successful status, and what comes back with it — `null` for a 204 */
	ok: { status: number; ty: Ty | null };
	/** the scope this operation needs, or `undefined` where it needs none */
	scope?: string;
	/** whether the answer is a page, so a paginator can be generated beside it */
	pages: boolean;
};

export type Api = {
	title: string;
	version: string;
	doc: string;
	server: string;
	tags: { name: string; doc: string }[];
	models: Model[];
	aliases: Alias[];
	ops: Op[];
	/** every scope the document advertises, with its phrase name */
	scopes: { key: string; phrase: string }[];
	authorize: string;
	token: string;
};

type Json = Record<string, any>;

const PAGE = 'Items_';

function nameOf(ref: string): string {
	return ref.slice(ref.lastIndexOf('/') + 1);
}

/** Whether a schema's `type` includes `null`, and the type without it. */
function bare(schema: Json): { type?: string; nullable: boolean } {
	const t = schema.type;
	if (Array.isArray(t)) {
		return { type: t.find((x) => x !== 'null'), nullable: t.includes('null') };
	}
	return { type: t, nullable: false };
}

/**
 * A schema, as one of the seven things a client can hold.
 *
 * `schemas` is needed for the envelopes and only for those. utoipa names a
 * generic by mangling it — `Items_TitleCard`, `Items_String` — and the mangled
 * half is a Rust type name rather than a schema name: `Items_String` is a page
 * of plain strings and there is no `String` schema to point at. So the row type
 * is read out of the envelope's own `items`, which is true whatever the name
 * says.
 */
function tyOf(schema: Json | undefined, schemas: Json = {}): Ty {
	if (!schema) return { k: 'unknown' };
	if (schema.$ref) {
		const name = nameOf(schema.$ref);
		if (!name.startsWith(PAGE)) return { k: 'ref', name };
		const inside = schemas[name]?.properties?.items?.items;
		const row = nameOf(schema.$ref).slice(PAGE.length);
		// A page of a named shape keeps the name, so the generated type reads
		// `Page<TitleCard>` rather than the whole shape inlined again.
		return {
			k: 'page',
			of: schemas[row] ? { k: 'ref', name: row } : tyOf(inside, schemas)
		};
	}
	const { type } = bare(schema);
	switch (type) {
		case 'string':
			return { k: 'string' };
		case 'boolean':
			return { k: 'bool' };
		case 'integer':
			// int64 is the one that does not fit a double, and the emitters that
			// have a choice of width need to know which is which.
			return { k: 'int', wide: schema.format === 'int64' };
		case 'number':
			return { k: 'float' };
		case 'array':
			return { k: 'array', of: tyOf(schema.items, schemas) };
		case 'object':
			return { k: 'unknown' };
		default:
			return { k: 'unknown' };
	}
}

/**
 * A schema's own fields, with anything it is `allOf`-composed with merged in.
 *
 * Depth-first and base-first, so a field a shape declares itself wins over one
 * of the same name it inherited — which is the order `#[serde(flatten)]` puts
 * them on the wire.
 */
function fieldsOf(schema: Json, schemas: Json, seen = new Set<string>()): Field[] {
	const out: Field[] = [];

	for (const part of schema.allOf ?? []) {
		if (part.$ref) {
			const name = nameOf(part.$ref);
			if (seen.has(name)) continue;
			seen.add(name);
			out.push(...fieldsOf(schemas[name], schemas, seen));
		} else {
			out.push(...fieldsOf(part, schemas, seen));
		}
	}

	const required: string[] = schema.required ?? [];
	for (const [name, prop] of Object.entries<Json>(schema.properties ?? {})) {
		const { nullable } = bare(prop);
		const field: Field = {
			name,
			ty: tyOf(prop, schemas),
			optional: nullable || !required.includes(name),
			doc: prop.description
		};
		const already = out.findIndex((f) => f.name === name);
		if (already >= 0) out[already] = field;
		else out.push(field);
	}

	return out;
}

/** Whether a schema is a primitive wearing a name rather than an object. */
function isAlias(schema: Json): boolean {
	if (schema.allOf || schema.properties) return false;
	const { type } = bare(schema);
	return type !== undefined && type !== 'object';
}

const VERBS = ['get', 'post', 'put', 'delete', 'patch'] as const;

/** The first 2xx a document declares, which is the one that carries the answer. */
function success(responses: Json, schemas: Json): { status: number; ty: Ty | null } {
	const codes = Object.keys(responses)
		.map(Number)
		.filter((n) => n >= 200 && n < 300)
		.sort((a, b) => a - b);
	const status = codes[0] ?? 200;
	const schema = responses[String(status)]?.content?.['application/json']?.schema;
	// 204 carries nothing, and saying `unknown` for it would make every emitter
	// hand its caller a value to ignore.
	return { status, ty: schema ? tyOf(schema, schemas) : null };
}

export function read(document: Json): Api {
	const schemas: Json = document.components?.schemas ?? {};

	const models: Model[] = [];
	const aliases: Alias[] = [];
	for (const [name, schema] of Object.entries<Json>(schemas)) {
		// The seventeen mangled envelopes are one generic in every language that
		// has generics, and one hand-written pair in C, so none of them is a model.
		if (name.startsWith(PAGE)) continue;
		if (isAlias(schema)) {
			aliases.push({ name, ty: tyOf(schema, schemas), doc: schema.description });
			continue;
		}
		models.push({ name, doc: schema.description, fields: fieldsOf(schema, schemas) });
	}

	const ops: Op[] = [];
	for (const [path, item] of Object.entries<Json>(document.paths ?? {})) {
		for (const verb of VERBS) {
			const op: Json | undefined = item[verb];
			if (!op) continue;

			const params: Param[] = (op.parameters ?? []).map((p: Json) => ({
				name: p.name,
				ty: tyOf(p.schema, schemas),
				required: !!p.required,
				where: p.in === 'path' ? 'path' : 'query',
				doc: p.description
			}));

			const bodyRef = op.requestBody?.content?.['application/json']?.schema?.$ref;
			const ok = success(op.responses ?? {}, schemas);

			// The description is the handler's own doc comment. Its first line is a
			// sentence about what the operation is, which is exactly what a summary
			// is for and what an editor shows on hover.
			const doc: string | undefined = op.description;
			const summary: string | undefined = op.summary ?? doc?.split('\n\n')[0];

			ops.push({
				id: op.operationId,
				tag: op.tags?.[0] ?? 'api',
				method: verb.toUpperCase() as Op['method'],
				path,
				summary,
				doc,
				params,
				body: bodyRef ? { model: nameOf(bodyRef), required: !!op.requestBody.required } : undefined,
				ok,
				scope: op.security?.[0]?.oauth2?.[0],
				pages: ok.ty?.k === 'page' && params.some((p) => p.name === 'offset')
			});
		}
	}
	ops.sort((a, b) => a.tag.localeCompare(b.tag) || a.id.localeCompare(b.id));

	const flow = document.components?.securitySchemes?.oauth2?.flows?.authorizationCode;

	return {
		title: document.info.title,
		version: document.info.version,
		doc: document.info.description ?? '',
		server: document.servers?.[0]?.url ?? '',
		tags: (document.tags ?? []).map((t: Json) => ({ name: t.name, doc: t.description ?? '' })),
		models,
		aliases,
		ops,
		scopes: Object.entries<string>(flow?.scopes ?? {}).map(([key, phrase]) => ({ key, phrase })),
		authorize: flow?.authorizationUrl ?? '',
		token: flow?.tokenUrl ?? ''
	};
}

/** Every operation, grouped by the tag it was filed under. */
export function byTag(api: Api): { tag: string; doc: string; ops: Op[] }[] {
	const known = api.tags.map((t) => ({ tag: t.name, doc: t.doc, ops: [] as Op[] }));
	for (const op of api.ops) {
		// A tag the document declares no description for still gets a group, for
		// the reason the site's own scope grouping is a sort and never a filter:
		// dropping it would lose the operation entirely.
		const group = known.find((g) => g.tag === op.tag) ?? { tag: op.tag, doc: '', ops: [] };
		if (!known.includes(group)) known.push(group);
		group.ops.push(op);
	}
	return known.filter((g) => g.ops.length > 0);
}

/* --------------------------------- casing ---------------------------------- */
//
// The wire is snake_case and stays snake_case: these only rename what a caller
// types, never what is sent. Which of them a language uses is that language's
// convention and nothing to do with the api.

export const camel = (s: string) => s.replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase());
export const pascal = (s: string) => {
	const c = camel(s);
	return c.charAt(0).toUpperCase() + c.slice(1);
};
export const snake = (s: string) =>
	s.replace(/([a-z0-9])([A-Z])/g, '$1_$2').replace(/-/g, '_').toLowerCase();

/** A doc comment as lines, wrapped, with the prefix a language uses. */
export function comment(text: string | undefined, prefix: string, indent = ''): string[] {
	if (!text) return [];
	const out: string[] = [];
	for (const para of text.split('\n\n')) {
		const words = para.replace(/\s+/g, ' ').trim().split(' ');
		let line = '';
		for (const word of words) {
			if (line.length + word.length + 1 > 76) {
				out.push(`${indent}${prefix} ${line}`.trimEnd());
				line = word;
			} else {
				line = line ? `${line} ${word}` : word;
			}
		}
		if (line) out.push(`${indent}${prefix} ${line}`.trimEnd());
		out.push(`${indent}${prefix}`.trimEnd());
	}
	// the blank line after the last paragraph is not wanted
	while (out.length && out[out.length - 1].trim() === prefix.trim()) out.pop();
	return out;
}
