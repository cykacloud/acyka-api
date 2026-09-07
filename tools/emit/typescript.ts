/**
 * TypeScript: the types, and one method per operation grouped by tag.
 *
 * What is *not* here is the half that matters — the transport, the four OAuth
 * flows, the token that renews itself, the backoff, the paginator, the error
 * types. Those are hand-written in `packages/typescript/src`, because they are
 * where a client stops being correct and starts being pleasant, and neither of
 * those is a mechanical function of a document.
 *
 * The wire is snake_case and stays snake_case. Nothing here renames a field: a
 * client that quietly camelCased `shikimori_id` would be a client whose users
 * cannot read the reference, cannot paste a curl answer into a type, and cannot
 * search the docs for what they are holding. Method names are camelCase because
 * they are ours to name.
 */

import { byTag, camel, comment, type Api, type Field, type Op, type Ty } from '../spec';

function ty(t: Ty): string {
	switch (t.k) {
		case 'string':
			return 'string';
		case 'int':
		case 'float':
			return 'number';
		case 'bool':
			return 'boolean';
		case 'array':
			return `${ty(t.of)}[]`;
		case 'ref':
			return t.name;
		case 'page':
			return `Page<${ty(t.of)}>`;
		case 'unknown':
			return 'unknown';
	}
}

/**
 * One field, with its comment on one line.
 *
 * A block comment above each of forty fields is a list nobody scrolls through,
 * so the server's paragraphs are folded onto a single line here and left in
 * full on the models and the methods, where there is room to read them.
 */
function field(f: Field): string[] {
	const doc = f.doc ? [`\t/** ${f.doc.replace(/\s+/g, ' ').trim()} */`] : [];
	return [...doc, `\t${f.name}${f.optional ? '?' : ''}: ${ty(f.ty)};`];
}

function types(api: Api): string {
	const out: string[] = [
		'// Generated from openapi.json by tools/generate.ts. Do not edit.',
		'',
		'/**',
		' * The envelope every collection answers in.',
		' *',
		' * `total` is there when the caller pages by offset and therefore has to know',
		' * how far the list goes; a cursor-paged list leaves it out rather than paying',
		' * for a second count nobody reads.',
		' */',
		'export type Page<T> = {',
		'\titems: T[];',
		'\ttotal?: number;',
		'};',
		''
	];

	for (const alias of api.aliases) {
		if (alias.doc) out.push('/**', ...comment(alias.doc, ' *'), ' */');
		out.push(`export type ${alias.name} = ${ty(alias.ty)};`, '');
	}

	for (const model of api.models) {
		if (model.doc) {
			out.push('/**', ...comment(model.doc, ' *'), ' */');
		}
		out.push(`export type ${model.name} = {`);
		for (const f of model.fields) out.push(...field(f));
		out.push('};', '');
	}

	// The scope vocabulary, so a caller building an authorization URL cannot ask
	// for a word the provider does not know — a typo there locks every one of
	// that client's users out until somebody notices.
	out.push('/** Every scope this api offers. */');
	out.push(`export type Scope =\n${api.scopes.map((s) => `\t| '${s.key}'`).join('\n')};`, '');
	out.push('export const SCOPES: readonly Scope[] = [');
	for (const s of api.scopes) out.push(`\t'${s.key}',`);
	out.push('] as const;', '');

	return out.join('\n');
}

/** The named arguments one operation takes, as one object type. */
function args(op: Op): { type: string; needed: boolean } | null {
	const lines: string[] = [];
	for (const p of op.params) {
		const doc = p.doc ? `\t/** ${p.doc.replace(/\s+/g, ' ').trim()} */\n` : '';
		lines.push(`${doc}\t${p.name}${p.required ? '' : '?'}: ${ty(p.ty)};`);
	}
	if (op.body) lines.push(`\t/** the request body */\n\tbody: ${op.body.model};`);
	if (!lines.length) return null;
	const needed = op.params.some((p) => p.required) || !!op.body?.required;
	return { type: `{\n${lines.join('\n')}\n}`, needed };
}

function method(op: Op): string[] {
	const out: string[] = [];
	const shape = args(op);
	const result = op.ok.ty ? ty(op.ok.ty) : 'void';

	out.push('\t/**');
	out.push(...comment(op.doc ?? op.summary, ' *', '\t'));
	out.push('\t *');
	out.push(`\t * \`${op.method} ${op.path}\``);
	if (op.scope) out.push(`\t * @scope \`${op.scope}\``);
	out.push('\t */');

	const params = shape ? `input${shape.needed ? '' : '?'}: ${shape.type.replace(/\n/g, '\n\t')}` : '';
	out.push(`\t${camel(op.id)}(${params}): Promise<${result}> {`);

	const path = op.path.replace(/\{(\w+)\}/g, (_, p) => `\${encodeURIComponent(String(input.${p}))}`);
	const query = op.params.filter((p) => p.where === 'query').map((p) => p.name);

	out.push(`\t\treturn this.core.call({`);
	out.push(`\t\t\tmethod: '${op.method}',`);
	out.push(`\t\t\tpath: \`${path}\`,`);
	if (query.length) {
		out.push(`\t\t\tquery: pick(input, [${query.map((q) => `'${q}'`).join(', ')}]),`);
	}
	if (op.body) out.push(`\t\t\tbody: input.body,`);
	if (!op.ok.ty) out.push(`\t\t\tempty: true,`);
	out.push(`\t\t\tscope: ${op.scope ? `'${op.scope}'` : 'undefined'},`);
	out.push(`\t\t});`);
	out.push('\t}');

	// And a paginator, where the answer is a page and the window is an offset.
	// Every caller writes this loop otherwise, and somebody gets the last page
	// wrong — `items.length < limit` is the test, not `total`, because the list
	// can grow while it is being read.
	if (op.pages && op.ok.ty?.k === 'page') {
		const item = ty(op.ok.ty.of);
		out.push('');
		out.push('\t/**');
		out.push(`\t * Every row of \`${camel(op.id)}\`, a page at a time.`);
		out.push('\t *');
		out.push('\t * Stops when a page comes back shorter than it asked for rather than');
		out.push('\t * when `total` is reached: the list can grow while it is being read, and');
		out.push('\t * counting against a number from the first page walks off the end.');
		out.push('\t */');
		const shapeText = shape!.type.replace(/\n/g, '\n\t');
		out.push(
			`\tasync *${camel(op.id)}All(input${shape!.needed ? '' : '?'}: ${shapeText}): AsyncGenerator<${item}> {`
		);
		out.push('\t\tlet offset = input?.offset ?? 0;');
		out.push('\t\tconst limit = input?.limit ?? 100;');
		out.push('\t\tfor (;;) {');
		out.push(
			`\t\t\tconst page = await this.${camel(op.id)}({ ...(input as object), limit, offset } as never);`
		);
		out.push('\t\t\tfor (const row of page.items) yield row;');
		out.push('\t\t\tif (page.items.length < limit) return;');
		out.push('\t\t\toffset += page.items.length;');
		out.push('\t\t}');
		out.push('\t}');
	}

	return out;
}

function operations(api: Api): string {
	const groups = byTag(api);
	const out: string[] = [
		'// Generated from openapi.json by tools/generate.ts. Do not edit.',
		'',
		"import type { Core } from '../core';",
		'import type {',
		...[...new Set(referenced(api))].sort().map((n) => `\t${n},`),
		"} from './types';",
		'',
		'/** Only the keys a query string wants, and only the ones that were given. */',
		'function pick<T extends object>(input: T | undefined, keys: string[]): Record<string, unknown> {',
		'\tconst out: Record<string, unknown> = {};',
		'\tif (!input) return out;',
		'\tfor (const key of keys) {',
		'\t\tconst value = (input as Record<string, unknown>)[key];',
		'\t\t// `undefined` means "not asked for" and is left out; `null` and `0` and',
		'\t\t// `false` are answers and are sent.',
		'\t\tif (value !== undefined) out[key] = value;',
		'\t}',
		'\treturn out;',
		'}',
		''
	];

	for (const group of groups) {
		out.push('/**');
		out.push(` * ${group.doc || group.tag}`);
		out.push(' */');
		out.push(`export class ${cap(group.tag)} {`);
		out.push('\tconstructor(private readonly core: Core) {}');
		for (const op of group.ops) {
			out.push('');
			out.push(...method(op));
		}
		out.push('}', '');
	}

	return out.join('\n');
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Every generated type name the operations mention. */
function referenced(api: Api): string[] {
	const names: string[] = ['Page'];
	const walk = (t: Ty | null | undefined) => {
		if (!t) return;
		if (t.k === 'ref') names.push(t.name);
		if (t.k === 'array' || t.k === 'page') walk(t.of);
	};
	for (const op of api.ops) {
		walk(op.ok.ty);
		for (const p of op.params) walk(p.ty);
		if (op.body) names.push(op.body.model);
	}
	return names;
}

/**
 * The namespaces, as one function and one type.
 *
 * Generated rather than listed in the hand-written client, so a tag the server
 * adds arrives without anybody editing a class — and the client stays fully
 * typed, because `Acyka` declaration-merges with this interface rather than
 * indexing into a map. A tag that only appeared here as a string would be a
 * namespace with no completion and no type on anything under it.
 */
function client(api: Api): string {
	const groups = byTag(api);
	const out: string[] = [
		'// Generated from openapi.json by tools/generate.ts. Do not edit.',
		'',
		"import type { Core } from '../core';",
		`import { ${groups.map((g) => cap(g.tag)).join(', ')} } from './operations';`,
		'',
		'export function namespaces(core: Core) {',
		'	return {'
	];
	for (const group of groups) out.push(`		${camel(group.tag)}: new ${cap(group.tag)}(core),`);
	out.push('	};', '}', '');
	out.push('/** Every namespace a client carries, for the interface `Acyka` merges with. */');
	out.push('export type Namespaces = ReturnType<typeof namespaces>;', '');
	return out.join('\n');
}

export function typescript(api: Api): Record<string, string> {
	return {
		'packages/typescript/src/generated/types.ts': types(api),
		'packages/typescript/src/generated/operations.ts': operations(api),
		'packages/typescript/src/generated/client.ts': client(api)
	};
}
