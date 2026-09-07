/**
 * An operation's address, and back again.
 *
 * Four lines in their own file, and that is deliberate. It used to live in
 * `contract.ts` beside the reader, and three `.svelte` files imported it from
 * there — which pulled the 160 KB document and the whole flattener into the
 * browser bundle for the sake of one `replace`. A leaf module with no imports
 * cannot do that to anybody.
 *
 * The operation id verbatim, lowercased with a dash before each capital:
 * `listTitles` is `list-titles`. Readable, stable, and derived — so a route
 * cannot come to disagree with the reference it renders.
 */

export const slug = (id: string) => id.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
