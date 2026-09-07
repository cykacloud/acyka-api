/**
 * The paginator, which is generated — and is exactly the loop everybody writes
 * by hand and somebody gets wrong at the last page.
 */
import { describe, expect, test } from 'bun:test';
import { Acyka } from '../src';
import type { TitleCard } from '../src/generated/types';

const card = (id: number): TitleCard => ({ id, title: `t${id}`, kind: 'tv', episodes: 12 });

/** A `fetch` that serves one long list a page at a time, from a real query. */
function shelf(rows: TitleCard[], total = rows.length) {
	const asked: string[] = [];
	const send = (async (url: string | URL | Request) => {
		const at = new URL(String(url));
		asked.push(at.search);
		const limit = Number(at.searchParams.get('limit') ?? 30);
		const offset = Number(at.searchParams.get('offset') ?? 0);
		return new Response(JSON.stringify({ items: rows.slice(offset, offset + limit), total }), {
			headers: { 'content-type': 'application/json' }
		});
	}) as unknown as typeof fetch;
	return { send, asked };
}

describe('paging through a list', () => {
	test('walks every row and stops on a short page', async () => {
		const rows = Array.from({ length: 25 }, (_, i) => card(i + 1));
		const { send, asked } = shelf(rows);
		const acyka = Acyka.token('acya_test', { fetch: send });

		const seen: number[] = [];
		for await (const title of acyka.catalogue.listTitlesAll({ limit: 10 })) seen.push(title.id);

		expect(seen).toEqual(rows.map((r) => r.id));
		// Three pages: ten, ten, five. The fourth is never asked for, because the
		// third came back shorter than it asked for.
		expect(asked).toHaveLength(3);
		expect(asked[0]).toContain('offset=0');
		expect(asked[2]).toContain('offset=20');
	});

	test('stops on a short page even when total is a lie', async () => {
		// `total` is a count taken at the moment of the query, and a list can grow
		// or shrink while it is being read. A loop that counted against it either
		// asks for a page that is not there or stops before the end — which is
		// why the test is the page's own length.
		const rows = Array.from({ length: 5 }, (_, i) => card(i + 1));
		const { send, asked } = shelf(rows, 4_000);
		const acyka = Acyka.token('acya_test', { fetch: send });

		let counted = 0;
		for await (const _ of acyka.catalogue.listTitlesAll({ limit: 10 })) counted += 1;

		expect(counted).toBe(5);
		expect(asked).toHaveLength(1);
	});

	test('an empty list asks once and yields nothing', async () => {
		const { send, asked } = shelf([], 0);
		const acyka = Acyka.token('acya_test', { fetch: send });
		for await (const _ of acyka.catalogue.listTitlesAll()) throw new Error('yielded a row');
		expect(asked).toHaveLength(1);
	});

	test('and the filters travel with every page', async () => {
		const rows = Array.from({ length: 3 }, (_, i) => card(i + 1));
		const { send, asked } = shelf(rows);
		const acyka = Acyka.token('acya_test', { fetch: send });
		for await (const _ of acyka.catalogue.listTitlesAll({ genre: 'Drama', lang: 'ru', limit: 2 }));
		for (const search of asked) {
			expect(search).toContain('genre=Drama');
			expect(search).toContain('lang=ru');
		}
	});
});
