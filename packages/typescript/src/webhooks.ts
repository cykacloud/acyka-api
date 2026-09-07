/**
 * Checking that a delivery came from us.
 *
 * This is thirty lines and every one of them is a line somebody gets wrong when
 * they write it themselves — which is why it is in the library rather than in
 * the documentation.
 *
 * The three that matter:
 *
 * - **the raw body, not a parsed one.** The signature covers the bytes that
 *   were sent. `JSON.parse` and then `JSON.stringify` gives a different string
 *   the moment anything about key order or number formatting differs, and the
 *   check then fails for good reasons that look like bad ones.
 * - **a constant-time compare.** `a === b` on strings returns as soon as two
 *   characters differ, and how long that took is a measurement of how much of
 *   the signature was right. That is a hundred requests per byte, and a
 *   forgeable signature at the end of it.
 * - **the timestamp.** The signed string is `<t>.<body>`, so a captured
 *   delivery signs valid for ever unless somebody checks how old `t` is. Five
 *   minutes is generous for a POST that crossed the internet once.
 */

const enc = new TextEncoder();

export type Delivery<T = unknown> = {
	/** which kind — `list.saved`, `episode.aired`, and five more */
	event: string;
	/** the row that moved, in this door's snake_case */
	data: T;
};

export class BadSignature extends Error {
	constructor(why: string) {
		super(`the webhook signature did not check out: ${why}`);
		this.name = 'BadSignature';
	}
}

/** `t=1700000000,v1=<hex>` as its two halves. */
function parts(header: string): { t: number; v1: string } | null {
	let t: number | undefined;
	let v1: string | undefined;
	for (const piece of header.split(',')) {
		const at = piece.indexOf('=');
		if (at < 0) continue;
		const key = piece.slice(0, at).trim();
		const value = piece.slice(at + 1).trim();
		if (key === 't') t = Number(value);
		if (key === 'v1') v1 = value;
	}
	return t !== undefined && Number.isFinite(t) && v1 ? { t, v1 } : null;
}

/** Two hex strings, compared without saying how far they matched. */
function same(a: string, b: string): boolean {
	if (a.length !== b.length) return false;
	let differs = 0;
	for (let i = 0; i < a.length; i++) differs |= a.charCodeAt(i) ^ b.charCodeAt(i);
	return differs === 0;
}

const hex = (bytes: ArrayBuffer) =>
	[...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('');

/**
 * The delivery, or a throw.
 *
 * ```ts
 * const event = await verify({
 *   body: await request.text(),           // the raw text, before any parsing
 *   signature: request.headers.get('x-acyka-signature')!,
 *   secret: process.env.ACYKA_WEBHOOK_SECRET!
 * });
 * ```
 */
export async function verify<T = unknown>(input: {
	/** the request body exactly as it arrived */
	body: string;
	/** the `X-Acyka-Signature` header */
	signature: string | null | undefined;
	secret: string;
	/** how old a delivery may be, in seconds. Five minutes by default. */
	tolerance?: number;
	/** for tests */
	now?: number;
}): Promise<Delivery<T>> {
	if (!input.signature) throw new BadSignature('there was no signature header');

	const said = parts(input.signature);
	if (!said) throw new BadSignature('the header was not `t=…,v1=…`');

	const tolerance = input.tolerance ?? 300;
	const now = Math.floor((input.now ?? Date.now()) / 1000);
	// Both directions. A delivery from the future is a clock that is wrong, and
	// accepting it would mean accepting one whose `t` was chosen by an attacker.
	if (Math.abs(now - said.t) > tolerance) {
		throw new BadSignature(`it is ${Math.abs(now - said.t)}s old, and the tolerance is ${tolerance}s`);
	}

	const key = await crypto.subtle.importKey(
		'raw',
		enc.encode(input.secret),
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign']
	);
	const signed = await crypto.subtle.sign('HMAC', key, enc.encode(`${said.t}.${input.body}`));

	if (!same(hex(signed), said.v1)) throw new BadSignature('it does not match the body');

	return JSON.parse(input.body) as Delivery<T>;
}
