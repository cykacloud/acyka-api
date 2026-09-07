import { blocks, js, sh, ts } from '$lib/server/guide';

export async function load() {
	return {
		blocks: await blocks({
			delivery: sh(`POST /your/endpoint HTTP/1.1
Content-Type: application/json
User-Agent: acyka-webhooks/1
X-Acyka-Event: episode.aired
X-Acyka-Delivery: 84213
X-Acyka-Signature: t=1700000000,v1=5bdcc146bf60754e6a04…

{"event":"episode.aired","data":{"shikimori_id":52991,"episode":18}}`),
			verify: ts(`import { verify, BadSignature } from '@acyka/api';

export async function POST({ request }) {
  const raw = await request.text();   // the raw text, before any parsing

  try {
    const event = await verify({
      body: raw,
      signature: request.headers.get('x-acyka-signature'),
      secret: process.env.ACYKA_WEBHOOK_SECRET!
    });

    // Answer first, work afterwards: an endpoint that does five seconds of
    // work before answering is an endpoint that gets retried while it works.
    queue.push(event);
    return new Response(null, { status: 204 });
  } catch (err) {
    if (err instanceof BadSignature) return new Response(null, { status: 400 });
    throw err;
  }
}`),
			payload: js(`{
  "event": "list.saved",
  "data": {
    "user_id": "1204",
    "shikimori_id": 52991,
    "title": "Sousou no Frieren",
    "status": "watching",
    "episode": 4,
    "score": null
  }
}`)
		})
	};
}
