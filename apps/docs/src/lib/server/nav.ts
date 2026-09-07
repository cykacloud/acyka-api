/**
 * The rail, built from the contract where it can be.
 *
 * The reference half is every tag and every operation the document declares, so
 * an endpoint the server grows appears in the rail without anybody editing a
 * file, and one it drops disappears with it.
 *
 * Server-only, and the directory says so: this reads the whole contract, and
 * the layout that draws the rail runs in the browser too. It is handed the
 * finished list by `+layout.server.ts` — a few kilobytes of links rather than
 * the document they were derived from.
 */

import { groups as tags } from './contract';
import { slug } from '../slug';
import { GUIDES, type Group } from '../nav';

export function sidebar(): Group[] {
	return [
		{ label: 'Guides', links: GUIDES },
		...tags().map((group) => ({
			label: group.tag,
			links: group.ops.map((op) => ({
				href: `/reference/${slug(op.id)}`,
				label: op.id.replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase(),
				hint: `${op.method} ${op.path.replace('/api/v1', '')}`
			}))
		}))
	];
}
