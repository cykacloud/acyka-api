/**
 * C++: structs, `nlohmann::json` conversions, and one method per operation.
 *
 * Four decisions, and each is about C++ rather than about the api.
 *
 * **Header-only.** A client library that has to be built and linked is a client
 * library whose users argue with their build system before they write a line.
 * One `#include <acyka/acyka.hpp>` and a `FetchContent` block is the whole
 * integration.
 *
 * **`std::optional<T>` for a field the server may leave out.** Absent is a
 * different answer from zero, and a `T` with a default would collapse the two —
 * which is the one thing this api's own rules say a client must not do.
 *
 * **`from_json` / `to_json` free functions rather than a macro.** The
 * `NLOHMANN_DEFINE_TYPE` macros cannot express "absent stays absent": the
 * non-intrusive one throws on a missing key and the `WITH_DEFAULT` one turns it
 * into a zero. Written out, an absent key leaves the optional empty and a `to_json`
 * skips it — so a body carries only what the caller set.
 *
 * **Names as the wire spells them.** `shikimori_id`, not `shikimoriId`: it is
 * already C++'s own convention, so there is nothing to rename in either
 * direction.
 */

import { byTag, comment, pascal, type Api, type Field, type Op, type Ty } from '../spec';

function ty(t: Ty): string {
	switch (t.k) {
		case 'string':
			return 'std::string';
		case 'int':
			return t.wide ? 'std::int64_t' : 'std::int32_t';
		case 'float':
			return 'double';
		case 'bool':
			return 'bool';
		case 'array':
			return `std::vector<${ty(t.of)}>`;
		case 'ref':
			return t.name;
		case 'page':
			return `page<${ty(t.of)}>`;
		case 'unknown':
			return 'nlohmann::json';
	}
}

const HEADER = '// Generated from openapi.json by tools/generate.ts. Do not edit.';

function docs(text: string | undefined, indent: string): string[] {
	return comment(text, '///', indent);
}

const KEYWORDS = new Set([
	'alignas','alignof','and','asm','auto','bitand','bitor','bool','break','case','catch','char',
	'class','const','consteval','constexpr','constinit','const_cast','continue','co_await',
	'co_return','co_yield','decltype','default','delete','do','double','dynamic_cast','else','enum',
	'explicit','export','extern','false','float','for','friend','goto','if','inline','int','long',
	'mutable','namespace','new','noexcept','not','nullptr','operator','or','private','protected',
	'public','register','reinterpret_cast','requires','return','short','signed','sizeof','static',
	'static_assert','static_cast','struct','switch','template','this','thread_local','throw','true',
	'try','typedef','typeid','typename','union','unsigned','using','virtual','void','volatile',
	'wchar_t','while','xor'
]);

/** A member name C++ can hold. A keyword gets a trailing underscore. */
const ident = (name: string) => (KEYWORDS.has(name) ? `${name}_` : name);

function models(api: Api): string {
	const out: string[] = [
		HEADER,
		'#pragma once',
		'',
		'#include <cstdint>',
		'#include <optional>',
		'#include <string>',
		'#include <vector>',
		'',
		'#include <nlohmann/json.hpp>',
		'',
		'namespace acyka {',
		'',
		'/// The envelope every collection answers in.',
		'///',
		'/// `total` is there when the caller pages by offset and therefore has to know',
		'/// how far the list goes; a cursor-paged list leaves it out rather than paying',
		'/// for a second count nobody reads.',
		'template <typename T>',
		'struct page {',
		'    std::vector<T> items;',
		'    std::optional<std::int64_t> total;',
		'',
		'    auto begin() const { return items.begin(); }',
		'    auto end() const { return items.end(); }',
		'    std::size_t size() const { return items.size(); }',
		'    bool empty() const { return items.empty(); }',
		'};',
		'',
		'template <typename T>',
		'void from_json(const nlohmann::json& raw, page<T>& out) {',
		'    out.items = raw.value("items", std::vector<T>{});',
		'    if (raw.contains("total") && !raw.at("total").is_null()) {',
		'        out.total = raw.at("total").get<std::int64_t>();',
		'    }',
		'}',
		''
	];

	for (const alias of api.aliases) {
		out.push(...docs(alias.doc, ''));
		out.push(`using ${alias.name} = ${ty(alias.ty)};`, '');
	}

	// Declared before defined, so a shape that mentions another does not depend
	// on the order the document happened to list them in.
	out.push('// Forward declarations, so the order the document lists these in does not');
	out.push('// decide whether a shape may mention another.');
	for (const model of api.models) out.push(`struct ${model.name};`);
	out.push('');

	for (const model of api.models) {
		out.push(...docs(model.doc, ''));
		out.push(`struct ${model.name} {`);
		for (const f of model.fields) {
			out.push(...docs(f.doc, '    '));
			out.push(`    ${f.optional ? `std::optional<${ty(f.ty)}>` : ty(f.ty)} ${ident(f.name)}${f.optional ? '' : '{}'};`);
		}
		out.push('};', '');
	}

	// Every conversion is *declared* before any is defined.
	//
	// These are ordinary functions found by ordinary lookup, so a `to_json` that
	// writes a `std::vector<Voice>` needs `to_json(Voice)` to be visible where it
	// is written — and the document lists `TitleCharacter` before `Voice`. Without
	// this the error lands on a line about `raw["voices"]` and says nothing about
	// ordering.
	out.push('// Declared before any is defined, so a shape that contains another does not');
	out.push('// depend on the order the document happened to list them in.');
	for (const model of api.models) {
		out.push(`inline void from_json(const nlohmann::json& raw, ${model.name}& out);`);
		out.push(`inline void to_json(nlohmann::json& raw, const ${model.name}& in);`);
	}
	out.push('');

	out.push('/// Reading one optional field, leaving it empty when the key is absent.');
	out.push('///');
	out.push('/// `null` is treated as absent as well, and deliberately: this api sends a');
	out.push('/// field it has nothing to say about as a missing key, but a `null` from a');
	out.push('/// proxy or an older build means the same thing to a reader and there is');
	out.push('/// nothing useful to do differently.');
	out.push('template <typename T>');
	out.push('inline void read_opt(const nlohmann::json& raw, const char* key, std::optional<T>& out) {');
	out.push('    if (raw.contains(key) && !raw.at(key).is_null()) {');
	out.push('        out = raw.at(key).get<T>();');
	out.push('    } else {');
	out.push('        out.reset();');
	out.push('    }');
	out.push('}');
	out.push('');

	for (const model of api.models) {
		out.push(`inline void from_json(const nlohmann::json& raw, ${model.name}& out) {`);
		for (const f of model.fields) {
			if (f.optional) {
				out.push(`    read_opt(raw, "${f.name}", out.${ident(f.name)});`);
			} else {
				// `at` rather than `value`: a required field that is missing is a
				// server that changed shape, and a silent default would turn that
				// into a wrong answer somewhere later and quieter.
				out.push(`    out.${ident(f.name)} = raw.at("${f.name}").get<${ty(f.ty)}>();`);
			}
		}
		out.push('}', '');

		out.push(`inline void to_json(nlohmann::json& raw, const ${model.name}& in) {`);
		out.push('    raw = nlohmann::json::object();');
		for (const f of model.fields) {
			if (f.optional) {
				// An optional the caller did not set is left out, not sent as
				// `null`: absent and null are different answers on this api.
				out.push(`    if (in.${ident(f.name)}.has_value()) raw["${f.name}"] = *in.${ident(f.name)};`);
			} else {
				out.push(`    raw["${f.name}"] = in.${ident(f.name)};`);
			}
		}
		out.push('}', '');
	}

	out.push('/// Every scope this api offers.');
	out.push('inline const std::vector<std::string>& scopes() {');
	out.push('    static const std::vector<std::string> all = {');
	for (const s of api.scopes) out.push(`        "${s.key}",`);
	out.push('    };');
	out.push('    return all;');
	out.push('}');
	out.push('');
	out.push('}  // namespace acyka');
	return out.join('\n');
}

/** One operation's parameters, as a struct a caller fills in. */
function request(op: Op): string[] {
	const out: string[] = [];
	const name = `${pascal(op.id)}Request`;
	const path = op.params.filter((p) => p.where === 'path');
	const query = op.params.filter((p) => p.where === 'query');
	if (!path.length && !query.length && !op.body) return out;

	out.push(`/// What \`${op.id}\` is asked with.`);
	out.push(`struct ${name} {`);
	for (const p of path) {
		out.push(...docs(p.doc, '    '));
		out.push(`    ${ty(p.ty)} ${ident(p.name)}{};`);
	}
	for (const p of query) {
		out.push(...docs(p.doc, '    '));
		out.push(`    std::optional<${ty(p.ty)}> ${ident(p.name)};`);
	}
	if (op.body) {
		out.push('    /// the request body');
		out.push(`    ${op.body.model} body{};`);
	}
	out.push('};', '');
	return out;
}

function method(op: Op): string[] {
	const out: string[] = [];
	const result = op.ok.ty ? ty(op.ok.ty) : 'void';
	const shape = op.params.length || op.body ? `${pascal(op.id)}Request` : null;
	const name = op.id.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();

	out.push(...docs(op.doc ?? op.summary, '    '));
	out.push('    ///');
	out.push(`    /// \`${op.method} ${op.path}\`${op.scope ? `, needs \`${op.scope}\`` : ''}`);
	out.push(`    ${result} ${name}(${shape ? `const ${shape}& in` : ''}) const {`);

	const path = op.params.filter((p) => p.where === 'path');
	const query = op.params.filter((p) => p.where === 'query');

	if (path.length) {
		out.push(`        std::string path = "${op.path}";`);
		for (const p of path) {
			const value =
				p.ty.k === 'string' ? `in.${ident(p.name)}` : `std::to_string(in.${ident(p.name)})`;
			out.push(`        replace_in(path, "{${p.name}}", detail::urlencode(${value}));`);
		}
	} else {
		out.push(`        const std::string path = "${op.path}";`);
	}

	if (query.length) {
		out.push('        query_string query;');
		for (const p of query) out.push(`        query.add("${p.name}", in.${ident(p.name)});`);
	}

	const args = [
		`"${op.method}"`,
		'path',
		query.length ? 'query.str()' : 'std::string{}',
		op.body ? 'nlohmann::json(in.body).dump()' : 'std::string{}',
		op.body ? 'true' : 'false'
	];

	if (op.ok.ty) {
		out.push(`        return core_->call(${args.join(', ')}).get<${result}>();`);
	} else {
		out.push(`        core_->call(${args.join(', ')});`);
	}
	out.push('    }');

	if (op.pages && op.ok.ty?.k === 'page') {
		const item = ty(op.ok.ty.of);
		out.push('');
		out.push('    /// Every row, gathered a page at a time.');
		out.push('    ///');
		out.push('    /// Stops when a page comes back shorter than it asked for rather than');
		out.push('    /// when `total` is reached: the list can grow while it is being read, and');
		out.push('    /// counting against a number from the first page walks off the end.');
		out.push('    ///');
		out.push('    /// A vector rather than a lazy range, and that is a choice: a coroutine');
		out.push('    /// generator would need C++23 or a dependency, and a callback would put');
		out.push('    /// the caller inside somebody else\'s loop. The `on_page` hook is there');
		out.push('    /// for whoever cannot hold the whole list.');
		out.push(
			`    std::vector<${item}> ${name}_all(${shape ? `${shape} in` : ''}${shape ? ', ' : ''}const std::function<bool(const page<${item}>&)>& on_page = {}) const {`
		);
		out.push(`        std::vector<${item}> all;`);
		out.push('        const std::int64_t window = in.limit.value_or(100);');
		out.push('        std::int64_t at = in.offset.value_or(0);');
		out.push('        for (;;) {');
		out.push('            in.limit = window;');
		out.push('            in.offset = at;');
		out.push(`            auto got = ${name}(in);`);
		out.push('            const auto seen = static_cast<std::int64_t>(got.items.size());');
		out.push('            if (on_page && !on_page(got)) return all;');
		out.push('            all.insert(all.end(), got.items.begin(), got.items.end());');
		out.push('            if (seen < window) return all;');
		out.push('            at += seen;');
		out.push('        }');
		out.push('    }');
	}

	return out;
}

function operations(api: Api): string {
	const out: string[] = [
		HEADER,
		'#pragma once',
		'',
		'#include <functional>',
		'#include <memory>',
		'#include <optional>',
		'#include <string>',
		'#include <vector>',
		'',
		'#include <nlohmann/json.hpp>',
		'',
		'#include "acyka/core.hpp"',
		'#include "acyka/models.hpp"',
		'',
		'namespace acyka {',
		'',
		'/// One `{key}` in a path, replaced with what the caller gave.',
		'inline void replace_in(std::string& text, std::string_view what, const std::string& with) {',
		'    const auto at = text.find(what);',
		'    if (at != std::string::npos) text.replace(at, what.size(), with);',
		'}',
		''
	];

	for (const op of api.ops) out.push(...request(op));

	for (const group of byTag(api)) {
		out.push(...docs(group.doc || group.tag, ''));
		out.push(`class ${group.tag}_api {`);
		out.push(' public:');
		out.push(`    explicit ${group.tag}_api(std::shared_ptr<core> core) : core_(std::move(core)) {}`);
		for (const op of group.ops) {
			out.push('');
			out.push(...method(op));
		}
		out.push('');
		out.push(' private:');
		out.push('    std::shared_ptr<core> core_;');
		out.push('};', '');
	}

	out.push('}  // namespace acyka');
	return out.join('\n');
}

function client(api: Api): string {
	const groups = byTag(api);
	const out: string[] = [
		HEADER,
		'#pragma once',
		'',
		'#include <memory>',
		'#include <utility>',
		'',
		'#include "acyka/operations.hpp"',
		'',
		'namespace acyka {',
		'',
		'/// The namespaces a client carries.',
		'///',
		'/// Generated, so a tag the server adds arrives without anybody editing the',
		'/// client — and each one is a real member rather than a lookup, which is what',
		'/// an editor needs to complete it.',
		'class namespaces {',
		'    // Declared before the namespaces, because a member initialiser list runs',
		'    // in declaration order and initialising this last would be a warning',
		'    // about a field being set after the ones that were listed first.',
		'    std::shared_ptr<core> core_;',
		'',
		' public:',
		'    explicit namespaces(std::shared_ptr<core> core)',
		'        : core_(core),'
	];
	out.push(
		groups.map((g) => `          ${g.tag}(core)`).join(',\n') + ' {}'
	);
	out.push('');
	out.push('    /// The transport these were built over.');
	out.push('    ///');
	out.push('    /// Held here rather than only in the client, so `pace()` can be asked');
	out.push('    /// without reaching through a namespace to find it.');
	out.push('    const std::shared_ptr<core>& shared_core() const { return core_; }');
	out.push('');
	for (const group of groups) {
		out.push(...docs(group.doc || group.tag, '    '));
		out.push(`    ${group.tag}_api ${group.tag};`);
	}
	out.push('};', '');
	out.push('}  // namespace acyka');
	return out.join('\n');
}

const CPP = 'packages/cpp/include/acyka';

export function cpp(api: Api): Record<string, string> {
	return {
		[`${CPP}/models.hpp`]: models(api),
		[`${CPP}/operations.hpp`]: operations(api),
		[`${CPP}/namespaces.hpp`]: client(api)
	};
}
