/**
 * The rail, worked out once per request rather than once per reader.
 *
 * It is derived from `openapi.json`, and deriving it in the layout put the
 * whole 160 KB document and the flattener that reads it into the client bundle
 * — every page, every visit, to draw a list of links. Handed over as data it is
 * a few kilobytes of `{ href, label, hint }` in the payload the page already
 * ships, and hydration has it without asking for anything.
 */

import { sidebar } from '$lib/server/nav';

export const load = () => ({ rail: sidebar() });
