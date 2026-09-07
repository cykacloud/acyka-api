import { blocks, js, ts } from '$lib/server/guide';
import { contract } from '$lib/server/contract';
import { slug } from '$lib/slug';

export async function load() {
	const paging = contract()
		.ops.filter((op) => op.pages)
		.map((op) => ({ id: op.id, path: op.path, slug: slug(op.id) }));

	return {
		paging,
		blocks: await blocks({
			shape: js(`{
  "items": [ … ],
  "total": 1284
}`),
			loop: ts(`for await (const title of acyka.catalogue.listTitlesAll({ genre: 'Drama' })) {
  console.log(title.title);
}`),
			byHand: ts(`// what the paginator does, if you would rather do it yourself
let offset = 0;
const limit = 100;

for (;;) {
  const page = await acyka.catalogue.listTitles({ genre: 'Drama', limit, offset });
  for (const title of page.items) use(title);

  // The test is the page's own length, never \`total\`.
  if (page.items.length < limit) break;
  offset += page.items.length;
}`)
		})
	};
}
