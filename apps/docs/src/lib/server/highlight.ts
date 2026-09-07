/**
 * Colouring code, on the server and once.
 *
 * Shiki is a real TextMate grammar engine and is worth about a megabyte. Loading
 * it in the browser would put that in front of every reader for the sake of
 * something that never changes after a deploy — so it runs where the page is
 * rendered, and what reaches the browser is the markup it produced.
 *
 * The highlighter is a module-level promise rather than a per-request one:
 * building it takes a couple of hundred milliseconds and the answer is the same
 * every time.
 */

import { createHighlighter, type Highlighter } from 'shiki';

/** Only the languages this site actually shows. */
const LANGS = [
	'typescript',
	'python',
	'rust',
	'kotlin',
	'csharp',
	'cpp',
	'bash',
	'json',
	'toml',
	'xml'
] as const;

let building: Promise<Highlighter> | undefined;

function highlighter(): Promise<Highlighter> {
	building ??= createHighlighter({
		// One theme, and a dark one, because the site has one. A light variant
		// would be two stylesheets for a page nobody reads in daylight.
		themes: ['vitesse-dark'],
		langs: [...LANGS]
	});
	return building;
}

/** One block, as html. */
export async function coloured(code: string, lang: string): Promise<string> {
	const shiki = await highlighter();
	const known = (LANGS as readonly string[]).includes(lang) ? lang : 'bash';
	return shiki.codeToHtml(code.trimEnd(), {
		lang: known,
		theme: 'vitesse-dark',
		// The background comes from the site's own tokens, so the block sits in
		// the page rather than on it.
		colorReplacements: { '#121212': 'transparent' }
	});
}
