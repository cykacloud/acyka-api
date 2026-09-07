/**
 * C#: records, `System.Text.Json`, and `IAsyncEnumerable` for the pages.
 *
 * Three decisions.
 *
 * **Records rather than classes.** Everything a read answers with is immutable
 * and compared by value, which is what these are — and `with` gives a caller a
 * modified copy of a body without a builder.
 *
 * **`JsonPropertyName` on every property, always.** The wire is snake_case and
 * C# is PascalCase, so this is one of the two languages where the names
 * genuinely differ. Annotating only where they disagree means the day a field
 * arrives already PascalCase it silently has none, and nobody notices until it
 * does disagree.
 *
 * **Nullable reference types on, and an optional is `T?` with a default.** A
 * field the server leaves out is absent, and absent is a different answer from
 * zero — which the compiler will then make the caller acknowledge.
 */

import { byTag, comment, pascal, type Api, type Field, type Op, type Ty } from '../spec';

function ty(t: Ty): string {
	switch (t.k) {
		case 'string':
			return 'string';
		case 'int':
			return t.wide ? 'long' : 'int';
		case 'float':
			return 'double';
		case 'bool':
			return 'bool';
		case 'array':
			return `IReadOnlyList<${ty(t.of)}>`;
		case 'ref':
			return t.name;
		case 'page':
			return `Page<${ty(t.of)}>`;
		case 'unknown':
			return 'JsonElement';
	}
}

/** Whether a nullable of this type needs the `?` at all. */
function optional(t: Ty): string {
	return `${ty(t)}?`;
}

const HEADER = '// Generated from openapi.json by tools/generate.ts. Do not edit.';

function docs(text: string | undefined, indent: string): string[] {
	const lines = comment(text, '', indent);
	if (!lines.length) return [];
	return [
		`${indent}/// <summary>`,
		...lines.map((l) => `${indent}/// ${xml(l)}`),
		`${indent}/// </summary>`
	];
}

/** A property name C# can hold, and one that does not shadow its own type. */
function prop(name: string, inside: string): string {
	const cased = pascal(name);
	// A property may not be named the same as the type it is declared in, and
	// `Character.Character` would be exactly that — so the wire name wins and
	// the property gets an underscore rather than the type getting renamed.
	return cased === inside ? `${cased}_` : cased;
}

function models(api: Api): string {
	const out: string[] = [
		HEADER,
		'',
		'using System.Text.Json;',
		'using System.Text.Json.Serialization;',
		'',
		'namespace Acyka;',
		'',
		'/// <summary>',
		'/// The envelope every collection answers in.',
		'///',
		'/// <c>Total</c> is there when the caller pages by offset and therefore has to',
		'/// know how far the list goes; a cursor-paged list leaves it out rather than',
		'/// paying for a second count nobody reads.',
		'/// </summary>',
		'public sealed record Page<T>(',
		'    [property: JsonPropertyName("items")] IReadOnlyList<T> Items,',
		'    [property: JsonPropertyName("total")] long? Total = null',
		')',
		'{',
		'    /// <summary>',
		'    /// So <c>foreach</c> works on the page itself.',
		'    ///',
		'    /// A method and <b>not</b> <c>IEnumerable&lt;T&gt;</c>, which is what this',
		'    /// was first: <c>System.Text.Json</c> treats anything implementing that',
		'    /// interface as a collection, and then tries to read <c>{"items": …}</c>',
		'    /// as a JSON array and throws on every single answer. C# resolves',
		'    /// <c>foreach</c> against a public <c>GetEnumerator</c> without the',
		'    /// interface, so this costs nothing and the deserialiser sees an object.',
		'    /// For LINQ, use <c>Items</c>.',
		'    /// </summary>',
		'    public IEnumerator<T> GetEnumerator() => Items.GetEnumerator();',
		'',
		'    public int Count => Items.Count;',
		'}',
		''
	];

	for (const model of api.models) {
		const fields = [
			...model.fields.filter((f) => !f.optional),
			...model.fields.filter((f) => f.optional)
		];

		// A positional record's parameters cannot carry a doc comment of their
		// own — that is CS1587 — so a field's description becomes a `<param>` on
		// the record itself, which is where C# puts it and where an editor reads
		// it from.
		out.push(...docs(model.doc, ''));
		for (const f of fields) {
			if (!f.doc) continue;
			out.push(`/// <param name="${prop(f.name, model.name)}">${xml(f.doc)}</param>`);
		}
		out.push(`public sealed record ${model.name}(`);
		out.push(fields.map((f) => csField(f, model.name)).join(',\n'));
		out.push(');', '');
	}

	out.push('/// <summary>Every scope this api offers.</summary>');
	out.push('public static class Scopes');
	out.push('{');
	out.push('    public static readonly IReadOnlyList<string> All = new[]');
	out.push('    {');
	for (const s of api.scopes) out.push(`        "${s.key}",`);
	out.push('    };');
	out.push('}', '');
	return out.join('\n');
}

/** One line of XML doc, with the three characters that would break it escaped. */
function xml(text: string): string {
	return text
		.replace(/\s+/g, ' ')
		.trim()
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;');
}

function csField(f: Field, inside: string): string {
	const type = f.optional ? optional(f.ty) : ty(f.ty);
	const tail = f.optional ? ' = null' : '';
	return `    [property: JsonPropertyName("${f.name}")] ${type} ${prop(f.name, inside)}${tail}`;
}

/** One operation's parameters, as a signature. */
function signature(op: Op): string {
	const required: string[] = [];
	const rest: string[] = [];
	for (const p of op.params) {
		if (p.required) required.push(`${ty(p.ty)} ${camelArg(p.name)}`);
		else rest.push(`${optional(p.ty)} ${camelArg(p.name)} = null`);
	}
	if (op.body) required.push(`${op.body.model} body`);
	// The cancellation token goes last, as every C# API puts it.
	return [...required, ...rest, 'CancellationToken cancellationToken = default'].join(', ');
}

const RESERVED = new Set([
	'abstract','as','base','bool','break','byte','case','catch','char','checked','class','const',
	'continue','decimal','default','delegate','do','double','else','enum','event','explicit',
	'extern','false','finally','fixed','float','for','foreach','goto','if','implicit','in','int',
	'interface','internal','is','lock','long','namespace','new','null','object','operator','out',
	'override','params','private','protected','public','readonly','ref','return','sbyte','sealed',
	'short','sizeof','stackalloc','static','string','struct','switch','this','throw','true','try',
	'typeof','uint','ulong','unchecked','unsafe','ushort','using','virtual','void','volatile','while'
]);

/** A parameter name, kept as the wire spells it unless C# cannot hold it. */
function camelArg(name: string): string {
	const lower = name.replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase());
	return RESERVED.has(lower) ? `@${lower}` : lower;
}

function method(op: Op): string[] {
	const out: string[] = [];
	const result = op.ok.ty ? `Task<${ty(op.ok.ty)}>` : 'Task';
	const name = pascal(op.id) + 'Async';

	out.push(...docs(op.doc ?? op.summary, '    '));
	out.push(`    /// <remarks><c>${op.method} ${op.path}</c>${op.scope ? `, needs <c>${op.scope}</c>` : ''}</remarks>`);
	out.push(`    public ${result} ${name}(${signature(op)})`);
	out.push('    {');

	const path = op.path.replace(/\{(\w+)\}/g, (_, p) => `{Core.Escape(${camelArg(p)}.ToString()!)}`);
	const query = op.params.filter((p) => p.where === 'query');

	if (query.length) {
		out.push('        var query = new (string, object?)[]');
		out.push('        {');
		for (const q of query) out.push(`            ("${q.name}", ${camelArg(q.name)}),`);
		out.push('        };');
	}

	const args = [
		`HttpMethod.${op.method === 'GET' ? 'Get' : op.method === 'POST' ? 'Post' : op.method === 'PUT' ? 'Put' : op.method === 'DELETE' ? 'Delete' : 'Patch'}`,
		`$"${path}"`,
		query.length ? 'query' : 'null',
		op.body ? 'body' : 'null',
		'cancellationToken'
	];
	out.push(
		op.ok.ty
			? `        return _core.CallAsync<${ty(op.ok.ty)}>(${args.join(', ')});`
			: `        return _core.NothingAsync(${args.join(', ')});`
	);
	out.push('    }');

	if (op.pages && op.ok.ty?.k === 'page') {
		const item = ty(op.ok.ty.of);
		const pass = op.params
			.filter((p) => p.name !== 'limit' && p.name !== 'offset')
			.map((p) => `${camelArg(p.name)}: ${camelArg(p.name)}`);
		out.push('');
		out.push('    /// <summary>');
		out.push(`    /// Every row of <see cref="${name}"/>, a page at a time.`);
		out.push('    ///');
		out.push('    /// Stops when a page comes back shorter than it asked for rather than');
		out.push('    /// when <c>Total</c> is reached: the list can grow while it is being read,');
		out.push('    /// and counting against a number from the first page walks off the end.');
		out.push('    /// </summary>');
		out.push(
			`    public async IAsyncEnumerable<${item}> ${pascal(op.id)}AllAsync(${signature(op).replace('CancellationToken cancellationToken = default', '[EnumeratorCancellation] CancellationToken cancellationToken = default')})`
		);
		out.push('    {');
		out.push('        var window = limit ?? 100;');
		out.push('        var at = offset ?? 0;');
		out.push('        while (true)');
		out.push('        {');
		out.push(
			`            var page = await ${name}(${['limit: window', 'offset: at', ...pass, 'cancellationToken: cancellationToken'].join(', ')}).ConfigureAwait(false);`
		);
		out.push('            foreach (var row in page.Items)');
		out.push('            {');
		out.push('                yield return row;');
		out.push('            }');
		out.push('            if (page.Items.Count < window)');
		out.push('            {');
		out.push('                yield break;');
		out.push('            }');
		out.push('            at += page.Items.Count;');
		out.push('        }');
		out.push('    }');
	}

	return out;
}

function operations(api: Api): string {
	const out: string[] = [
		HEADER,
		'',
		'using System.Runtime.CompilerServices;',
		'using System.Text.Json;',
		'',
		'namespace Acyka;',
		''
	];

	for (const group of byTag(api)) {
		out.push(...docs(group.doc || group.tag, ''));
		out.push(`public sealed class ${pascal(group.tag)}Api`);
		out.push('{');
		out.push('    private readonly Core _core;');
		out.push('');
		out.push(`    internal ${pascal(group.tag)}Api(Core core) => _core = core;`);
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
		'namespace Acyka;',
		'',
		'/// <summary>',
		'/// The namespaces a client carries.',
		'///',
		'/// Generated, so a tag the server adds arrives without anybody editing the',
		'/// client — and each one is a real property rather than a lookup, which is what',
		'/// an editor needs to complete it.',
		'/// </summary>',
		'public partial class AcykaClient',
		'{'
	];
	for (const group of groups) {
		out.push(...docs(group.doc || group.tag, '    '));
		out.push(`    public ${pascal(group.tag)}Api ${pascal(group.tag)} { get; private set; } = null!;`);
		out.push('');
	}
	out.push('    private void Attach()');
	out.push('    {');
	for (const group of groups) {
		out.push(`        ${pascal(group.tag)} = new ${pascal(group.tag)}Api(Core);`);
	}
	out.push('    }');
	out.push('}', '');
	return out.join('\n');
}

/**
 * The aliases, as global usings.
 *
 * C# has no newtype, so `PostId` can only be `string` — but a `global using`
 * keeps the name in every signature that mentions it, which is where it is
 * worth having: `PostId` in a parameter list says "a string, and specifically
 * this one" in a way `string` cannot.
 *
 * Their own file because a `global using` has to come before every namespace
 * declaration in the file it is in, and `Models.cs` opens with one.
 */
function aliases(api: Api): string {
	const out: string[] = [HEADER, ''];
	for (const alias of api.aliases) {
		if (alias.doc) {
			// `//` rather than `///`: a global using is not a member and cannot
			// carry a doc comment, so this is a note for whoever reads the file.
			out.push(...comment(alias.doc, '//'));
		}
		out.push(`global using ${alias.name} = ${ty(alias.ty)};`, '');
	}
	return out.join('\n');
}

export function csharp(api: Api): Record<string, string> {
	return {
		'packages/csharp/src/Acyka/Generated/Aliases.cs': aliases(api),
		'packages/csharp/src/Acyka/Generated/Models.cs': models(api),
		'packages/csharp/src/Acyka/Generated/Operations.cs': operations(api),
		'packages/csharp/src/Acyka/Generated/Namespaces.cs': namespaces(api)
	};
}
