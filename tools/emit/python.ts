/**
 * Python: dataclasses, parsers, and two clients that are the same client.
 *
 * Three decisions worth stating.
 *
 * **Dataclasses rather than dicts.** A `TypedDict` costs nothing at run time and
 * gives `title["title"]`, which is not what anybody writing Python wants to
 * read. Frozen slotted dataclasses give `title.title`, an editor that can
 * complete it, and a `repr` that is readable in a traceback.
 *
 * **A generated parser per shape rather than a library.** pydantic would do this
 * and would be the largest dependency in the package by an order of magnitude,
 * for a job that is one `cls(...)` call per shape. The only dependency here is
 * `httpx`, which is doing something that cannot be written in thirty lines.
 *
 * **Sync and async both, generated from one loop.** Python callers expect both,
 * and a library that offers one makes half its users write a thread pool or an
 * event loop around it. The bodies differ by two keywords, so this is cheaper
 * than the argument about which half to leave out.
 */

import { byTag, comment, snake, type Api, type Field, type Op, type Ty } from '../spec';

function ty(t: Ty): string {
	switch (t.k) {
		case 'string':
			return 'str';
		case 'int':
			return 'int';
		case 'float':
			return 'float';
		case 'bool':
			return 'bool';
		case 'array':
			return `list[${ty(t.of)}]`;
		case 'ref':
			return t.name;
		case 'page':
			return `Page[${ty(t.of)}]`;
		case 'unknown':
			return 'Any';
	}
}

/**
 * The names in the document that are an alias rather than a shape.
 *
 * `PostId = str` is a `ref` in the contract exactly like `Post` is, and the two
 * could not be told apart here — so the parser emitted `PostId._parse(...)`,
 * which is `str._parse` and an `AttributeError` on the first post anybody read.
 * Filled once per run before anything is emitted; a module-level set rather
 * than an argument threaded through four call sites, because it is a property
 * of the document and not of a value.
 */
const plain = new Set<string>();

/** Whether a name parses itself, or is a builtin wearing a nicer name. */
const shaped = (name: string) => !plain.has(name);

/** How one value is read back out of parsed JSON. */
function parse(t: Ty, from: string): string {
	switch (t.k) {
		case 'ref':
			return shaped(t.name) ? `${t.name}._parse(${from})` : from;
		case 'array':
			return (t.of.k === 'ref' && shaped(t.of.name)) || t.of.k === 'page'
				? `[${parse(t.of, 'x')} for x in ${from}]`
				: from;
		case 'page':
			return `Page._parse(${from}, ${t.of.k === 'ref' && shaped(t.of.name) ? `${t.of.name}._parse` : '_asis'})`;
		default:
			return from;
	}
}

function models(api: Api): string {
	const out: string[] = [
		'"""Generated from openapi.json by tools/generate.ts. Do not edit."""',
		'',
		'from __future__ import annotations',
		'',
		'from dataclasses import dataclass',
		'from typing import Any, Generic, TypeVar',
		'',
		'T = TypeVar("T")',
		'',
		'',
		'def _asis(value: Any) -> Any:',
		'    return value',
		'',
		'',
		'@dataclass(frozen=True, slots=True)',
		'class Page(Generic[T]):',
		'    """The envelope every collection answers in.',
		'',
		'    ``total`` is there when the caller pages by offset and therefore has to',
		'    know how far the list goes; a cursor-paged list leaves it out rather than',
		'    paying for a second count nobody reads.',
		'    """',
		'',
		'    items: list[T]',
		'    total: int | None = None',
		'',
		'    @classmethod',
		'    def _parse(cls, raw: Any, row: Any) -> Page[Any]:',
		'        return cls(items=[row(x) for x in raw.get("items", [])], total=raw.get("total"))',
		'',
		'    def __iter__(self):',
		'        return iter(self.items)',
		'',
		'    def __len__(self) -> int:',
		'        return len(self.items)',
		''
	];

	for (const alias of api.aliases) {
		out.push('');
		out.push(...comment((alias.doc ?? '').split('\n\n')[0], '#:'));
		out.push(`${alias.name} = ${ty(alias.ty)}`);
	}

	// Ordered so a shape is defined before anything that parses into it. The
	// annotations are strings (`from __future__ import annotations`), so the type
	// hints do not need it — but `_parse` calls the other class by name at run
	// time, and that name has to exist by then.
	for (const model of ordered(api)) {
		out.push('', '');
		out.push('@dataclass(frozen=True, slots=True)');
		out.push(`class ${model.name}:`);
		out.push(...docstring(model.doc, '    '));

		const required = model.fields.filter((f) => !f.optional);
		const optional = model.fields.filter((f) => f.optional);
		for (const f of required) out.push(...pyField(f, false));
		for (const f of optional) out.push(...pyField(f, true));
		if (!model.fields.length) out.push('    pass');

		out.push('');
		out.push('    @classmethod');
		out.push(`    def _parse(cls, raw: Any) -> ${model.name}:`);
		out.push('        return cls(');
		for (const f of [...required, ...optional]) {
			const key = `raw["${f.name}"]`;
			if (f.optional) {
				const got = `raw.get("${f.name}")`;
				const inner = parse(f.ty, '_v');
				if (inner === '_v') {
					out.push(`            ${snake(f.name)}=${got},`);
				} else {
					const one = `            ${snake(f.name)}=(lambda _v: None if _v is None else ${inner})(${got}),`;
					if (one.length <= 100) {
						out.push(one);
					} else {
						// A list of a shape inside an optional field is the longest
						// thing this emits. Broken at the call rather than inside the
						// lambda, which is the only place it reads.
						out.push(`            ${snake(f.name)}=(lambda _v: None if _v is None else ${inner})(`);
						out.push(`                ${got}`);
						out.push('            ),');
					}
				}
			} else {
				out.push(`            ${snake(f.name)}=${parse(f.ty, key)},`);
			}
		}
		out.push('        )');
	}

	out.push('');
	out.push('');
	out.push('#: Every scope this api offers.');
	out.push('SCOPES: tuple[str, ...] = (');
	for (const s of api.scopes) out.push(`    "${s.key}",`);
	out.push(')');
	return out.join('\n');
}

function pyField(f: Field, optional: boolean): string[] {
	const out: string[] = [];
	// Wrapped, through the same helper every other comment here uses. It used to
	// be one line however long the api's own sentence was, and the api writes
	// paragraphs — which is a hundred and forty columns in a file somebody reads
	// to find out what a field means.
	if (f.doc) out.push(...comment(f.doc, '#:', '    '));
	out.push(`    ${snake(f.name)}: ${ty(f.ty)}${optional ? ' | None' : ''}${optional ? ' = None' : ''}`);
	return out;
}

function docstring(doc: string | undefined, indent: string): string[] {
	if (!doc) return [];
	const lines = comment(doc, '', indent).map((l) => l.replace(`${indent} `, indent));
	if (lines.length === 1) return [`${indent}"""${lines[0].trim()}"""`, ''];
	return [`${indent}"""${lines[0].trim()}`, ...lines.slice(1), `${indent}"""`, ''];
}

/** Models, with anything a model parses into defined before it. */
function ordered(api: Api) {
	const done = new Set<string>();
	const out: typeof api.models = [];
	const by = new Map(api.models.map((m) => [m.name, m]));

	const needs = (t: Ty): string[] =>
		t.k === 'ref' ? [t.name] : t.k === 'array' || t.k === 'page' ? needs(t.of) : [];

	const visit = (name: string, path: Set<string>) => {
		const model = by.get(name);
		if (!model || done.has(name)) return;
		// A shape that reaches itself is not a problem — the annotations are
		// strings and `_parse` is only called at run time — so a cycle is broken
		// rather than followed.
		if (path.has(name)) return;
		path.add(name);
		for (const f of model.fields) for (const n of needs(f.ty)) visit(n, path);
		path.delete(name);
		done.add(name);
		out.push(model);
	};

	for (const model of api.models) visit(model.name, new Set());
	return out;
}

/** The arguments one operation takes, as a signature. */
function signature(op: Op, async: boolean): string[] {
	const required: string[] = [];
	const optional: string[] = [];
	for (const p of op.params) {
		const arg = `${snake(p.name)}: ${ty(p.ty)}`;
		if (p.required) required.push(arg);
		else optional.push(`${arg} | None = None`);
	}
	if (op.body) required.push(`body: ${op.body.model}`);
	// Keyword-only, all of them. `list_titles("frieren", 10)` is unreadable and
	// breaks the day a parameter is added anywhere but the end.
	return [...required, ...optional];
}

/**
 * One `def` line, or several.
 *
 * Six keyword arguments and a return type do not fit in a hundred columns, and
 * a signature that runs off the side is the one line in a method somebody
 * actually has to read. Broken the way a person would break it — one argument
 * per line, trailing comma — rather than at whatever column it happens to
 * reach.
 */
function head(kw: string, name: string, args: string[], result: string): string[] {
	const one = `    ${kw} ${name}(${['self', ...(args.length ? ['*'] : []), ...args].join(', ')}) -> ${result}:`;
	if (one.length <= 100) return [one];

	const out = [`    ${kw} ${name}(`, '        self,'];
	if (args.length) out.push('        *,');
	for (const arg of args) out.push(`        ${arg},`);
	out.push(`    ) -> ${result}:`);
	return out;
}

function method(op: Op, async: boolean): string[] {
	const out: string[] = [];
	const kw = async ? 'async def' : 'def';
	const wait = async ? 'await ' : '';
	const result = op.ok.ty ? ty(op.ok.ty) : 'None';
	const name = snake(op.id);

	out.push(...head(kw, name, signature(op, async), result));

	const doc: string[] = [];
	if (op.doc) doc.push(...comment(op.doc, '', '        ').map((l) => l.replace('         ', '        ')));
	doc.push('');
	// Two backticks is RST's inline literal, and building the line by hand keeps
	// them out of a template literal, where they would end it.
	const lit = (text: string) => '``' + text + '``';
	// The address, then the scope on a line of its own when the two together
	// would run past a hundred columns — which `ruff` is checking and which the
	// longest of these paths does on its own.
	const where = '        ' + lit(`${op.method} ${op.path}`);
	const needs = op.scope ? `, needs ${lit(op.scope)}` : '';
	if (needs && where.length + needs.length > 100) {
		doc.push(where + ',');
		doc.push('        needs ' + lit(op.scope!));
	} else {
		doc.push(where + needs);
	}
	out.push(`        """${(doc[0] ?? '').trim()}`);
	for (const line of doc.slice(1)) out.push(line);
	out.push('        """');

	const path = op.path.replace(/\{(\w+)\}/g, (_, p) => `{quote(str(${snake(p)}))}`);
	const query = op.params.filter((p) => p.where === 'query');

	// `raw =` only when something reads it. A 204 returns `None`, and an
	// assignment nobody uses is a warning in every linter there is.
	out.push('        ' + (op.ok.ty ? 'raw = ' : '') + wait + 'self._core.call(');
	out.push(`            "${op.method}",`);
	// An f-string prefix only when there is something to interpolate: a path
	// with no `{...}` in it is a plain string, and `f""` is a lint.
	out.push(`            ${path.includes('{') ? 'f' : ''}"${path}",`);
	if (query.length) {
		out.push('            query={');
		for (const q of query) out.push(`                "${q.name}": ${snake(q.name)},`);
		out.push('            },');
	}
	if (op.body) out.push('            body=_body(body),');
	out.push('        )');
	out.push(op.ok.ty ? `        return ${parse(op.ok.ty, 'raw')}` : '        return None');

	if (op.pages && op.ok.ty?.k === 'page') {
		const item = ty(op.ok.ty.of);
		const args = op.params
			.filter((p) => p.name !== 'limit' && p.name !== 'offset')
			.map((p) => `${snake(p.name)}=${snake(p.name)}`);
		out.push('');
		const gen = async ? 'async def' : 'def';
		const iter = async ? `AsyncIterator[${item}]` : `Iterator[${item}]`;
		out.push(...head(gen, `${name}_all`, signature(op, async), iter));
		out.push('        """Every row of ' + ':meth:`' + name + '`, a page at a time.');
		out.push('');
		out.push('        Stops when a page comes back shorter than it asked for rather than');
		out.push('        when ``total`` is reached: the list can grow while it is being read,');
		out.push('        and counting against a number from the first page walks off the end.');
		out.push('        """');
		out.push('        window = limit or 100');
		out.push('        at = offset or 0');
		out.push('        while True:');
		// The paging call forwards every filter the operation takes, and
		// `list_titles` takes eleven — two hundred columns on one line. Same rule
		// as the signature above: one per line once it will not fit.
		const passing = ['limit=window', 'offset=at', ...args];
		const call = `            page = ${wait}self.${name}(${passing.join(', ')})`;
		if (call.length <= 100) {
			out.push(call);
		} else {
			out.push(`            page = ${wait}self.${name}(`);
			for (const arg of passing) out.push(`                ${arg},`);
			out.push('            )');
		}
		// `yield from` is a syntax error inside an `async def`, so the two halves
		// genuinely differ here rather than differing by an `await`.
		if (async) {
			out.push('            for row in page.items:');
			out.push('                yield row');
		} else {
			out.push('            yield from page.items');
		}
		out.push('            if len(page.items) < window:');
		out.push('                return');
		out.push('            at += len(page.items)');
	}

	return out;
}

function groups(api: Api, async: boolean): string {
	const prefix = async ? 'Async' : '';
	const out: string[] = [
		'"""Generated from openapi.json by tools/generate.ts. Do not edit."""',
		'',
		'from __future__ import annotations',
		'',
		// `collections.abc` rather than `typing`: the typing aliases have been
		// deprecated since 3.9, and this package's floor is 3.11.
		'from collections.abc import ' + (async ? 'AsyncIterator' : 'Iterator'),
		'from dataclasses import asdict, is_dataclass',
		'from typing import Any',
		'from urllib.parse import quote',
		'',
		'from .models import *  # noqa: F403',
		// Named, and not for tidiness: a star import skips a leading underscore,
		// so `_asis` was undefined here and `list_genres` — a page of plain
		// strings, the one operation that needs it — raised `NameError` on its
		// first call.
		'from .models import Page, _asis',
		'',
		'',
		'def _body(value: Any) -> Any:',
		'    """A request body, as the wire wants it.',
		'',
		'    A dataclass goes out with the field names it was declared with, which are',
		'    the api\'s own snake_case — so this is a rename of nothing and a caller may',
		'    also pass a plain dict.',
		'    """',
		'    if is_dataclass(value) and not isinstance(value, type):',
		'        return {k: v for k, v in asdict(value).items() if v is not None}',
		'    return value',
		''
	];

	for (const group of byTag(api)) {
		out.push('', '');
		out.push(`class ${prefix}${cap(group.tag)}:`);
		out.push(...docstring(group.doc || group.tag, '    '));
		out.push('    def __init__(self, core: Any) -> None:');
		out.push('        self._core = core');
		for (const op of group.ops) {
			out.push('');
			out.push(...method(op, async));
		}
	}
	return out.join('\n');
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function namespaces(api: Api): string {
	const tags = byTag(api).map((g) => g.tag);
	const out: string[] = [
		'"""Generated from openapi.json by tools/generate.ts. Do not edit."""',
		'',
		'from __future__ import annotations',
		'',
		'from typing import Any',
		'',
		// `aoperations` before `operations`, and the names inside each sorted:
		// isort's order, which `ruff` checks. Tag order is the document's and has
		// no reason to be an import order.
		`from .aoperations import ${tags.map((t) => `Async${cap(t)}`).sort().join(', ')}`,
		`from .operations import ${tags.map(cap).sort().join(', ')}`,
		'',
		'',
		'class Namespaces:',
		'    """What a client hangs the generated groups off.',
		'',
		'    Generated, so a tag the server adds arrives without anybody editing the',
		'    client — and attribute access stays real rather than a lookup in a dict,',
		'    which is what an editor needs to complete it.',
		'    """',
		'',
		'    def __init__(self, core: Any) -> None:'
	];
	for (const tag of tags) out.push(`        self.${snake(tag)} = ${cap(tag)}(core)`);
	out.push('', '', 'class AsyncNamespaces:', '    def __init__(self, core: Any) -> None:');
	for (const tag of tags) out.push(`        self.${snake(tag)} = Async${cap(tag)}(core)`);
	return out.join('\n');
}

export function python(api: Api): Record<string, string> {
	// Before anything is emitted: `parse` reads this to tell `Post` from
	// `PostId`, and getting it after the first file is written is getting it
	// after the mistake.
	plain.clear();
	for (const alias of api.aliases) plain.add(alias.name);

	return {
		'packages/python/src/acyka/models.py': models(api),
		'packages/python/src/acyka/operations.py': groups(api, false),
		'packages/python/src/acyka/aoperations.py': groups(api, true),
		'packages/python/src/acyka/namespaces.py': namespaces(api)
	};
}
