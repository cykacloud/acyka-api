import { blocks, sh, ts } from '$lib/server/guide';

export async function load() {
	return {
		blocks: await blocks({
			headers: sh(`X-RateLimit-Limit: 60
X-RateLimit-Remaining: 58
X-RateLimit-Reset: 31`),
			refused: sh(`HTTP/1.1 429 Too Many Requests
Retry-After: 31
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 31

{"message":"common.tooOften"}`),
			watching: ts(`const acyka = Acyka.app(credentials, {
  retries: 3,          // 0 turns retrying off entirely
  maxWait: 65_000,     // past this a RateLimited is raised rather than slept through
  onPace: ({ remaining, reset }) => metrics.gauge('acyka.left', remaining)
});`)
		})
	};
}
