import { contract } from '$lib/server/contract';
import { coloured } from '$lib/server/highlight';

/**
 * The two blocks on the front page, coloured on the server.
 *
 * Written out rather than generated: the front page is an argument about what
 * this api is for, and the shortest honest call is a better argument than the
 * most representative one.
 */
const HELLO = `import { Acyka } from '@acyka/api';

// a bot has nobody to sign in, so it acts for itself
const acyka = Acyka.app({ clientId, clientSecret });

const found = await acyka.catalogue.listTitles({ q: 'frieren', limit: 5 });
//    ^? Page<TitleCard>

for await (const title of acyka.catalogue.listTitlesAll({ genre: 'Drama' })) {
  console.log(title.title, title.year);
}`;

const THEIRS = `// and acting for a person, with a token that renews itself
const theirs = Acyka.user({ clientId, clientSecret }, tokens, save);

const me = await theirs.account.getMe();
await theirs.library.saveListEntry({
  shikimori_id: 52991,
  body: { title: 'Sousou no Frieren', status: 'watching', episode: 4 }
});`;

export async function load() {
	const api = contract();
	return {
		counts: {
			operations: api.ops.length,
			models: api.models.length,
			scopes: api.scopes.length
		},
		hello: await coloured(HELLO, 'typescript'),
		theirs: await coloured(THEIRS, 'typescript'),
		helloCode: HELLO,
		theirsCode: THEIRS
	};
}
