/**
 * `openapi.json` in, the generated half of six client libraries out.
 *
 * Run it with `bun run generate`. It writes files and nothing else — no network,
 * no install, no formatter — so it can run in CI on a bare machine and its output
 * can be committed and read in a diff. **That is the point of committing it:** a
 * generator whose output nobody looks at is a generator whose mistakes ship, and
 * a change to the contract should show up in a pull request as the six changes it
 * actually causes.
 */

import { read } from './spec';
import { emitters } from './emit';

const root = new URL('..', import.meta.url).pathname;
const api = read(await Bun.file(`${root}openapi.json`).json());

let written = 0;
for (const emit of emitters) {
	for (const [path, body] of Object.entries(emit(api))) {
		const at = `${root}${path}`;
		const before = await Bun.file(at)
			.text()
			.catch(() => '');
		// Only touch a file whose content changed, so a run that changes nothing
		// leaves no timestamps behind for a watcher to chase.
		if (before !== body) {
			await Bun.write(at, body.endsWith('\n') ? body : `${body}\n`);
			written += 1;
			console.log(`  ${path}`);
		}
	}
}

console.log(
	`${api.ops.length} operations, ${api.models.length} models, ${written} file${written === 1 ? '' : 's'} written`
);
