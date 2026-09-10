/**
 * The one version, read out of the six places that each declare it.
 *
 * Six libraries in six languages have six build systems and no shared notion of
 * a version, so the number lives six times. That is survivable; what is not is
 * publishing five of them as 1.2.0 and the sixth as 1.1.0 because a bump was
 * missed — the six are generated from one contract and a caller reasonably
 * assumes matching versions describe the same api.
 *
 * Run it with no argument to print what each package says. Run it with a version
 * — `bun .github/scripts/versions.ts 1.2.0` — and it exits non-zero unless all
 * six say exactly that, which is what the release workflow does with the tag.
 */

const root = new URL('../..', import.meta.url).pathname;

type Where = { name: string; file: string; find: (text: string) => string | undefined };

const places: Where[] = [
	{
		name: 'typescript',
		file: 'packages/typescript/package.json',
		find: (t) => JSON.parse(t).version,
	},
	{
		name: 'python',
		file: 'packages/python/pyproject.toml',
		// The first `version = "…"` under `[project]`. Read with a regex rather
		// than a TOML parser because this is the only field anything here wants
		// and a dependency for it would be the largest thing in the directory.
		find: (t) => /^version\s*=\s*"([^"]+)"/m.exec(t)?.[1],
	},
	{
		name: 'rust',
		file: 'packages/rust/Cargo.toml',
		find: (t) => /^version\s*=\s*"([^"]+)"/m.exec(t)?.[1],
	},
	{
		name: 'kotlin',
		file: 'packages/kotlin/build.gradle.kts',
		find: (t) => /^version\s*=\s*"([^"]+)"/m.exec(t)?.[1],
	},
	{
		name: 'csharp',
		file: 'packages/csharp/src/Acyka/Acyka.csproj',
		find: (t) => /<Version>([^<]+)<\/Version>/.exec(t)?.[1],
	},
	{
		name: 'cpp',
		file: 'packages/cpp/CMakeLists.txt',
		// `project(acyka VERSION 1.0.0 …)` — the version is a word inside a call
		find: (t) => /project\s*\([^)]*?VERSION\s+([0-9][^\s)]*)/s.exec(t)?.[1],
	},
];

const found = new Map<string, string>();
let unreadable = 0;

for (const place of places) {
	const text = await Bun.file(`${root}${place.file}`).text();
	const version = place.find(text);
	if (!version) {
		console.error(`  ${place.name}: no version found in ${place.file}`);
		unreadable += 1;
		continue;
	}
	found.set(place.name, version);
	console.log(`  ${place.name.padEnd(11)} ${version}   ${place.file}`);
}

const wanted = Bun.argv[2]?.replace(/^v/, '');
const distinct = new Set(found.values());

if (unreadable > 0) {
	console.error(`\n${unreadable} of the six do not declare a version where this expects it.`);
	process.exit(1);
}

if (!wanted) {
	if (distinct.size > 1) {
		console.error(`\nthe six do not agree: ${[...distinct].sort().join(', ')}`);
		process.exit(1);
	}
	console.log(`\nall six say ${[...distinct][0]}`);
	process.exit(0);
}

const wrong = [...found].filter(([, v]) => v !== wanted);
if (wrong.length > 0) {
	console.error(`\nthe tag says ${wanted}, and these do not:`);
	for (const [name, v] of wrong) console.error(`  ${name}: ${v}`);
	console.error('\nBump all six, or delete the tag. Publishing five of six is worse than publishing none.');
	process.exit(1);
}

console.log(`\nall six say ${wanted}`);
