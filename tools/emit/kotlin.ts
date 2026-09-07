/**
 * Kotlin: data classes, suspending methods, and `kotlinx.serialization`.
 *
 * Three decisions.
 *
 * **`@SerialName` on every field, always.** The wire is snake_case and Kotlin is
 * camelCase, so this is the one language where the names genuinely differ — and
 * writing the annotation only where the two disagree would mean the day a field
 * arrives already camelCase, it silently has no annotation and nobody notices
 * until it does disagree. It is cheaper to be uniform.
 *
 * **Nullable with a default of `null`.** A field the server leaves out is
 * absent, and absent is a different answer from zero. `explicitNulls = false` on
 * the format keeps them out of what is sent, so an optional the caller did not
 * set does not become `"field": null` on the way out.
 *
 * **Suspending, not blocking, and no `Flow` return in the interface.** Every
 * read is a `suspend fun`; the paginators return `Flow`, which is what a
 * paginator is in this language.
 */

import { byTag, camel, comment, pascal, type Api, type Field, type Op, type Ty } from '../spec';

function ty(t: Ty): string {
	switch (t.k) {
		case 'string':
			return 'String';
		case 'int':
			return t.wide ? 'Long' : 'Int';
		case 'float':
			return 'Double';
		case 'bool':
			return 'Boolean';
		case 'array':
			return `List<${ty(t.of)}>`;
		case 'ref':
			return t.name;
		case 'page':
			return `Page<${ty(t.of)}>`;
		case 'unknown':
			return 'JsonElement';
	}
}

const HEADER = '// Generated from openapi.json by tools/generate.ts. Do not edit.';

function docs(text: string | undefined, indent: string): string[] {
	const lines = comment(text, ' *', indent);
	return lines.length ? [`${indent}/**`, ...lines, `${indent} */`] : [];
}

function models(api: Api): string {
	const out: string[] = [
		HEADER,
		'',
		'package cc.acyka.api',
		'',
		'import kotlinx.serialization.SerialName',
		'import kotlinx.serialization.Serializable',
		'import kotlinx.serialization.json.JsonElement',
		'',
		'/**',
		' * The envelope every collection answers in.',
		' *',
		' * `total` is there when the caller pages by offset and therefore has to know',
		' * how far the list goes; a cursor-paged list leaves it out rather than paying',
		' * for a second count nobody reads.',
		' */',
		'@Serializable',
		'public data class Page<T>(',
		'    public val items: List<T> = emptyList(),',
		'    public val total: Long? = null,',
		') : Iterable<T> {',
		'    override fun iterator(): Iterator<T> = items.iterator()',
		'',
		'    public val size: Int get() = items.size',
		'',
		'    public fun isEmpty(): Boolean = items.isEmpty()',
		'}',
		''
	];

	for (const alias of api.aliases) {
		out.push(...docs(alias.doc, ''));
		out.push(`public typealias ${alias.name} = ${ty(alias.ty)}`, '');
	}

	for (const model of api.models) {
		out.push(...docs(model.doc, ''));
		out.push('@Serializable');
		out.push(`public data class ${model.name}(`);
		// Required first, so a caller can use positional arguments for the ones
		// that are not optional — which is what reads well at a call site.
		for (const f of [...model.fields.filter((f) => !f.optional), ...model.fields.filter((f) => f.optional)]) {
			out.push(...ktField(f));
		}
		out.push(')', '');
	}

	out.push('/** Every scope this api offers. */');
	out.push('public val SCOPES: List<String> = listOf(');
	for (const s of api.scopes) out.push(`    "${s.key}",`);
	out.push(')', '');
	return out.join('\n');
}

function ktField(f: Field): string[] {
	const out: string[] = [];
	if (f.doc) out.push(`    /** ${f.doc.replace(/\s+/g, ' ').trim()} */`);
	out.push(`    @SerialName("${f.name}")`);
	out.push(`    public val ${camel(f.name)}: ${ty(f.ty)}${f.optional ? '? = null' : ''},`);
	return out;
}

/** One operation's parameters, as a signature. */
function signature(op: Op): string {
	const required: string[] = [];
	const optional: string[] = [];
	for (const p of op.params) {
		const arg = `${camel(p.name)}: ${ty(p.ty)}`;
		if (p.required) required.push(arg);
		else optional.push(`${arg}? = null`);
	}
	if (op.body) required.push(`body: ${op.body.model}`);
	return [...required, ...optional].join(', ');
}

function method(op: Op): string[] {
	const out: string[] = [];
	const result = op.ok.ty ? ty(op.ok.ty) : 'Unit';
	const name = camel(op.id);

	out.push(...docs(op.doc ?? op.summary, '    '));
	out.push(`    public suspend fun ${name}(${signature(op)}): ${result} {`);

	const path = op.path.replace(/\{(\w+)\}/g, (_, p) => `\${urlencode(${camel(p)}.toString())}`);
	const query = op.params.filter((p) => p.where === 'query');

	out.push(`        return core.call(`);
	out.push(`            method = "${op.method}",`);
	out.push(`            path = "${path}",`);
	if (query.length) {
		out.push('            query = listOf(');
		for (const q of query) out.push(`                "${q.name}" to ${camel(q.name)},`);
		out.push('            ),');
	}
	if (op.body) out.push('            body = body,');
	out.push('        )');
	out.push('    }');

	if (op.pages && op.ok.ty?.k === 'page') {
		const item = ty(op.ok.ty.of);
		const pass = op.params
			.filter((p) => p.name !== 'limit' && p.name !== 'offset')
			.map((p) => `${camel(p.name)} = ${camel(p.name)}`);
		out.push('');
		out.push('    /**');
		out.push(`     * Every row of [${name}], a page at a time.`);
		out.push('     *');
		out.push('     * Stops when a page comes back shorter than it asked for rather than');
		out.push('     * when `total` is reached: the list can grow while it is being read, and');
		out.push('     * counting against a number from the first page walks off the end.');
		out.push('     */');
		out.push(`    public fun ${name}All(${signature(op)}): Flow<${item}> = flow {`);
		out.push('        val window = limit ?: 100');
		out.push('        var at = offset ?: 0');
		out.push('        while (true) {');
		out.push(
			`            val page = ${name}(${['limit = window', 'offset = at', ...pass].join(', ')})`
		);
		out.push('            page.items.forEach { emit(it) }');
		out.push('            if (page.items.size < window) return@flow');
		out.push('            at += page.items.size');
		out.push('        }');
		out.push('    }');
	}

	return out;
}

function operations(api: Api): string {
	const out: string[] = [
		HEADER,
		'',
		'package cc.acyka.api',
		'',
		'import kotlinx.coroutines.flow.Flow',
		'import kotlinx.coroutines.flow.flow',
		'import kotlinx.serialization.json.JsonElement',
		''
	];

	for (const group of byTag(api)) {
		out.push(...docs(group.doc || group.tag, ''));
		out.push(`public class ${pascal(group.tag)} internal constructor(private val core: Core) {`);
		for (const op of group.ops) {
			out.push('');
			out.push(...method(op));
		}
		out.push('}', '');
	}
	return out.join('\n');
}

function namespaces(api: Api): string {
	const groups = byTag(api);
	const out: string[] = [
		HEADER,
		'',
		'package cc.acyka.api',
		'',
		'/**',
		' * The namespaces a client carries.',
		' *',
		' * Generated, so a tag the server adds arrives without anybody editing the',
		' * client — and each one is a real property rather than a lookup, which is what',
		' * an editor needs to complete it.',
		' */',
		'public abstract class Namespaces internal constructor(internal val core: Core) {'
	];
	for (const group of groups) {
		out.push('');
		out.push(...docs(group.doc || group.tag, '    '));
		out.push(`    public val ${camel(group.tag)}: ${pascal(group.tag)} = ${pascal(group.tag)}(core)`);
	}
	out.push('}', '');
	return out.join('\n');
}

const KOTLIN = 'packages/kotlin/src/main/kotlin/cc/acyka/api';

export function kotlin(api: Api): Record<string, string> {
	return {
		[`${KOTLIN}/Models.kt`]: models(api),
		[`${KOTLIN}/Operations.kt`]: operations(api),
		[`${KOTLIN}/Namespaces.kt`]: namespaces(api)
	};
}
