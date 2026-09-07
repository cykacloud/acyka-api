/**
 * A type from the contract, written the way one language writes it.
 *
 * Six languages spell the same shape six ways, and a reference that showed only
 * one would be a reference five sixths of its readers have to translate in their
 * heads. The name of a shape stays the same in all six, so a link to it works
 * whichever language the reader is in.
 */

import type { Ty } from '$tools/spec';

export type Language = 'typescript' | 'python' | 'rust' | 'kotlin' | 'csharp' | 'cpp';

export const LANGUAGES: { id: Language; label: string; sample: string }[] = [
	{ id: 'typescript', label: 'TypeScript', sample: 'ts' },
	{ id: 'python', label: 'Python', sample: 'py' },
	{ id: 'rust', label: 'Rust', sample: 'rs' },
	{ id: 'kotlin', label: 'Kotlin', sample: 'kt' },
	{ id: 'csharp', label: 'C#', sample: 'cs' },
	{ id: 'cpp', label: 'C++', sample: 'cpp' }
];

/** How each language names the six things a field can be. */
const PRIMITIVES: Record<Language, Record<string, string>> = {
	typescript: { string: 'string', int: 'number', float: 'number', bool: 'boolean', json: 'unknown' },
	python: { string: 'str', int: 'int', float: 'float', bool: 'bool', json: 'Any' },
	rust: { string: 'String', int: 'i32', float: 'f64', bool: 'bool', json: 'Value' },
	kotlin: { string: 'String', int: 'Int', float: 'Double', bool: 'Boolean', json: 'JsonElement' },
	csharp: { string: 'string', int: 'int', float: 'double', bool: 'bool', json: 'JsonElement' },
	cpp: {
		string: 'std::string',
		int: 'std::int32_t',
		float: 'double',
		bool: 'bool',
		json: 'nlohmann::json'
	}
};

const WIDE: Partial<Record<Language, string>> = {
	rust: 'i64',
	kotlin: 'Long',
	csharp: 'long',
	cpp: 'std::int64_t'
};

function list(of: string, language: Language): string {
	switch (language) {
		case 'typescript':
			return `${of}[]`;
		case 'python':
			return `list[${of}]`;
		case 'rust':
			return `Vec<${of}>`;
		case 'kotlin':
			return `List<${of}>`;
		case 'csharp':
			return `IReadOnlyList<${of}>`;
		case 'cpp':
			return `std::vector<${of}>`;
	}
}

function page(of: string, language: Language): string {
	return language === 'cpp' ? `page<${of}>` : `Page<${of}>`;
}

/** A type, as one language writes it. */
export function written(t: Ty, language: Language): string {
	const primitives = PRIMITIVES[language];
	switch (t.k) {
		case 'string':
			return primitives.string;
		case 'int':
			return t.wide ? (WIDE[language] ?? primitives.int) : primitives.int;
		case 'float':
			return primitives.float;
		case 'bool':
			return primitives.bool;
		case 'unknown':
			return primitives.json;
		case 'array':
			return list(written(t.of, language), language);
		case 'page':
			return page(written(t.of, language), language);
		case 'ref':
			return t.name;
	}
}

/** How a language says "this may be absent". */
export function optional(inner: string, language: Language): string {
	switch (language) {
		case 'typescript':
			return `${inner} | undefined`;
		case 'python':
			return `${inner} | None`;
		case 'rust':
			return `Option<${inner}>`;
		case 'kotlin':
		case 'csharp':
			return `${inner}?`;
		case 'cpp':
			return `std::optional<${inner}>`;
	}
}

/** The shape a link should point at, where there is one. */
export function links(t: Ty): string | undefined {
	if (t.k === 'ref') return t.name;
	if (t.k === 'array' || t.k === 'page') return links(t.of);
	return undefined;
}

/** How a language spells a member of a shape. */
export function member(name: string, language: Language): string {
	switch (language) {
		case 'kotlin':
			return name.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase());
		case 'csharp': {
			const camel = name.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase());
			return camel.charAt(0).toUpperCase() + camel.slice(1);
		}
		default:
			// The other four are already snake_case, which is what the wire is —
			// so the reference shows the wire's own name and there is nothing to
			// translate.
			return name;
	}
}
