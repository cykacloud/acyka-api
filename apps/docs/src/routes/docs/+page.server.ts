import { blocks, sh, ts } from '$lib/server/guide';
import { contract } from '$lib/server/contract';

export async function load() {
	const api = contract();
	return {
		counts: { operations: api.ops.length, models: api.models.length },
		blocks: await blocks({
			install: sh(`bun add @acyka/api      # or npm / pnpm / yarn
pip install acyka
cargo add acyka`),
			first: ts(`import { Acyka } from '@acyka/api';

// An application acting for itself. No person signs in, so there is no
// consent screen and nothing to store — the token is minted when it is
// first needed and again when it expires.
const acyka = Acyka.app({
  clientId: process.env.ACYKA_ID!,
  clientSecret: process.env.ACYKA_SECRET!
});

const found = await acyka.catalogue.listTitles({ q: 'frieren', limit: 5 });

for (const title of found.items) {
  console.log(title.id, title.title, title.year, title.score);
}`),
			curl: sh(`# the same call, which is the one you can check by hand
# the provider is on acyka.cc — its endpoints hang off the issuer, and
# the discovery document is the authority on all of them
TOKEN=$(curl -s https://acyka.cc/api/oauth2/token \\
  -u "$ACYKA_ID:$ACYKA_SECRET" \\
  -d grant_type=client_credentials \\
  -d scope=catalog:read | jq -r .access_token)

curl "https://api.acyka.cc/api/v1/titles?q=frieren&limit=5" \\
  -H "Authorization: Bearer $TOKEN"`)
		})
	};
}
