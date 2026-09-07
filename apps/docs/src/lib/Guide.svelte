<script lang="ts">
	/**
	 * The frame a guide is written inside.
	 *
	 * A component rather than eight pages each with their own header: the title,
	 * the standfirst and the next-page link are the same shape every time, and
	 * eight copies of them is eight chances for one page to look like a different
	 * site.
	 */
	import { Button } from '@cyka/ui';
	import { GUIDES } from '$lib/nav';
	import { page } from '$app/state';

	let {
		title,
		lede,
		children
	}: { title: string; lede: string; children: import('svelte').Snippet } = $props();

	const at = $derived(GUIDES.findIndex((one) => one.href === page.url.pathname));
	const next = $derived(at >= 0 ? GUIDES[at + 1] : undefined);
</script>

<svelte:head>
	<title>{title} — acyka api</title>
	<meta name="description" content={lede} />
</svelte:head>

<article class="prose guide">
	<h1>{title}</h1>
	<p class="lede">{lede}</p>

	{@render children()}

	{#if next}
		<footer>
			<p class="onwards">next</p>
			<Button variant="ghost" href={next.href}>{next.label} →</Button>
		</footer>
	{/if}
</article>

<style>
	.guide {
		max-width: 48rem;
	}

	.lede {
		font-size: var(--fs-sub);
		color: var(--text-2);
	}

	footer {
		margin-top: var(--s-12);
		padding-top: var(--s-4);
		border-top: 1px solid var(--border);
	}

	.onwards {
		margin: 0 0 var(--s-2);
		font-size: var(--fs-tiny);
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--text-muted);
	}
</style>
