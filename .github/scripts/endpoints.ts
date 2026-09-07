/**
 * The addresses in the six libraries are the addresses the server advertises.
 *
 * Every one of them shipped pointing at `https://api.acyka.cc/api/oauth2/token`,
 * which is a 404, and nothing here could have noticed: the token endpoint is not
 * in `openapi.json` — it is RFC 6749's, form-encoded, and shaped by a spec
 * rather than by us — so the generator never sees it and the six constants are
 * hand-written in six languages. Three separate facts had to be got right at
 * once. Only `acyka.cc` strips an `/api` prefix; the issuer identifier is
 * `https://acyka.cc` and every endpoint hangs off the issuer; and `api.acyka.cc`
 * is the *api's* host and not the provider's.
 *
 * So this asks the server. `/.well-known/openid-configuration` is the one
 * authority on where those endpoints are — it is what a client is supposed to
 * read, and what the guide beside the playground tells a reader to read — and
 * these constants exist only to save the common case a round trip.
 *
 * The base url is checked the same way, against the `servers` entry in the
 * contract, because the contract is generated and the transport's default is
 * not.
 *
 *     bun .github/scripts/endpoints.ts
 *     bun .github/scripts/endpoints.ts http://localhost:3001   # a laptop
 */

const root = new URL('../..', import.meta.url).pathname;
const issuer = (Bun.argv[2] ?? 'https://acyka.cc').replace(/\/$/, '');

const response = await fetch(`${issuer}/.well-known/openid-configuration`);
if (!response.ok) {
	console.error(`${issuer} answered ${response.status} for its discovery document`);
	process.exit(1);
}
const doc = (await response.json()) as Record<string, string>;

const contract = await Bun.file(`${root}openapi.json`).json();
const base: string | undefined = contract.servers?.[0]?.url;
if (!base) {
	console.error('openapi.json names no server');
	process.exit(1);
}

/** What each library ought to be carrying, and where. */
const wanted: Record<string, string> = {
	authorize: doc.authorization_endpoint,
	token: doc.token_endpoint,
	device: doc.device_authorization_endpoint,
	base,
};

for (const [what, address] of Object.entries(wanted)) {
	if (!address) {
		console.error(`the discovery document does not advertise the ${what} endpoint`);
		process.exit(1);
	}
}

/**
 * One file per library, and the four addresses read out of it by hand.
 *
 * Read as text rather than imported, because five of the six are not
 * JavaScript. What is being checked is the literal that ships, so reading the
 * literal is the honest way round — a parser for each language would be a
 * second thing to be wrong.
 */
const places: { name: string; files: string[] }[] = [
	{ name: 'typescript', files: ['packages/typescript/src/auth.ts', 'packages/typescript/src/core.ts'] },
	{ name: 'python', files: ['packages/python/src/acyka/auth.py', 'packages/python/src/acyka/_core.py'] },
	{ name: 'rust', files: ['packages/rust/src/auth.rs', 'packages/rust/src/core.rs'] },
	{
		name: 'kotlin',
		files: [
			'packages/kotlin/src/main/kotlin/cc/acyka/api/Auth.kt',
			'packages/kotlin/src/main/kotlin/cc/acyka/api/Core.kt',
		],
	},
	{ name: 'csharp', files: ['packages/csharp/src/Acyka/Auth.cs', 'packages/csharp/src/Acyka/Core.cs'] },
	{ name: 'cpp', files: ['packages/cpp/include/acyka/auth.hpp', 'packages/cpp/include/acyka/core.hpp'] },
];

const wrong: string[] = [];

for (const place of places) {
	let text = '';
	for (const file of place.files) {
		text += await Bun.file(`${root}${file}`)
			.text()
			.catch(() => '');
	}

	// Every acyka address the library writes down, whatever quotes are around it
	const said = new Set(text.match(/https:\/\/[a-z.]*acyka\.cc[^\s"'`,);]*/g) ?? []);

	for (const [what, address] of Object.entries(wanted)) {
		if (!said.has(address)) {
			wrong.push(`  ${place.name}: does not carry the ${what} address ${address}`);
		}
	}

	// And nothing else. An address that is neither the base nor an endpoint is
	// either a typo or a fourth thing nobody told this script about, and both
	// want a person to look.
	//
	// The documentation site and the issuer's own root are allowed because a
	// comment points at them, and so is anything under `.well-known` — that is
	// where a client is *supposed* to look, and a library mentioning it is the
	// library saying the right thing.
	// `doc.issuer` and not the url this asked: pointed at a laptop, the
	// document still names the issuer it will be deployed as, and it is the
	// issuer the constants are written against.
	const named = (doc.issuer ?? '').replace(/\/$/, '');
	const allowed = new Set<string>([...Object.values(wanted), 'https://dev.acyka.cc', named]);
	for (const address of said) {
		if (allowed.has(address)) continue;
		if (named && address.startsWith(`${named}/.well-known/`)) continue;
		wrong.push(`  ${place.name}: carries ${address}, which the server does not advertise`);
	}
}

if (wrong.length > 0) {
	console.error(`the server says:\n`);
	for (const [what, address] of Object.entries(wanted)) console.error(`  ${what.padEnd(10)} ${address}`);
	console.error(`\nand these do not agree:\n${wrong.join('\n')}\n`);
	process.exit(1);
}

console.log('the six agree with the server:');
for (const [what, address] of Object.entries(wanted)) console.log(`  ${what.padEnd(10)} ${address}`);
