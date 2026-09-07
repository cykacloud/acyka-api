/**
 * The shape of the rail, and the half of it that is written by hand.
 *
 * The guides are a written list because their order is an argument — "start
 * here", then authorising, then the things that bite. The reference half is
 * read off the contract instead, and that is in `$lib/server/nav.ts`, because
 * reading the contract means holding all 160 KB of it and no browser needs
 * that to draw a list of links.
 */

export type Link = { href: string; label: string; hint?: string };
export type Group = { label: string; links: Link[] };

/** The guides, in the order somebody reads them. */
export const GUIDES: Link[] = [
	{ href: '/docs', label: 'Start here' },
	{ href: '/docs/authorising', label: 'Authorising' },
	{ href: '/docs/scopes', label: 'Scopes' },
	{ href: '/docs/paging', label: 'Paging' },
	{ href: '/docs/errors', label: 'Errors' },
	{ href: '/docs/rate-limits', label: 'Rate limits' },
	{ href: '/docs/webhooks', label: 'Webhooks' },
	{ href: '/docs/libraries', label: 'The libraries' }
];
