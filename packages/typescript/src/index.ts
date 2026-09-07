/**
 * `@acyka/api` — a client for the acyka API.
 *
 * ```ts
 * import { Acyka } from '@acyka/api';
 *
 * // an application acting for itself: the catalogue, and public profiles
 * const acyka = Acyka.app({ clientId: 'acy_…', clientSecret: '…' });
 *
 * const found = await acyka.catalogue.listTitles({ q: 'frieren', limit: 5 });
 * for await (const title of acyka.catalogue.listTitlesAll({ genre: 'Drama' })) {
 *   console.log(title.title, title.year);
 * }
 *
 * // acting for a person, with a token that renews itself
 * const theirs = Acyka.user(
 *   { clientId: 'acy_…', clientSecret: '…' },
 *   tokens,
 *   (fresh) => save(fresh)   // refresh tokens rotate — keep the new one
 * );
 * const me = await theirs.account.getMe();
 * ```
 *
 * Everything under a namespace is generated from `openapi.json`, so the methods
 * and their types are the server's own shapes rather than somebody's reading of
 * a document. Everything else here is written by hand, because it is the half
 * that decides whether the library is pleasant: the token that renews itself,
 * the backoff that reads the server's own numbers, the paginators, and one error
 * type per refusal.
 */

import { AppOnly, BearerToken, UserToken, type Auth, type Endpoints, type Keeper, type Tokens } from './auth';
import { Core, type Options } from './core';
import { namespaces, type Namespaces } from './generated/client';
import type { Scope } from './generated/types';

export class Acyka {
	/** The transport, for a caller that wants to reach something not yet generated. */
	readonly core: Core;
	readonly auth: Auth;

	constructor(auth: Auth, options: Options = {}) {
		this.auth = auth;
		this.core = new Core(auth, options);
		// Assigned rather than declared one by one: the namespaces are generated,
		// and the interface below merges their types in, so a tag the server adds
		// arrives with completion and without anybody editing this class.
		Object.assign(this, namespaces(this.core));
	}

	/**
	 * An application acting for itself — a bot, a cron, anything with no person
	 * in front of it. Mints on demand and stores nothing.
	 *
	 * Only `catalog:read` and `people:read` can be held this way. Everything
	 * else on this api is about somebody, and a `client_credentials` token has
	 * nobody to act for.
	 */
	static app(
		credentials: { clientId: string; clientSecret: string; scopes?: Scope[] },
		options: Options & { endpoints?: Endpoints } = {}
	): Acyka {
		return new Acyka(new AppOnly(credentials, options.endpoints), options);
	}

	/**
	 * A token that acts for a person, kept alive by its refresh token.
	 *
	 * `keep` is told every time the set is replaced, and storing what it is
	 * handed is not optional: **refresh tokens rotate**, and presenting a
	 * retired one is what the server reads as theft — it kills the whole chain
	 * and signs the person out.
	 */
	static user(
		credentials: { clientId: string; clientSecret?: string },
		tokens: Tokens,
		keep?: Keeper,
		options: Options & { endpoints?: Endpoints } = {}
	): Acyka {
		return new Acyka(new UserToken(credentials, tokens, keep, options.endpoints), options);
	}

	/**
	 * A token somebody else obtained.
	 *
	 * No refresh: when it runs out the next call raises `Unauthorized`, rather
	 * than a credential being swapped underneath a caller who did not ask for
	 * that.
	 */
	static token(accessToken: string, options: Options = {}): Acyka {
		return new Acyka(new BearerToken(accessToken), options);
	}
}

// Declaration merging, so `acyka.catalogue.listTitles(…)` is typed without this
// file naming a single namespace.
export interface Acyka extends Namespaces {}

export * from './generated/types';
export * as ops from './generated/operations';
export {
	ACYKA,
	AppOnly,
	BearerToken,
	UserToken,
	authorizeUrl,
	awaitDevice,
	exchangeCode,
	pkce,
	startDevice,
	type Auth,
	type Endpoints,
	type DeviceStart,
	type Held,
	type Keeper,
	type Pkce,
	type Tokens
} from './auth';
export { Core, type Call, type Options, type Pace } from './core';
export {
	AcykaError,
	BadRequest,
	Forbidden,
	NotFound,
	RateLimited,
	ServerError,
	Unauthorized,
	Unreachable,
	type Refusal
} from './errors';
export { BadSignature, verify, type Delivery } from './webhooks';
