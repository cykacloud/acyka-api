/**
 * A call to one operation, in each of the six languages.
 *
 * Generated from the contract rather than written by hand, and that is the only
 * way this stays true: forty-three operations times six languages is two hundred
 * and fifty-eight snippets, and a hand-written set of those is a set where a
 * renamed parameter is wrong in a hundred places and right in nowhere anybody
 * checks.
 *
 * They are also **complete programs where a language needs one**. A snippet that
 * begins in the middle is a snippet a reader has to guess the imports for, and
 * guessing imports is most of what makes an unfamiliar language unpleasant.
 */

import type { Op, Param } from '$tools/spec';
import { LANGUAGES, member, type Language } from '$lib/type';

/** A plausible value for one parameter, so the snippet is copy-pasteable. */
function example(p: Param): string | number | boolean {
	if (p.name === 'id' || p.name === 'shikimori_id') return 52991;
	if (p.name === 'nick' || p.name === 'nickname') return 'someone';
	if (p.name === 'code') return 'AbCdEf';
	if (p.name === 'q') return 'frieren';
	if (p.name === 'limit') return 10;
	if (p.name === 'lang') return 'en';
	if (p.name === 'genre') return 'Drama';
	if (p.name === 'status') return 'watching';
	if (p.ty.k === 'string') return 'value';
	if (p.ty.k === 'bool') return true;
	if (p.ty.k === 'float') return 8;
	return 1;
}

const quoted = (value: string | number | boolean, language: Language) => {
	if (typeof value === 'boolean') {
		return language === 'python' ? (value ? 'True' : 'False') : String(value);
	}
	if (typeof value === 'number') return String(value);
	return `"${value}"`;
};

/**
 * The arguments a snippet shows.
 *
 * Every required one, and up to two of the optional ones — a snippet listing
 * eleven filters teaches nothing except that there are eleven, and the
 * reference table above it is where they belong.
 */
function shown(op: Op): Param[] {
	const required = op.params.filter((p) => p.required);
	const optional = op.params.filter((p) => !p.required && p.name !== 'offset');
	return [...required, ...optional.slice(0, 2)];
}

function bodyFields(op: Op): string[] {
	// The body's own required fields are not in the contract's parameter list, so
	// a snippet shows the shape's name and lets the reference below say what is
	// in it — inventing values for eight fields would be a snippet that looks
	// authoritative and is not.
	return op.body ? [op.body.model] : [];
}

const method = (op: Op) => op.id;

function typescript(op: Op): string {
	const args = shown(op)
		.map((p) => `${p.name}: ${quoted(example(p), 'typescript')}`)
		.concat(op.body ? [`body: { /* ${op.body.model} */ }`] : []);
	const call = args.length
		? `await acyka.${op.tag}.${method(op)}({\n  ${args.join(',\n  ')}\n})`
		: `await acyka.${op.tag}.${method(op)}()`;

	return `import { Acyka } from '@acyka/api';

const acyka = Acyka.app({
  clientId: process.env.ACYKA_ID!,
  clientSecret: process.env.ACYKA_SECRET!
});

const answer = ${call};
console.log(answer);`;
}

function python(op: Op): string {
	const args = shown(op)
		.map((p) => `${p.name}=${quoted(example(p), 'python')}`)
		.concat(op.body ? [`body=${op.body.model}(...)`] : []);
	const name = op.id.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
	const call = args.length
		? `acyka.${op.tag}.${name}(\n        ${args.join(',\n        ')}\n    )`
		: `acyka.${op.tag}.${name}()`;

	return `import os
from acyka import Acyka

with Acyka.app(
    client_id=os.environ["ACYKA_ID"],
    client_secret=os.environ["ACYKA_SECRET"],
) as acyka:
    answer = ${call}
    print(answer)`;
}

function rust(op: Op): string {
	const name = op.id.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
	const path = op.params.filter((p) => p.where === 'path');
	const query = shown(op).filter((p) => p.where === 'query');

	const opening = [
		...path.map((p) => quoted(example(p), 'rust')),
		...(op.body ? [`${op.body.model}::new(/* … */)`] : [])
	].join(', ');

	const chained = query.map((p) => `\n        .${p.name}(${quoted(example(p), 'rust')})`).join('');

	return `use acyka::Acyka;

#[tokio::main]
async fn main() -> acyka::Result<()> {
    let acyka = Acyka::app(env!("ACYKA_ID"), env!("ACYKA_SECRET"))?;

    let answer = acyka
        .${op.tag}()
        .${name}(${opening})${chained}
        .send()
        .await?;

    println!("{answer:?}");
    Ok(())
}`;
}

function kotlin(op: Op): string {
	const args = shown(op)
		.map((p) => `${member(p.name, 'kotlin')} = ${quoted(example(p), 'kotlin')}`)
		.concat(op.body ? [`body = ${op.body.model}(/* … */)`] : []);
	const camel = op.id;
	const call = args.length
		? `acyka.${op.tag}.${camel}(\n        ${args.join(',\n        ')}\n    )`
		: `acyka.${op.tag}.${camel}()`;

	return `import cc.acyka.api.Acyka

suspend fun main() {
    val acyka = Acyka.app(
        clientId = System.getenv("ACYKA_ID"),
        clientSecret = System.getenv("ACYKA_SECRET"),
    )

    val answer = ${call}
    println(answer)
}`;
}

function csharp(op: Op): string {
	const args = shown(op)
		.map((p) => `${p.name.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase())}: ${quoted(example(p), 'csharp')}`)
		.concat(op.body ? [`body: new ${op.body.model}(/* … */)`] : []);
	const name = `${op.id.charAt(0).toUpperCase()}${op.id.slice(1)}Async`;
	const call = args.length
		? `await acyka.${op.tag.charAt(0).toUpperCase()}${op.tag.slice(1)}.${name}(\n    ${args.join(',\n    ')})`
		: `await acyka.${op.tag.charAt(0).toUpperCase()}${op.tag.slice(1)}.${name}()`;

	return `using Acyka;

var acyka = AcykaClient.App(
    Environment.GetEnvironmentVariable("ACYKA_ID")!,
    Environment.GetEnvironmentVariable("ACYKA_SECRET")!);

var answer = ${call};
Console.WriteLine(answer);`;
}

function cpp(op: Op): string {
	const name = op.id.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
	const request = `${op.id.charAt(0).toUpperCase()}${op.id.slice(1)}Request`;
	const has = op.params.length > 0 || !!op.body;

	const sets = shown(op)
		.map((p) => `    asking.${p.name} = ${quoted(example(p), 'cpp')};`)
		.join('\n');

	return `#include <acyka/acyka.hpp>
#include <iostream>

int main() {
    auto acyka = acyka::client::app(std::getenv("ACYKA_ID"), std::getenv("ACYKA_SECRET"));
${has ? `\n    acyka::${request} asking;\n${sets}\n` : ''}
    const auto answer = acyka.${op.tag}.${name}(${has ? 'asking' : ''});
    std::cout << "ok\\n";
}`;
}

const writers: Record<Language, (op: Op) => string> = {
	typescript,
	python,
	rust,
	kotlin,
	csharp,
	cpp
};

/** A `curl` for the same call, which is the one every reader can check. */
export function curl(op: Op, base = 'https://api.acyka.cc'): string {
	let path = op.path;
	for (const p of op.params.filter((x) => x.where === 'path')) {
		path = path.replace(`{${p.name}}`, String(example(p)));
	}

	const query = shown(op)
		.filter((p) => p.where === 'query')
		.map((p) => `${p.name}=${encodeURIComponent(String(example(p)))}`)
		.join('&');

	const lines = [`curl ${base}${path}${query ? `?${query}` : ''} \\`];
	if (op.method !== 'GET') lines.push(`  -X ${op.method} \\`);
	lines.push(`  -H "Authorization: Bearer $ACYKA_TOKEN"${op.body ? ' \\' : ''}`);
	if (op.body) {
		lines.push(`  -H "Content-Type: application/json" \\`);
		lines.push(`  -d '{ }'`);
	}
	return lines.join('\n');
}

/** Every sample for one operation, keyed by language. */
export function samples(op: Op): { id: Language | 'curl'; label: string; code: string }[] {
	return [
		{ id: 'curl' as const, label: 'curl', code: curl(op) },
		...LANGUAGES.map((language) => ({
			id: language.id,
			label: language.label,
			code: writers[language.id](op)
		}))
	];
}

export { bodyFields };
