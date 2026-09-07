/**
 * Verification, which is the one piece of this library that is a security
 * boundary rather than a convenience — so the tests are the attacks.
 */
import { describe, expect, test } from 'bun:test';
import { BadSignature, verify } from '../src/webhooks';

const SECRET = 'acyw_0123456789abcdef';
const BODY = JSON.stringify({ event: 'list.saved', data: { shikimori_id: 21 } });

async function sign(body: string, at: number, secret = SECRET): Promise<string> {
	const key = await crypto.subtle.importKey(
		'raw',
		new TextEncoder().encode(secret),
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign']
	);
	const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${at}.${body}`));
	const hex = [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, '0')).join('');
	return `t=${at},v1=${hex}`;
}

const now = 1_700_000_000;
const millis = now * 1000;

describe('a delivery that is ours', () => {
	test('comes back parsed', async () => {
		const event = await verify<{ shikimori_id: number }>({
			body: BODY,
			signature: await sign(BODY, now),
			secret: SECRET,
			now: millis
		});
		expect(event.event).toBe('list.saved');
		expect(event.data.shikimori_id).toBe(21);
	});
});

describe('and one that is not', () => {
	test('a body that was edited after signing', async () => {
		const signature = await sign(BODY, now);
		const tampered = JSON.stringify({ event: 'list.saved', data: { shikimori_id: 22 } });
		expect(verify({ body: tampered, signature, secret: SECRET, now: millis })).rejects.toThrow(
			BadSignature
		);
	});

	test('a signature made with another secret', async () => {
		const signature = await sign(BODY, now, 'acyw_someone_elses');
		expect(verify({ body: BODY, signature, secret: SECRET, now: millis })).rejects.toThrow(
			BadSignature
		);
	});

	test('a replay of a real delivery from an hour ago', async () => {
		// The whole reason the timestamp is inside the signed string. Signing the
		// body alone gives a signature that never stops being valid.
		const signature = await sign(BODY, now - 3600);
		expect(verify({ body: BODY, signature, secret: SECRET, now: millis })).rejects.toThrow(
			/3600s old/
		);
	});

	test('a delivery from the future, which is a clock somebody chose', async () => {
		const signature = await sign(BODY, now + 3600);
		expect(verify({ body: BODY, signature, secret: SECRET, now: millis })).rejects.toThrow(
			BadSignature
		);
	});

	test('no header at all', async () => {
		expect(verify({ body: BODY, signature: null, secret: SECRET, now: millis })).rejects.toThrow(
			/no signature header/
		);
	});

	test('a header in some other shape', async () => {
		for (const nonsense of ['', 'deadbeef', 'v1=deadbeef', 't=notanumber,v1=x']) {
			expect(
				verify({ body: BODY, signature: nonsense, secret: SECRET, now: millis })
			).rejects.toThrow(BadSignature);
		}
	});

	test('a signature of the right length that is wrong', async () => {
		// The constant-time compare's own case: same length, every byte wrong.
		const real = await sign(BODY, now);
		const wrong = real.replace(/v1=.*/, `v1=${'0'.repeat(64)}`);
		expect(verify({ body: BODY, signature: wrong, secret: SECRET, now: millis })).rejects.toThrow(
			/does not match/
		);
	});
});

describe('the tolerance', () => {
	test('is five minutes by default, and movable', async () => {
		const signature = await sign(BODY, now - 290);
		await verify({ body: BODY, signature, secret: SECRET, now: millis });

		const older = await sign(BODY, now - 310);
		expect(verify({ body: BODY, signature: older, secret: SECRET, now: millis })).rejects.toThrow(
			BadSignature
		);
		// a caller who knows their queue is slow can say so
		await verify({ body: BODY, signature: older, secret: SECRET, now: millis, tolerance: 600 });
	});
});
