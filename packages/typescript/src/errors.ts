/**
 * One type per refusal, out of a set the server keeps small on purpose.
 *
 * The api answers `{"message": "errors.oauthInsufficientScope"}` — a **phrase
 * name and never a sentence** — because one screen can be read in five
 * languages and the server does not get to choose which. That is usually
 * described as a limitation; for a client library it is the opposite. A stable,
 * enumerable set of names is what makes a real error type per refusal possible
 * instead of matching on prose that changes when somebody rewrites a sentence.
 *
 * So: catch the class you can do something about, and read `.message` for the
 * name when you want to show your own words.
 */

/** The shape every refusal on this api takes. */
export type Refusal = {
	/** a phrase name, e.g. `errors.oauthInsufficientScope` */
	message: string;
	/** extra fields a refusal owes a reason for — the missing scope, a ban's length */
	[key: string]: unknown;
};

export class AcykaError extends Error {
	readonly status: number;
	/** the phrase name, which is what `message` holds */
	readonly code: string;
	readonly detail: Refusal;
	/** what the api was asked, for a log that has to be read six months later */
	readonly request: { method: string; path: string };

	constructor(
		status: number,
		detail: Refusal,
		request: { method: string; path: string }
	) {
		// The name rather than a sentence of our own invention: whatever prints
		// this should print the thing that can be looked up.
		super(detail.message ?? `HTTP ${status}`);
		this.name = new.target.name;
		this.status = status;
		this.code = detail.message ?? '';
		this.detail = detail;
		this.request = request;
	}
}

/** No token, a token that has expired, or one whose application was switched off. */
export class Unauthorized extends AcykaError {}

/**
 * The token is good and does not carry what this endpoint wants.
 *
 * **Refreshing will not help**, which is why this is separate from
 * `Unauthorized`: the refresh produces the same token with the same scopes and
 * earns the same refusal. `scope` is the word that was missing, when the server
 * named it.
 */
export class Forbidden extends AcykaError {
	get scope(): string | undefined {
		const named = this.detail.scope;
		return typeof named === 'string' ? named : undefined;
	}
}

export class NotFound extends AcykaError {}

/** The request was refused before anything looked at it. */
export class BadRequest extends AcykaError {}

/**
 * The minute is spent.
 *
 * `retryAfter` is seconds, from the server's own header, and the client waits
 * exactly that long rather than guessing — see `core.ts`. This only reaches a
 * caller when the retries are used up or turned off.
 */
export class RateLimited extends AcykaError {
	readonly retryAfter: number;
	readonly limit?: number;
	readonly remaining?: number;

	constructor(
		status: number,
		detail: Refusal,
		request: { method: string; path: string },
		pace: { retryAfter: number; limit?: number; remaining?: number }
	) {
		super(status, detail, request);
		this.retryAfter = pace.retryAfter;
		this.limit = pace.limit;
		this.remaining = pace.remaining;
	}
}

/** Something went wrong on our side, or in front of it. */
export class ServerError extends AcykaError {}

/** The request never got an answer: a socket, a timeout, a proxy. */
export class Unreachable extends AcykaError {
	constructor(request: { method: string; path: string }, cause: unknown) {
		super(0, { message: 'errors.unreachable' }, request);
		this.cause = cause;
	}
}

export function refusal(
	status: number,
	detail: Refusal,
	request: { method: string; path: string },
	pace: { retryAfter: number; limit?: number; remaining?: number }
): AcykaError {
	switch (status) {
		case 400:
		case 422:
			return new BadRequest(status, detail, request);
		case 401:
			return new Unauthorized(status, detail, request);
		case 403:
			return new Forbidden(status, detail, request);
		case 404:
			return new NotFound(status, detail, request);
		case 429:
			return new RateLimited(status, detail, request, pace);
		default:
			return status >= 500
				? new ServerError(status, detail, request)
				: new AcykaError(status, detail, request);
	}
}
