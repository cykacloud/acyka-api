import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

/**
 * The playground talks to the live api from the browser, and that is the point.
 *
 * There is no proxy here and there deliberately is not one: a proxy would make
 * the playground work in a way no reader's own application can copy, and would
 * quietly paper over the CORS rule that is the whole reason a browser client can
 * use this api at all. If `api.acyka.cc` stops answering a cross-site request,
 * the playground should break — that is a real signal about the door rather
 * than a local inconvenience.
 */
export default defineConfig({
	plugins: [sveltekit()],
	server: { port: 5174 },
	preview: { port: 5174 }
});
