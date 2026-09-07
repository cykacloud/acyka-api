/**
 * Rust: serde structs, a builder per read, and one method per operation.
 *
 * Two decisions are worth stating.
 *
 * **`Option<T>` and never a default.** A field the server leaves out is absent,
 * and absent is a different answer from zero — a follower count that is missing
 * means "not yours to know" and a `0` means "nobody". `#[serde(default)]` on
 * everything would collapse the two, which is the one thing this api's own rules
 * say a client must not do.
 *
 * **The wire's names, with `rename` only where Rust cannot spell them.** The
 * fields are already snake_case, so there is nothing to rename: `shikimori_id`
 * is `shikimori_id`. Two of them collide with keywords — `type` does not appear
 * here, but `on` and `out` do not either, and a collision that does arrive gets
 * a `r#` raw identifier rather than a renamed field, so the struct still reads
 * like the JSON.
 */

import { byTag, comment, type Api, type Field, type Op, type Ty } from '../spec';

/**
 * A type, as the module that is asking spells it.
 *
 * `where` is `'models'` inside `models.rs`, where a shape is a bare name, and
 * `'operations'` inside `operations.rs`, where it is `models::TitleStaff`.
 *
 * That is not tidiness. Every read becomes a builder struct named after its
 * operation, and `titleStaff` and the shape it answers with are both
 * `TitleStaff` — glob-importing the models would have the builder shadow the
 * shape, and the error lands on a line that mentions neither. Reaching through
 * a path means the collision cannot happen at all, for the operation that
 * collides today or the one that will.
 */
function ty(t: Ty, where: 'models' | 'operations' = 'models'): string {
	const path = where === 'operations' ? 'models::' : '';
	switch (t.k) {
		case 'string':
			return 'String';
		case 'int':
			return t.wide ? 'i64' : 'i32';
		case 'float':
			return 'f64';
		case 'bool':
			return 'bool';
		case 'array':
			return `Vec<${ty(t.of, where)}>`;
		case 'ref':
			return `${path}${t.name}`;
		case 'page':
			return `${path}Page<${ty(t.of, where)}>`;
		case 'unknown':
			return 'serde_json::Value';
	}
}

/** A type as a parameter takes it: a borrow where a borrow will do. */
function borrowed(t: Ty, where: 'models' | 'operations' = 'operations'): string {
	return t.k === 'string' ? '&str' : ty(t, where);
}

const KEYWORDS = new Set([
	'as', 'break', 'const', 'continue', 'crate', 'else', 'enum', 'extern', 'false', 'fn', 'for',
	'if', 'impl', 'in', 'let', 'loop', 'match', 'mod', 'move', 'mut', 'pub', 'ref', 'return',
	'self', 'Self', 'static', 'struct', 'super', 'trait', 'true', 'type', 'unsafe', 'use',
	'where', 'while', 'async', 'await', 'dyn', 'abstract', 'become', 'box', 'do', 'final',
	'macro', 'override', 'priv', 'typeof', 'unsized', 'virtual', 'yield'
]);

/** A field name Rust can hold, raw-identified rather than renamed. */
const ident = (name: string) => (KEYWORDS.has(name) ? `r#${name}` : name);

function docs(text: string | undefined, indent: string): string[] {
	return comment(text, '///', indent);
}

function structs(api: Api): string {
	const out: string[] = [
		'//! Generated from openapi.json by tools/generate.ts. Do not edit.',
		'',
		'use serde::{Deserialize, Serialize};',
		'',
		'/// The envelope every collection answers in.',
		'///',
		'/// `total` is there when the caller pages by offset and therefore has to know',
		'/// how far the list goes; a cursor-paged list leaves it out rather than paying',
		'/// for a second count nobody reads.',
		'#[derive(Debug, Clone, PartialEq, Deserialize, Serialize)]',
		'pub struct Page<T> {',
		'    pub items: Vec<T>,',
		'    #[serde(skip_serializing_if = "Option::is_none")]',
		'    pub total: Option<i64>,',
		'}',
		'',
		'impl<T> Page<T> {',
		'    pub fn len(&self) -> usize {',
		'        self.items.len()',
		'    }',
		'',
		'    pub fn is_empty(&self) -> bool {',
		'        self.items.is_empty()',
		'    }',
		'}',
		'',
		'impl<T> IntoIterator for Page<T> {',
		'    type Item = T;',
		'    type IntoIter = std::vec::IntoIter<T>;',
		'',
		'    fn into_iter(self) -> Self::IntoIter {',
		'        self.items.into_iter()',
		'    }',
		'}',
		''
	];

	for (const alias of api.aliases) {
		out.push(...docs(alias.doc, ''));
		out.push(`pub type ${alias.name} = ${ty(alias.ty)};`, '');
	}

	for (const model of api.models) {
		out.push(...docs(model.doc, ''));
		// `Default` on the bodies only: a read shape with a default is a shape
		// somebody can construct empty and then be surprised by.
		const isBody = model.name.endsWith('Body');
		out.push(
			`#[derive(Debug, Clone, PartialEq, Deserialize, Serialize${isBody ? ', Default' : ''})]`
		);
		out.push(`pub struct ${model.name} {`);
		for (const f of model.fields) out.push(...rsField(f));
		out.push('}', '');

		if (isBody) {
			// A builder, because a body with eight optional fields is otherwise
			// eight `None`s at every call site.
			out.push(`impl ${model.name} {`);
			const required = model.fields.filter((f) => !f.optional);
			const args = required.map((f) => `${ident(f.name)}: impl Into<${ty(f.ty)}>`);
			out.push(`    pub fn new(${args.join(', ')}) -> Self {`);
			out.push('        Self {');
			for (const f of required) out.push(`            ${ident(f.name)}: ${ident(f.name)}.into(),`);
			out.push('            ..Default::default()');
			out.push('        }');
			out.push('    }');
			for (const f of model.fields.filter((x) => x.optional)) {
				out.push('');
				out.push(...docs(f.doc, '    '));
				out.push(`    pub fn ${ident(f.name)}(mut self, value: impl Into<${ty(f.ty)}>) -> Self {`);
				out.push(`        self.${ident(f.name)} = Some(value.into());`);
				out.push('        self');
				out.push('    }');
			}
			out.push('}', '');
		}
	}

	out.push('/// Every scope this api offers.');
	out.push('pub const SCOPES: &[&str] = &[');
	for (const s of api.scopes) out.push(`    "${s.key}",`);
	out.push('];', '');
	return out.join('\n');
}

function rsField(f: Field): string[] {
	const out = docs(f.doc, '    ');
	if (f.optional) out.push('    #[serde(default, skip_serializing_if = "Option::is_none")]');
	out.push(`    pub ${ident(f.name)}: ${f.optional ? `Option<${ty(f.ty)}>` : ty(f.ty)},`);
	return out;
}

/**
 * One read, as a struct that collects its parameters and a `send` that spends
 * it.
 *
 * The alternative is a function with twelve `Option` arguments — `list_titles`
 * takes eleven — which is unreadable at the call site and breaks the day a
 * twelfth is added. A builder is also the only shape that can carry a paginator
 * without repeating every parameter twice.
 */
function ask(op: Op): string[] {
	const name = pascal(op.id);
	const out: string[] = [];
	const query = op.params.filter((p) => p.where === 'query');
	const path = op.params.filter((p) => p.where === 'path');
	const result = op.ok.ty ? ty(op.ok.ty, 'operations') : '()';

	out.push(...docs(op.doc ?? op.summary, ''));
	out.push('///');
	out.push(`/// \`${op.method} ${op.path}\`${op.scope ? `, needs \`${op.scope}\`` : ''}`);
	out.push('#[derive(Debug, Clone)]');
	out.push(`pub struct ${name}<'a> {`);
	out.push('    core: &\'a Core,');
	for (const p of path) out.push(`    ${ident(p.name)}: ${ty(p.ty, 'operations')},`);
	for (const p of query) {
		out.push(`    ${ident(p.name)}: Option<${ty(p.ty, 'operations')}>,`);
	}
	if (op.body) out.push(`    body: models::${op.body.model},`);
	out.push('}', '');

	out.push(`impl<'a> ${name}<'a> {`);
	const ctor = [
		...path.map((p) => `${ident(p.name)}: ${borrowed(p.ty)}`),
		...(op.body ? [`body: models::${op.body.model}`] : [])
	];
	out.push(`    pub(crate) fn new(core: &'a Core${ctor.length ? ', ' + ctor.join(', ') : ''}) -> Self {`);
	out.push('        Self {');
	out.push('            core,');
	for (const p of path) {
		// Field shorthand when the argument is already the field: `id,` rather
		// than `id: id,`. clippy's `redundant_field_names` is right about it, and
		// with `-D warnings` in CI a generated file was failing the build for
		// nineteen of them.
		out.push(
			p.ty.k === 'string'
				? `            ${ident(p.name)}: ${ident(p.name)}.to_owned(),`
				: `            ${ident(p.name)},`
		);
	}
	for (const p of query) out.push(`            ${ident(p.name)}: None,`);
	if (op.body) out.push('            body,');
	out.push('        }');
	out.push('    }');

	for (const p of query) {
		out.push('');
		out.push(...docs(p.doc, '    '));
		out.push(`    pub fn ${ident(p.name)}(mut self, value: impl Into<${ty(p.ty, 'operations')}>) -> Self {`);
		out.push(`        self.${ident(p.name)} = Some(value.into());`);
		out.push('        self');
		out.push('    }');
	}

	out.push('');
	out.push('    /// Send it.');
	out.push(`    pub async fn send(self) -> Result<${result}> {`);
	const url = op.path.replace(/\{(\w+)\}/g, (_, p) => `{}`);
	const fills = op.path.match(/\{(\w+)\}/g) ?? [];
	const filled = fills.map((m) => {
		const bare = m.slice(1, -1);
		const p = path.find((x) => x.name === bare)!;
		return p.ty.k === 'string' ? `urlencode(&self.${ident(bare)})` : `self.${ident(bare)}`;
	});
	out.push(
		filled.length
			? `        let path = format!("${url}", ${filled.join(', ')});`
			: `        let path = "${url}".to_owned();`
	);

	if (query.length) {
		out.push('        let mut query: Vec<(&str, String)> = Vec::new();');
		for (const p of query) {
			out.push(`        if let Some(value) = &self.${ident(p.name)} {`);
			out.push(`            query.push(("${p.name}", value.to_string()));`);
			out.push('        }');
		}
	}

	const args = [
		`Method::${op.method === 'GET' ? 'GET' : op.method === 'POST' ? 'POST' : op.method === 'PUT' ? 'PUT' : op.method === 'DELETE' ? 'DELETE' : 'PATCH'}`,
		'&path',
		query.length ? '&query' : '&[]',
		op.body ? 'Some(&self.body)' : 'None::<&()>'
	];
	if (op.ok.ty) {
		out.push(`        self.core.call(${args.join(', ')}).await`);
	} else {
		out.push(`        self.core.nothing(${args.join(', ')}).await`);
	}
	out.push('    }');

	if (op.pages && op.ok.ty?.k === 'page') {
		const item = ty(op.ok.ty.of, 'operations');
		out.push('');
		out.push('    /// Every row, a page at a time.');
		out.push('    ///');
		out.push('    /// Stops when a page comes back shorter than it asked for rather than');
		out.push('    /// when `total` is reached: the list can grow while it is being read, and');
		out.push('    /// counting against a number from the first page walks off the end.');
		// `Box::pin`, so what comes back is `Unpin` and a caller can write
		// `while let Some(row) = rows.try_next().await?` without knowing that
		// `try_unfold` produces something that has to be pinned first. A
		// paginator that makes its caller learn about pinning is a paginator
		// that has not saved them anything.
		out.push(
			`    pub fn stream(self) -> impl futures_core::Stream<Item = Result<${item}>> + Unpin + 'a {`
		);
		out.push('        let window = self.limit.unwrap_or(100);');
		out.push('        let start = self.offset.unwrap_or(0);');
		out.push('        Box::pin(');
		out.push('        futures_util::stream::try_unfold(');
		out.push('            (self, start, false),');
		out.push('            move |(ask, at, done)| async move {');
		out.push('                if done {');
		out.push('                    return Ok(None);');
		out.push('                }');
		out.push('                let page = ask.clone().limit(window).offset(at).send().await?;');
		out.push('                let got = page.items.len() as i64;');
		out.push('                let last = got < window;');
		out.push('                Ok(Some((page.items, (ask, at + got, last))))');
		out.push('            },');
		out.push('        )');
		out.push('        .map_ok(|rows| futures_util::stream::iter(rows.into_iter().map(Ok)))');
		out.push('        .try_flatten(),');
		out.push('        )');
		out.push('    }');
	}

	out.push('}', '');
	return out;
}

const pascal = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function operations(api: Api): string {
	const out: string[] = [
		'//! Generated from openapi.json by tools/generate.ts. Do not edit.',
		'',
		'#![allow(clippy::too_many_arguments)]',
		'',
		'use futures_util::TryStreamExt;',
		'use reqwest::Method;',
		'',
		'use crate::core::{urlencode, Core};',
		'use crate::error::Result;',
		'use crate::models;',
		''
	];

	for (const op of api.ops) out.push(...ask(op));

	for (const group of byTag(api)) {
		out.push(...docs(group.doc || group.tag, ''));
		out.push('#[derive(Debug, Clone)]');
		out.push(`pub struct ${pascal(group.tag)}<'a> {`);
		out.push('    pub(crate) core: &\'a Core,');
		out.push('}', '');
		out.push(`impl<'a> ${pascal(group.tag)}<'a> {`);
		for (const op of group.ops) {
			const path = op.params.filter((p) => p.where === 'path');
			const args = [
				...path.map((p) => `${ident(p.name)}: ${borrowed(p.ty)}`),
				...(op.body ? [`body: models::${op.body.model}`] : [])
			];
			const pass = [
				...path.map((p) => ident(p.name)),
				...(op.body ? ['body'] : [])
			];
			out.push('');
			out.push(...docs(op.summary, '    '));
			out.push(`    pub fn ${op.id.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase()}(&self${args.length ? ', ' + args.join(', ') : ''}) -> ${pascal(op.id)}<'a> {`);
			out.push(`        ${pascal(op.id)}::new(self.core${pass.length ? ', ' + pass.join(', ') : ''})`);
			out.push('    }');
		}
		out.push('}', '');
	}

	return out.join('\n');
}

function client(api: Api): string {
	const groups = byTag(api);
	const out: string[] = [
		'//! Generated from openapi.json by tools/generate.ts. Do not edit.',
		'',
		'use crate::operations::*;',
		'',
		'/// The namespaces a client carries.',
		'///',
		'/// Generated, so a tag the server adds arrives without anybody editing the',
		'/// client — and each one is a real method rather than a lookup, which is what',
		'/// an editor needs to complete it.',
		'impl crate::Acyka {'
	];
	for (const group of groups) {
		out.push('');
		out.push(...docs(group.doc || group.tag, '    '));
		out.push(`    pub fn ${group.tag}(&self) -> ${pascal(group.tag)}<'_> {`);
		out.push(`        ${pascal(group.tag)} { core: &self.core }`);
		out.push('    }');
	}
	out.push('}', '');
	return out.join('\n');
}

export function rust(api: Api): Record<string, string> {
	return {
		'packages/rust/src/models.rs': structs(api),
		'packages/rust/src/operations.rs': operations(api),
		'packages/rust/src/namespaces.rs': client(api)
	};
}
