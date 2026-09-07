/**
 * The playground's own sign-in: PKCE, in the browser, against the real api.
 *
 * This site is a **public** OAuth client — it keeps no secret, because it is a
 * static page and there is nowhere on it a secret could live that a reader could
 * not read. That is not a compromise: PKCE exists precisely so a client with no
 * secret can still prove that the code it is exchanging is the one it asked for.
 *
 * It is also the point of doing it this way rather than with a server-side
 * session. Every request the playground makes is a **cross-site request from a
 * browser with a bearer token**, which is exactly what a reader's own single-page
 * application will make — so if the api's CORS rule ever stops allowing that,
 * the playground breaks here, on the site that documents it, rather than in
 * somebody's project a month later.
 *
 * The token lives in `sessionStorage` and goes when the tab does. Not
 * `localStorage`: this is a credential for somebody's real account, granted to
 * try a few calls, and it should not outlive the sitting.
 */

import { browser } from '$app/environment';

/**
 * Where the api answers.
 *
 * Paths in the reference already carry `/api/v1`, because that is what
 * `openapi.json` declares beside this host — so the two compose and nothing
 * here adds a prefix.
 */
const ORIGIN = 'https://api.acyka.cc';

/**
 * The issuer, and the two endpoints read off it rather than written down.
 *
 * These *were* written down, as `https://api.acyka.cc/api/oauth2/authorize` —
 * and that address is a 404. Only `acyka.cc` strips an `/api` prefix; on the
 * api's own host the provider answers at `/oauth2/authorize`, and the issuer is
 * `https://acyka.cc` in any case because an issuer identifier is a name rather
 * than a route. Three facts, and guessing needed all three.
 *
 * So it asks, which is what an OIDC client is supposed to do and what the
 * guide next to this tells a reader to do. One request, held for the tab: if
 * the endpoints ever move, every client that reads this document follows and
 * every client that hardcoded it — as this one did — does not.
 *
 * There is deliberately no fallback. A hardcoded pair behind a failed fetch is
 * a wrong answer wearing a right one, and the failure it hides is the discovery
 * document being unreachable, which is worth seeing.
 */
const ISSUER = 'https://acyka.cc';

type Doors = { authorization_endpoint: string; token_endpoint: string };

let asked: Promise<Doors> | undefined;

function doors(): Promise<Doors> {
	asked ??= (async () => {
		const response = await fetch(`${ISSUER}/.well-known/openid-configuration`);
		if (!response.ok) {
			asked = undefined;
			throw new Error(`the issuer's discovery document answered ${response.status}`);
		}
		const document = (await response.json()) as Partial<Doors>;
		if (!document.authorization_endpoint || !document.token_endpoint) {
			asked = undefined;
			throw new Error('the discovery document does not name both endpoints');
		}
		return { ...document } as Doors;
	})();
	return asked;
}

/**
 * The application this site is registered as.
 *
 * Public, and safe to be: a client id is in every authorization URL that has
 * ever been sent. What makes it not enough on its own is the redirect allowlist
 * on the server and the PKCE verifier that never leaves this tab.
 */
export const CLIENT_ID = 'acy_docs';

/** What the playground asks for, and nothing more. */
export const ASKING = [
	'openid',
	'profile',
	'catalog:read',
	'people:read',
	'lists:read',
	'social:read'
] as const;

const HELD = 'acyka:docs:token';
const PENDING = 'acyka:docs:pending';

type Held = { access_token: string; scope: string; expires_at: number };
type Pending = { verifier: string; state: string; back: string };

/** `sessionStorage`, and never a throw. */
const session = {
	get(key: string): string | null {
		try {
			return sessionStorage.getItem(key);
		} catch {
			return null;
		}
	},
	set(key: string, value: string) {
		try {
			sessionStorage.setItem(key, value);
		} catch {
			// A browser with site data blocked cannot hold a token, which means
			// the playground cannot sign in — and that is a fair outcome rather
			// than an error worth interrupting a reader with.
		}
	},
	drop(key: string) {
		try {
			sessionStorage.removeItem(key);
		} catch {
			// as above
		}
	}
};

const b64 = (bytes: ArrayBuffer | Uint8Array) => {
	const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
	let out = '';
	for (const byte of view) out += String.fromCharCode(byte);
	return btoa(out).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

async function pkce() {
	const verifier = b64(crypto.getRandomValues(new Uint8Array(32)));
	const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
	return { verifier, challenge: b64(digest) };
}

/** What the playground knows about who is signed in. */
class Signed {
	token = $state<string | null>(null);
	scopes = $state<string[]>([]);
	busy = $state(false);
	failed = $state('');

	constructor() {
		if (!browser) return;
		const said = session.get(HELD);
		if (!said) return;
		try {
			const held = JSON.parse(said) as Held;
			// A token past its hour is not offered: the playground would answer
			// 401 to the first press and the reader would not know why.
			if (held.expires_at > Date.now()) {
				this.token = held.access_token;
				this.scopes = held.scope.split(' ').filter(Boolean);
			} else {
				session.drop(HELD);
			}
		} catch {
			session.drop(HELD);
		}
	}

	get in(): boolean {
		return this.token !== null;
	}

	/** Whether what was granted covers what an operation needs. */
	carries(scope: string | undefined): boolean {
		if (!scope) return true;
		return this.scopes.includes(scope);
	}

	/** Leave for the consent screen and come back here. */
	async start(back: string) {
		const pair = await pkce();
		const state = b64(crypto.getRandomValues(new Uint8Array(18)));
		session.set(PENDING, JSON.stringify({ verifier: pair.verifier, state, back } satisfies Pending));

		const { authorization_endpoint } = await doors();
		const url = new URL(authorization_endpoint);
		url.searchParams.set('response_type', 'code');
		url.searchParams.set('client_id', CLIENT_ID);
		url.searchParams.set('redirect_uri', `${location.origin}/playground/callback`);
		url.searchParams.set('scope', ASKING.join(' '));
		url.searchParams.set('code_challenge', pair.challenge);
		url.searchParams.set('code_challenge_method', 'S256');
		url.searchParams.set('state', state);

		// A real navigation: the consent screen belongs to acyka.cc.
		location.href = url.toString();
	}

	/** The other half, on the callback route. */
	async finish(code: string, state: string): Promise<string> {
		const said = session.get(PENDING);
		session.drop(PENDING);
		if (!said) throw new Error('there is nothing waiting for this callback');

		const pending = JSON.parse(said) as Pending;
		// Without this a callback is forgeable: anybody who can make this tab
		// visit the route can hand it a code of their choosing.
		if (pending.state !== state) throw new Error('the state did not match');

		const { token_endpoint } = await doors();
		const response = await fetch(token_endpoint, {
			method: 'POST',
			headers: { 'content-type': 'application/x-www-form-urlencoded' },
			body: new URLSearchParams({
				grant_type: 'authorization_code',
				client_id: CLIENT_ID,
				code,
				redirect_uri: `${location.origin}/playground/callback`,
				code_verifier: pending.verifier
			})
		});

		const body = (await response.json()) as Record<string, string>;
		if (!response.ok) throw new Error(body.error_description ?? body.error ?? 'the exchange failed');

		this.token = body.access_token;
		this.scopes = (body.scope ?? '').split(' ').filter(Boolean);
		session.set(
			HELD,
			JSON.stringify({
				access_token: body.access_token,
				scope: body.scope ?? '',
				// A minute early, so a call started just before the hour does not
				// answer 401 for a reason nobody can see.
				expires_at: Date.now() + (Number(body.expires_in ?? 3600) - 60) * 1000
			} satisfies Held)
		);

		return pending.back;
	}

	out() {
		this.token = null;
		this.scopes = [];
		session.drop(HELD);
	}
}

export const signed = new Signed();

/** What one call to the api came back with. */
export type Answer = {
	status: number;
	took: number;
	body: unknown;
	/** the three headers that say how much of the minute is left */
	pace: { limit?: string; remaining?: string; reset?: string };
};

/**
 * One request, from the browser, to the live api.
 *
 * No proxy and no server hop — see the note at the top. What this does is what
 * a reader's own page will do.
 */
export async function send(
	method: string,
	path: string,
	query: Record<string, string>,
	body?: string
): Promise<Answer> {
	const url = new URL(`${ORIGIN}${path}`);
	for (const [key, value] of Object.entries(query)) {
		if (value !== '') url.searchParams.set(key, value);
	}

	const headers: Record<string, string> = { accept: 'application/json' };
	if (signed.token) headers.authorization = `Bearer ${signed.token}`;
	if (body) headers['content-type'] = 'application/json';

	const started = performance.now();
	const response = await fetch(url, { method, headers, body });
	const took = Math.round(performance.now() - started);

	const text = await response.text();
	let parsed: unknown = text;
	try {
		parsed = text ? JSON.parse(text) : null;
	} catch {
		// left as the text, which is what a proxy's html 502 is
	}

	return {
		status: response.status,
		took,
		body: parsed,
		pace: {
			limit: response.headers.get('x-ratelimit-limit') ?? undefined,
			remaining: response.headers.get('x-ratelimit-remaining') ?? undefined,
			reset: response.headers.get('x-ratelimit-reset') ?? undefined
		}
	};
}
