import { blocks, sh, ts } from '$lib/server/guide';

export async function load() {
	return {
		blocks: await blocks({
			app: ts(`// A bot, a cron, anything with no person in front of it.
const acyka = Acyka.app({ clientId, clientSecret });`),
			start: ts(`import { authorizeUrl, pkce } from '@acyka/api';

// 1. before the redirect. Keep both of these in the session.
const { verifier, challenge } = await pkce();
const state = crypto.randomUUID();

redirect(authorizeUrl({
  clientId,
  redirectUri: 'https://example.com/callback',
  scopes: ['openid', 'profile', 'lists:read', 'offline_access'],
  challenge,
  state
}));`),
			finish: ts(`import { Acyka, exchangeCode } from '@acyka/api';

// 2. in the callback. Compare the state *first*: without it, anybody who
//    can make a browser visit this route can hand it a code of their own.
if (given.state !== stored.state) throw new Error('the state did not match');

const tokens = await exchangeCode({
  clientId, clientSecret,
  code: given.code,
  redirectUri: 'https://example.com/callback',
  verifier: stored.verifier
});

// 3. and from then on. \`keep\` is told every time the set is replaced.
const theirs = Acyka.user({ clientId, clientSecret }, tokens, (fresh) =>
  save(userId, fresh)
);`),
			device: ts(`import { awaitDevice, startDevice, Acyka } from '@acyka/api';

const started = await startDevice({ clientId, scopes: ['openid', 'lists:read'] });
console.log(\`go to \${started.verification_uri} and type \${started.user_code}\`);

// Polls, backs off when told to, and stops when somebody presses cancel.
const tokens = await awaitDevice({
  clientId,
  deviceCode: started.device_code,
  interval: started.interval
});`),
			discovery: sh(`curl https://acyka.cc/.well-known/openid-configuration`)
		})
	};
}
