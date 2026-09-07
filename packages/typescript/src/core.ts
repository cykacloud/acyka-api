/**
 * One request, and everything that happens around it.
 *
 * The generated methods are thin on purpose — they name a path, a query and a
 * body, and hand all four of the interesting decisions to this file:
 *
 * - **waiting exactly as long as the server asked.** Every answer carries
 *   `X-RateLimit-Remaining` and `X-RateLimit-Reset`, and a 429 carries
 *   `Retry-After`. A client that reads them sleeps the right amount; one that
 *   guesses either hammers the door or sleeps for no reason. This reads them.
 * - **retrying only what is safe to retry.** A 429 and a 5xx, and a socket that
 *   never answered — never a request that was refused on its merits.
 * - **refreshing once on a 401.** An access token lives an hour, so a
 *   long-running process will meet one expiring mid-request. It gets one retry
 *   with a fresh token; a second 401 is a real refusal and is raised.
 * - **turning a body into the right error type.**
 */

import { refusal, AcykaError, RateLimited, Unauthorized, Unreachable, type Refusal } from './errors';
import type { Auth } from './auth';

export type Pace = {
	/** what the ceiling is, per minute */
	limit?: number;
	/** how much of it is left */
	remaining?: number;
	/** seconds until the window turns */
	reset?: number;
};

export type Options = {
	/** where the api is; only a laptop needs to change this */
	baseUrl?: string;
	/** how long one request may take before it is abandoned, in ms */
	timeout?: number;
	/** how many times a retryable answer is retried. 0 turns it off entirely. */
	retries?: number;
	/**
	 * The longest this will ever sleep before giving up on a 429, in ms.
	 *
	 * Without a ceiling, a client that has spent its minute and asked for a
	 * hundred pages sleeps for the whole window inside one `await` — which looks
	 * exactly like a hang to whoever is waiting on it. Past this, the
	 * `RateLimited` is raised and the decision is the caller's.
	 */
	maxWait?: number;
	/** told after every answer, so a caller can watch its own budget */
	onPace?: (pace: Pace) => void;
	/** for tests, and for a runtime whose `fetch` is somewhere else */
	fetch?: typeof fetch;
	/** added to every request; `user-agent` is set for you and can be replaced */
	headers?: Record<string, string>;
};

export type Call = {
	method: string;
	path: string;
	query?: Record<string, unknown>;
	body?: unknown;
	/** a 204 answers nothing, and the generated method's return type says so */
	empty?: boolean;
	/** what this call needs, for the message on a 403 */
	scope?: string;
};

const DEFAULTS = {
	baseUrl: 'https://api.acyka.cc',
	timeout: 30_000,
	retries: 3,
	maxWait: 65_000
};

const sleep = (ms: number) => new Promise((done) => setTimeout(done, ms));

function number(value: string | null): number | undefined {
	if (value === null) return undefined;
	const n = Number(value);
	return Number.isFinite(n) ? n : undefined;
}

/** A query string, with nothing that was not asked for in it. */
function search(query: Record<string, unknown> | undefined): string {
	if (!query) return '';
	const parts = new URLSearchParams();
	for (const [key, value] of Object.entries(query)) {
		if (value === undefined || value === null) continue;
		if (Array.isArray(value)) {
			// Repeated rather than comma-joined, except where the api has said it
			// wants a comma — `genre` is documented that way, and a caller who
			// passes an array there gets what they meant.
			for (const one of value) parts.append(key, String(one));
		} else {
			parts.set(key, String(value));
		}
	}
	const text = parts.toString();
	return text ? `?${text}` : '';
}

export class Core {
	private readonly options: Required<Omit<Options, 'onPace' | 'fetch' | 'headers'>> &
		Pick<Options, 'onPace' | 'headers'>;
	private readonly send: typeof fetch;

	constructor(
		private readonly auth: Auth,
		options: Options = {}
	) {
		this.options = { ...DEFAULTS, ...options };
		this.send = options.fetch ?? globalThis.fetch.bind(globalThis);
	}

	async call<T>(call: Call): Promise<T> {
		const url = `${this.options.baseUrl}${call.path}${search(call.query)}`;
		const where = { method: call.method, path: call.path };
		let refreshed = false;

		for (let attempt = 0; ; attempt++) {
			const token = await this.auth.fresh();

			const headers: Record<string, string> = {
				accept: 'application/json',
				'user-agent': 'acyka-api-ts/1',
				...this.options.headers,
				authorization: `Bearer ${token}`
			};
			if (call.body !== undefined) headers['content-type'] = 'application/json';

			let response: Response;
			try {
				response = await this.send(url, {
					method: call.method,
					headers,
					body: call.body === undefined ? undefined : JSON.stringify(call.body),
					signal: AbortSignal.timeout(this.options.timeout)
				});
			} catch (cause) {
				// Nothing answered. Worth one more go for the same reason a 5xx is
				// — a dropped socket during a deploy is a gap, not a refusal —
				// and then it is the caller's problem.
				if (attempt < this.options.retries) {
					await sleep(Math.min(2 ** attempt * 250, 4000));
					continue;
				}
				throw new Unreachable(where, cause);
			}

			const pace: Pace = {
				limit: number(response.headers.get('x-ratelimit-limit')),
				remaining: number(response.headers.get('x-ratelimit-remaining')),
				reset: number(response.headers.get('x-ratelimit-reset'))
			};
			this.options.onPace?.(pace);

			if (response.ok) {
				if (call.empty || response.status === 204) return undefined as T;
				return (await response.json()) as T;
			}

			const said = ((await response.json().catch(() => ({}))) ?? {}) as Refusal;

			// A token that expired mid-flight. One refresh and one retry: a second
			// 401 is the server saying the credential is wrong rather than stale,
			// and refreshing again would produce the same one.
			if (response.status === 401 && !refreshed) {
				refreshed = true;
				this.auth.forget();
				try {
					await this.auth.fresh();
					continue;
				} catch {
					throw new Unauthorized(401, said, where);
				}
			}

			const retryable = response.status === 429 || response.status >= 500;
			if (retryable && attempt < this.options.retries) {
				// The server's own number, not a guess. `Retry-After` on a 429 is
				// the same value the limiter is holding, so this waits neither too
				// little (and is refused again) nor too much.
				const asked = number(response.headers.get('retry-after'));
				const wait =
					response.status === 429
						? Math.max(1, asked ?? pace.reset ?? 1) * 1000
						: Math.min(2 ** attempt * 250, 4000);

				if (wait <= this.options.maxWait) {
					await sleep(wait);
					continue;
				}
			}

			throw refusal(response.status, said, where, {
				retryAfter: number(response.headers.get('retry-after')) ?? pace.reset ?? 0,
				limit: pace.limit,
				remaining: pace.remaining
			});
		}
	}
}

export { AcykaError, RateLimited };
