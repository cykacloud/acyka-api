<script lang="ts">
	/**
	 * Where the consent screen sends somebody back.
	 *
	 * Nothing is rendered for long: the code is exchanged, the token is put in
	 * `sessionStorage`, and the address the reader started from is restored with
	 * `replaceState` so the code never stays in their history.
	 */
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { signed } from '$lib/auth.svelte';

	let failed = $state('');

	onMount(async () => {
		const params = page.url.searchParams;

		// The provider's own refusal comes back on the query string, and it is a
		// name rather than a sentence for the same reason everything else here is.
		const refused = params.get('error');
		if (refused) {
			failed = params.get('error_description') ?? refused;
			return;
		}

		const code = params.get('code');
		const state = params.get('state');
		if (!code || !state) {
			failed = 'the callback arrived with nothing in it';
			return;
		}

		try {
			const back = await signed.finish(code, state);
			// `replaceState`, so pressing back does not return to a spent code.
			await goto(back || '/playground', { replaceState: true });
		} catch (err) {
			failed = err instanceof Error ? err.message : 'the exchange failed';
		}
	});
</script>

<svelte:head>
	<title>Signing in — acyka api</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<div class="wait prose">
	{#if failed}
		<h1>That did not work</h1>
		<p>{failed}</p>
		<p><a href="/playground">Back to the playground</a></p>
	{:else}
		<h1>Signing in…</h1>
		<p>Swapping the code for a token. This takes a moment.</p>
	{/if}
</div>

<style>
	.wait {
		max-width: 32rem;
		margin: 0 auto;
		padding-top: var(--s-12);
		text-align: center;
	}
</style>
