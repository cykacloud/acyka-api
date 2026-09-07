<script lang="ts">
	/**
	 * The same call in seven languages, one visible at a time.
	 *
	 * **The choice is remembered.** A reader working in Rust who has to press
	 * "Rust" on every one of forty-three pages is a reader who stops reading, so
	 * the tab is written to `localStorage` and every block on the site opens on
	 * it. Read through a `try` because a browser with site data blocked throws
	 * rather than answering — and a documentation page must not be the thing
	 * that breaks.
	 */
	import { Tabs } from '@cyka/ui';
	import Code from '$lib/Code.svelte';

	let {
		samples
	}: { samples: { id: string; label: string; code: string; html?: string }[] } = $props();

	const KEY = 'acyka:docs:language';

	function remembered(): string {
		try {
			const said = localStorage.getItem(KEY);
			if (said && samples.some((s) => s.id === said)) return said;
		} catch {
			// site data is blocked, which is a preference rather than a fault
		}
		return samples[0]?.id ?? '';
	}

	// Empty until the browser says otherwise, so the server and the browser agree
	// about what was rendered — reading storage during render would be a
	// hydration mismatch on every page. `showing` falls back to the first
	// sample, so an empty choice draws the same thing the server drew.
	let chosen = $state('');

	$effect(() => {
		chosen = remembered();
	});

	$effect(() => {
		if (!chosen) return;
		try {
			localStorage.setItem(KEY, chosen);
		} catch {
			// as above
		}
	});

	const showing = $derived(samples.find((s) => s.id === chosen) ?? samples[0]);
</script>

<div class="samples">
	<Tabs items={samples.map((s) => ({ id: s.id, label: s.label }))} bind:value={chosen} scroll />
	{#if showing}
		{#key showing.id}
			<Code code={showing.code} html={showing.html} />
		{/key}
	{/if}
</div>

<style>
	.samples {
		display: flex;
		flex-direction: column;
		gap: var(--s-2);
	}
</style>
