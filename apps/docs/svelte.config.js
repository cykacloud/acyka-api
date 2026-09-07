import adapter from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
export default {
	preprocess: vitePreprocess(),
	kit: {
		adapter: adapter(),
		alias: {
			// The generator's reader, imported rather than copied. One description
			// of what `allOf` means and what `Items_TitleCard` is, shared by the
			// six libraries and by the pages that document them — a second copy
			// here would be a reference that disagreed with the clients.
			'$tools': '../../tools',
			'$contract': '../../openapi.json'
		}
	}
};
