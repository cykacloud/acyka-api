/**
 * All four ways to hold a token, and the one thing they have in common.
 *
 * An access token lives an hour. A library that makes its caller notice that is
 * a library whose callers each write the same refresh-and-retry loop, slightly
 * differently, and one of them gets the concurrent case wrong and sends two
 * refreshes for one expiry — which, because refresh tokens here **rotate and a
 * reuse kills the family**, signs their users out. So the loop is written once,
 * here, and `fresh()` is the whole of what the transport knows about auth.
 */

import { AcykaError, Unauthorized } from './errors';
import type { Scope } from './generated/types';

/** Where the provider lives. Overridable for a laptop, fixed in practice. */
export type Endpoints = {
	authorize: string;
	token: string;
	device: string;
};

export const ACYKA: Endpoints = {
	authorize: 'https://api.acyka.cc/api/oauth2/authorize',
	token: 'https://api.acyka.cc/api/oauth2/token',
	device: 'https://api.acyka.cc/api/oauth2/device_authorization'
};

export type Tokens = {
	access_token: string;
	token_type: string;
	expires_in: number;
	scope: string;
	refresh_token?: string;
	id_token?: string;
};

/** A token set with the moment it stops being usable worked out. */
export type Held = Tokens & { expires_at: number };

/**
 * Told whenever a token set is replaced, so a caller can put it somewhere.
 *
 * A refresh token **rotates**: the one handed back is the one to keep, and the
 * one that was sent is dead. A caller storing the original for ever therefore
 * has a credential that stops working, and — worse — presenting it again is what
 * the server reads as theft and answers by killing the whole chain. This
 * callback exists so that storing the right one is the easy thing to do.
 */
export type Keeper = (tokens: Held) => void | Promise<void>;

export interface Auth {
	/** A live access token, refreshed or minted if the held one has run out. */
	fresh(): Promise<string>;
	/** Throw away what is held, so the next call mints or refreshes. */
	forget(): void;
	/** What was granted, if it is known yet. */
	scopes(): string[];
}

function held(tokens: Tokens): Held {
	// Sixty seconds early. A token that expires while a request is in flight is
	// a 401 the caller did nothing to deserve, and clock skew between two
	// machines is measured in seconds rather than milliseconds.
	return { ...tokens, expires_at: Date.now() + (tokens.expires_in - 60) * 1000 };
}

async function exchange(
	endpoint: string,
	form: Record<string, string>,
	auth?: { id: string; secret?: string }
): Promise<Tokens> {
	const headers: Record<string, string> = {
		'content-type': 'application/x-www-form-urlencoded',
		accept: 'application/json'
	};
	const body = new URLSearchParams(form);

	if (auth?.secret) {
		// `client_secret_basic` rather than putting it in the body. Both are in
		// the spec and the api takes either; a header is the one that does not
		// end up in a proxy's access log beside the request line.
		headers.authorization = `Basic ${btoa(`${auth.id}:${auth.secret}`)}`;
	} else if (auth) {
		body.set('client_id', auth.id);
	}

	const response = await fetch(endpoint, { method: 'POST', headers, body });
	const said = await response.json().catch(() => ({}) as Record<string, unknown>);

	if (!response.ok) {
		// The token endpoint speaks RFC 6749 rather than this api's own error
		// shape — `{"error": "invalid_grant"}` — because every OAuth library ever
		// written reads that field and nothing else.
		const error = typeof said.error === 'string' ? said.error : `HTTP ${response.status}`;
		const description = typeof said.error_description === 'string' ? said.error_description : '';
		throw new AcykaError(
			response.status,
			{ message: error, error_description: description },
			{ method: 'POST', path: endpoint }
		);
	}

	return said as Tokens;
}

/**
 * A token somebody else obtained and handed over.
 *
 * The simplest case and the one with no refresh: when it runs out, it runs out,
 * and the caller finds out with an `Unauthorized` rather than having a token
 * silently swapped underneath them.
 */
export class BearerToken implements Auth {
	constructor(
		private token: string,
		private granted: string[] = []
	) {}

	async fresh(): Promise<string> {
		if (!this.token) throw new Unauthorized(401, { message: 'errors.unauthorized' }, { method: '', path: '' });
		return this.token;
	}

	forget(): void {
		this.token = '';
	}

	scopes(): string[] {
		return this.granted;
	}
}

/**
 * An application acting for itself.
 *
 * No person, no consent screen, no refresh token — there is nothing to refresh,
 * because the application can ask for another whenever it likes. Which is why
 * this one mints on demand and needs nothing stored.
 *
 * It can only carry the scopes that are about nobody: `catalog:read` and
 * `people:read`. Asking for `lists:read` here is refused at the door rather
 * than minted and then refused by every route that reads it.
 */
export class AppOnly implements Auth {
	private token?: Held;

	constructor(
		private readonly credentials: { clientId: string; clientSecret: string; scopes?: Scope[] },
		private readonly endpoints: Endpoints = ACYKA
	) {}

	async fresh(): Promise<string> {
		if (this.token && this.token.expires_at > Date.now()) return this.token.access_token;
		const form: Record<string, string> = { grant_type: 'client_credentials' };
		if (this.credentials.scopes?.length) form.scope = this.credentials.scopes.join(' ');
		this.token = held(
			await exchange(this.endpoints.token, form, {
				id: this.credentials.clientId,
				secret: this.credentials.clientSecret
			})
		);
		return this.token.access_token;
	}

	forget(): void {
		this.token = undefined;
	}

	scopes(): string[] {
		return this.token?.scope.split(' ') ?? this.credentials.scopes ?? [];
	}
}

/**
 * A token that acts for a person, kept alive by its refresh token.
 *
 * The refresh is **serialised through one promise**, which is the whole reason
 * this class exists rather than a helper. Four requests that all notice the
 * expiry at once must send one refresh between them: the tokens rotate, so two
 * refreshes means the second presents a token the first has already retired,
 * and the server's only safe reading of that is theft — it kills the family and
 * the person is signed out of an application that did nothing wrong.
 */
export class UserToken implements Auth {
	private token?: Held;
	private renewing?: Promise<string>;

	constructor(
		private readonly credentials: { clientId: string; clientSecret?: string },
		tokens?: Tokens | Held,
		private readonly keep?: Keeper,
		private readonly endpoints: Endpoints = ACYKA
	) {
		if (tokens) this.token = 'expires_at' in tokens ? tokens : held(tokens);
	}

	async fresh(): Promise<string> {
		if (this.token && this.token.expires_at > Date.now()) return this.token.access_token;
		// Whoever gets here first does the refresh; everybody else waits on the
		// same promise and reads the same answer.
		this.renewing ??= this.renew().finally(() => (this.renewing = undefined));
		return this.renewing;
	}

	private async renew(): Promise<string> {
		const refresh = this.token?.refresh_token;
		if (!refresh) {
			throw new Unauthorized(
				401,
				{ message: 'errors.unauthorized', error_description: 'no refresh token — ask for offline_access' },
				{ method: 'POST', path: this.endpoints.token }
			);
		}

		const fresh = held(
			await exchange(
				this.endpoints.token,
				{ grant_type: 'refresh_token', refresh_token: refresh },
				{ id: this.credentials.clientId, secret: this.credentials.clientSecret }
			)
		);
		// A refresh that answers without a new refresh token is one the server
		// did not rotate; keeping the old one is then right rather than a bug.
		fresh.refresh_token ??= refresh;
		this.token = fresh;
		await this.keep?.(fresh);
		return fresh.access_token;
	}

	/** What is held, for a caller that stores it themselves. */
	held(): Held | undefined {
		return this.token;
	}

	forget(): void {
		this.token = undefined;
	}

	scopes(): string[] {
		return this.token?.scope.split(' ') ?? [];
	}
}

/* ------------------------- getting a user's token -------------------------- */

/** A verifier and the challenge that goes with it, both from the same bytes. */
export type Pkce = { verifier: string; challenge: string };

const b64url = (bytes: ArrayBuffer | Uint8Array) => {
	const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
	let out = '';
	for (const byte of view) out += String.fromCharCode(byte);
	return btoa(out).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

/**
 * A fresh PKCE pair.
 *
 * **S256 and never `plain`.** The api requires it of every client, confidential
 * ones included, and only offers `S256` in its discovery document — a code that
 * leaks from a log, a referer or a browser's history is then worth nothing
 * without the verifier, which never leaves the client that made it.
 */
export async function pkce(): Promise<Pkce> {
	const verifier = b64url(crypto.getRandomValues(new Uint8Array(32)));
	const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
	return { verifier, challenge: b64url(digest) };
}

/** Where to send somebody to authorise an application. */
export function authorizeUrl(
	input: {
		clientId: string;
		redirectUri: string;
		scopes: Scope[];
		challenge: string;
		/** Round-tripped and compared on the way back. Without it a callback is forgeable. */
		state: string;
		/** Echoed into the id token, so a client can prove the sign-in was recent. */
		nonce?: string;
		prompt?: 'none' | 'login' | 'consent' | 'select_account';
	},
	endpoints: Endpoints = ACYKA
): string {
	const url = new URL(endpoints.authorize);
	url.searchParams.set('response_type', 'code');
	url.searchParams.set('client_id', input.clientId);
	url.searchParams.set('redirect_uri', input.redirectUri);
	url.searchParams.set('scope', input.scopes.join(' '));
	url.searchParams.set('code_challenge', input.challenge);
	url.searchParams.set('code_challenge_method', 'S256');
	url.searchParams.set('state', input.state);
	if (input.nonce) url.searchParams.set('nonce', input.nonce);
	if (input.prompt) url.searchParams.set('prompt', input.prompt);
	return url.toString();
}

/** The code from the callback, for a token set. */
export async function exchangeCode(
	input: {
		clientId: string;
		clientSecret?: string;
		code: string;
		redirectUri: string;
		verifier: string;
	},
	endpoints: Endpoints = ACYKA
): Promise<Tokens> {
	return exchange(
		endpoints.token,
		{
			grant_type: 'authorization_code',
			code: input.code,
			redirect_uri: input.redirectUri,
			code_verifier: input.verifier
		},
		{ id: input.clientId, secret: input.clientSecret }
	);
}

export type DeviceStart = {
	device_code: string;
	/** the eight characters to put on the screen */
	user_code: string;
	verification_uri: string;
	/** the same address with the code in it, for a QR */
	verification_uri_complete: string;
	expires_in: number;
	/** the floor, in seconds, the server asked to be polled at */
	interval: number;
};

/** Ask for a code to show on something with no browser. */
export async function startDevice(
	input: { clientId: string; clientSecret?: string; scopes: Scope[] },
	endpoints: Endpoints = ACYKA
): Promise<DeviceStart> {
	const headers: Record<string, string> = {
		'content-type': 'application/x-www-form-urlencoded',
		accept: 'application/json'
	};
	const body = new URLSearchParams({ scope: input.scopes.join(' ') });
	if (input.clientSecret) {
		headers.authorization = `Basic ${btoa(`${input.clientId}:${input.clientSecret}`)}`;
	} else {
		body.set('client_id', input.clientId);
	}

	const response = await fetch(endpoints.device, { method: 'POST', headers, body });
	if (!response.ok) {
		const said = (await response.json().catch(() => ({}))) as Record<string, unknown>;
		throw new AcykaError(
			response.status,
			{ message: typeof said.error === 'string' ? said.error : `HTTP ${response.status}` },
			{ method: 'POST', path: endpoints.device }
		);
	}
	return (await response.json()) as DeviceStart;
}

/**
 * Wait for the person to say yes, then hand back their tokens.
 *
 * The four names the server can answer with are the whole of what a poller needs
 * to behave, and this reads all four: `authorization_pending` means keep going,
 * `slow_down` means keep going and wait longer, `access_denied` means somebody
 * pressed cancel, and `expired_token` means nobody pressed anything. A client
 * that cannot tell the first from the third polls into the expiry after the
 * answer has already arrived.
 */
export async function awaitDevice(
	input: { clientId: string; clientSecret?: string; deviceCode: string; interval?: number },
	options: { signal?: AbortSignal; endpoints?: Endpoints } = {}
): Promise<Tokens> {
	const endpoints = options.endpoints ?? ACYKA;
	let wait = (input.interval ?? 5) * 1000;

	for (;;) {
		options.signal?.throwIfAborted();
		await new Promise((done) => setTimeout(done, wait));
		options.signal?.throwIfAborted();

		try {
			return await exchange(
				endpoints.token,
				{
					grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
					device_code: input.deviceCode
				},
				{ id: input.clientId, secret: input.clientSecret }
			);
		} catch (err) {
			if (!(err instanceof AcykaError)) throw err;
			if (err.code === 'authorization_pending') continue;
			if (err.code === 'slow_down') {
				// The server is saying the interval was too short. Five seconds
				// more, as the RFC suggests, rather than doubling — this is a
				// person walking to their phone, not a backoff.
				wait += 5000;
				continue;
			}
			throw err;
		}
	}
}
