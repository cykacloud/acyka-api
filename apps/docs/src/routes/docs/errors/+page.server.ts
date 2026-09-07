import { blocks, js, ts } from '$lib/server/guide';

export async function load() {
	return {
		blocks: await blocks({
			shape: js(`{
  "message": "errors.oauthInsufficientScope",
  "scope": "lists:write"
}`),
			typed: ts(`import { Forbidden, NotFound, RateLimited } from '@acyka/api';

try {
  await theirs.library.listMyList();
} catch (err) {
  if (err instanceof Forbidden) {
    // refreshing will not help: the token does not carry it
    ask(err.scope);
  } else if (err instanceof RateLimited) {
    console.log('retry in', err.retryAfter, 'seconds');
  } else if (err instanceof NotFound) {
    return null;
  }
  throw err;
}`),
			own: ts(`// your own words, keyed by the name
const SAYS: Record<string, string> = {
  'errors.oauthInsufficientScope': 'This app has not been allowed that yet.',
  'errors.suspended': 'That account is suspended.'
};

const shown = SAYS[err.code] ?? 'Something went wrong.';`)
		})
	};
}
