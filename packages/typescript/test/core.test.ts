/**
 * The half of the client a document cannot generate, and therefore the half
 * worth testing: waiting the right amount, retrying the right things, and
 * refreshing exactly once.
 */
import { describe, expect, test } from 'bun:test';
import { Core } from '../src/core';
import { BearerToken, type Auth } from '../src/auth';
import { BadRequest, Forbidden, NotFound, RateLimited, ServerError, Unauthorized } from '../src/errors';

/** A `fetch` that answers a scripted list, and remembers what it was asked. */
function scripted(answers: Response[]) {
	const asked: { url: string; init?: RequestInit }[] = [];
	const send = (async (url: string | URL | Request, init?: RequestInit) => {
		asked.push({ url: String(url), init });
		const next = answers.shift();
		if (!next) throw new Error('the script ran out of answers');
		return next;
	}) as unknown as typeof fetch;
	return { send, asked };
}

const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
	new Response(JSON.stringify(body), {
		status,
		headers: { 'content-type': 'application/json', ...headers }
	});

const core = (answers: Response[], options = {}) => {
	const { send, asked } = scripted(answers);
	return {
		core: new Core(new BearerToken('acya_test'), { fetch: send, retries: 3, ...options }),
		asked
	};
};

describe('one request', () => {
	test('sends the token, and asks for json', async () => {
		const { core: c, asked } = core([json(200, { items: [] })]);
		await c.call({ method: 'GET', path: '/api/v1/titles' });

		const headers = asked[0]!.init!.headers as Record<string, string>;
		expect(headers.authorization).toBe('Bearer acya_test');
		expect(headers.accept).toBe('application/json');
		// A GET carries no content-type: there is no content to type, and a
		// header saying otherwise is a header a strict proxy may object to.
		expect(headers['content-type']).toBeUndefined();
	});

	test('leaves out a query parameter that was not asked for', async () => {
		const { core: c, asked } = core([json(200, { items: [] })]);
		await c.call({
			method: 'GET',
			path: '/api/v1/titles',
			query: { q: 'frieren', limit: undefined, offset: 0, score: 0 }
		});
		// `undefined` means "not asked for" and is dropped; `0` is an answer and
		// is sent — a client that dropped falsy values would make `offset=0`
		// unsendable and `score=0` mean "any score".
		expect(asked[0]!.url).toBe('https://api.acyka.cc/api/v1/titles?q=frieren&offset=0&score=0');
	});

	test('a 204 answers nothing rather than a parse error', async () => {
		const { core: c } = core([new Response(null, { status: 204 })]);
		expect(await c.call({ method: 'DELETE', path: '/api/v1/lists/21', empty: true })).toBeUndefined();
	});
});

describe('a refusal becomes a type', () => {
	const cases: [number, unknown][] = [
		[400, BadRequest],
		[401, Unauthorized],
		[403, Forbidden],
		[404, NotFound],
		[500, ServerError]
	];

	for (const [status, kind] of cases) {
		test(`${status}`, async () => {
			const { core: c } = core([json(status, { message: 'errors.something' })], { retries: 0 });
			const err = await c
				.call({ method: 'GET', path: '/api/v1/titles' })
				.then(() => null)
				.catch((e) => e);
			expect(err).toBeInstanceOf(kind as never);
			// The phrase name and never a sentence of ours: it is the thing that
			// can be looked up, and the only thing that is stable.
			expect(err.code).toBe('errors.something');
			expect(err.request.path).toBe('/api/v1/titles');
		});
	}

	test('a 403 names the scope the server named', async () => {
		const { core: c } = core(
			[json(403, { message: 'errors.oauthInsufficientScope', scope: 'lists:write' })],
			{ retries: 0 }
		);
		const err = await c.call({ method: 'GET', path: '/api/v1/lists' }).catch((e) => e);
		expect(err).toBeInstanceOf(Forbidden);
		expect(err.scope).toBe('lists:write');
	});

	test('an answer with no json still becomes the right type', async () => {
		// A proxy's own 502 is html, and a client that throws a SyntaxError there
		// tells its caller nothing about what happened.
		const { core: c } = core([new Response('<html>502</html>', { status: 502 })], { retries: 0 });
		const err = await c.call({ method: 'GET', path: '/api/v1/titles' }).catch((e) => e);
		expect(err).toBeInstanceOf(ServerError);
		expect(err.status).toBe(502);
	});
});

describe('the pace the server sets', () => {
	test('a 429 waits exactly as long as Retry-After said, then succeeds', async () => {
		const { core: c, asked } = core([
			json(429, { message: 'common.tooOften' }, { 'retry-after': '1', 'x-ratelimit-remaining': '0' }),
			json(200, { items: [{ id: 1 }] })
		]);
		const started = Date.now();
		const out = await c.call<{ items: unknown[] }>({ method: 'GET', path: '/api/v1/titles' });
		const took = Date.now() - started;

		expect(out.items).toHaveLength(1);
		expect(asked).toHaveLength(2);
		// The server's own number rather than a guess: too little and it is
		// refused again, too much and the client sleeps for nothing.
		expect(took).toBeGreaterThanOrEqual(900);
		expect(took).toBeLessThan(2500);
	});

	test('a wait past the ceiling is raised rather than slept through', async () => {
		// Sleeping a whole window inside one await looks exactly like a hang to
		// whoever is waiting on it, so past the ceiling the decision is theirs.
		const { core: c, asked } = core(
			[json(429, { message: 'common.tooOften' }, { 'retry-after': '60' })],
			{ maxWait: 1000 }
		);
		const err = await c.call({ method: 'GET', path: '/api/v1/titles' }).catch((e) => e);
		expect(err).toBeInstanceOf(RateLimited);
		expect(err.retryAfter).toBe(60);
		expect(asked).toHaveLength(1);
	});

	test('the headers reach a caller that wants to watch its own budget', async () => {
		const seen: unknown[] = [];
		const { core: c } = core(
			[json(200, {}, { 'x-ratelimit-limit': '60', 'x-ratelimit-remaining': '58', 'x-ratelimit-reset': '31' })],
			{ onPace: (p: unknown) => seen.push(p) }
		);
		await c.call({ method: 'GET', path: '/api/v1/genres' });
		expect(seen).toEqual([{ limit: 60, remaining: 58, reset: 31 }]);
	});

	test('a refusal on its merits is not retried', async () => {
		const { core: c, asked } = core([json(400, { message: 'errors.badData' })]);
		await c.call({ method: 'PUT', path: '/api/v1/lists/21', body: {} }).catch(() => null);
		expect(asked).toHaveLength(1);
	});
});

describe('a token that expires mid-flight', () => {
	/** An auth that hands out a new token every time it is asked afresh. */
	function renewing(): Auth & { refreshes: number } {
		let n = 0;
		return {
			refreshes: 0,
			async fresh() {
				return `acya_${n}`;
			},
			forget() {
				n += 1;
				(this as { refreshes: number }).refreshes += 1;
			},
			scopes: () => []
		};
	}

	test('is refreshed once and retried once', async () => {
		const auth = renewing();
		const { send, asked } = scripted([
			json(401, { message: 'errors.unauthorized' }),
			json(200, { id: '1' })
		]);
		const c = new Core(auth, { fetch: send, retries: 0 });

		await c.call({ method: 'GET', path: '/api/v1/me' });

		expect(auth.refreshes).toBe(1);
		expect(asked).toHaveLength(2);
		expect((asked[0]!.init!.headers as Record<string, string>).authorization).toBe('Bearer acya_0');
		expect((asked[1]!.init!.headers as Record<string, string>).authorization).toBe('Bearer acya_1');
	});

	test('and a second 401 is raised rather than refreshed again', async () => {
		// The credential is wrong rather than stale; refreshing produces the same
		// one and the loop would never end.
		const auth = renewing();
		const { send, asked } = scripted([
			json(401, { message: 'errors.unauthorized' }),
			json(401, { message: 'errors.unauthorized' })
		]);
		const c = new Core(auth, { fetch: send, retries: 0 });

		const err = await c.call({ method: 'GET', path: '/api/v1/me' }).catch((e) => e);
		expect(err).toBeInstanceOf(Unauthorized);
		expect(auth.refreshes).toBe(1);
		expect(asked).toHaveLength(2);
	});
});
