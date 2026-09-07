<script lang="ts">
	/**
	 * One block of code, coloured on the server and copyable in the browser.
	 *
	 * `html` is what shiki produced. When there is none — a block written in a
	 * guide that the loader did not colour — the plain text is shown, which is
	 * readable and is better than nothing arriving at all.
	 */
	import { CopyButton, toast } from '@cyka/ui';

	let {
		code,
		html,
		label
	}: { code: string; html?: string; label?: string } = $props();
</script>

<figure>
	{#if label}
		<figcaption>{label}</figcaption>
	{/if}

	<div class="block">
		{#if html}
			<!-- shiki's own markup: spans with inline colours, nothing else -->
			{@html html}
		{:else}
			<pre><code>{code}</code></pre>
		{/if}

		<span class="copy">
			<CopyButton value={code} onfail={() => toast('could not copy', 'error')} />
		</span>
	</div>
</figure>

<style>
	figure {
		margin: 0;
	}

	figcaption {
		font-family: var(--font-mono);
		font-size: var(--fs-tiny);
		color: var(--text-muted);
		padding: var(--s-1) var(--s-3);
		border: 1px solid var(--border);
		border-bottom: none;
		border-radius: var(--r-md) var(--r-md) 0 0;
		background: var(--surface-2);
	}

	.block {
		position: relative;
		border: 1px solid var(--border);
		border-radius: var(--r-md);
		background: var(--surface);
		overflow: hidden;
	}

	figcaption + .block {
		border-radius: 0 0 var(--r-md) var(--r-md);
	}

	.block :global(pre) {
		margin: 0;
		padding: var(--s-3) var(--s-4);
		overflow-x: auto;
		font-family: var(--font-mono);
		font-size: var(--fs-sub);
		line-height: 1.6;
		/* shiki writes its own background; the site's own is what should show */
		background: transparent !important;
	}

	.copy {
		position: absolute;
		top: var(--s-1);
		right: var(--s-1);
		opacity: 0;
		transition: opacity var(--t) var(--ease-out);
	}

	.block:hover .copy,
	.copy:focus-within {
		opacity: 1;
	}

	/* A copy button that only appears on hover is a copy button a touch screen
	   has no way to reach. */
	@media (hover: none) {
		.copy {
			opacity: 1;
		}
	}
</style>
