/**
 * Colouring the blocks a guide shows.
 *
 * A guide's snippets are written by hand — they are an argument about how to use
 * the api rather than a call to one operation, and generating those would mean
 * generating the argument. What is shared is the colouring, so a page's loader
 * hands over `{ name: code }` and gets `{ name: { code, html } }` back.
 */

import { coloured } from './highlight';

export type Block = { code: string; html: string; lang: string };

export async function blocks(
	written: Record<string, { code: string; lang: string }>
): Promise<Record<string, Block>> {
	const out: Record<string, Block> = {};
	for (const [name, one] of Object.entries(written)) {
		out[name] = { ...one, html: await coloured(one.code, one.lang) };
	}
	return out;
}

/** A block, in one line, for a page that has a lot of them. */
export const ts = (code: string) => ({ code, lang: 'typescript' });
export const py = (code: string) => ({ code, lang: 'python' });
export const sh = (code: string) => ({ code, lang: 'bash' });
export const js = (code: string) => ({ code, lang: 'json' });
