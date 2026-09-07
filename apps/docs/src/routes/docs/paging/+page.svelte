<script lang="ts">
	import Code from '$lib/Code.svelte';
	import Guide from '$lib/Guide.svelte';

	let { data } = $props();
</script>

<Guide
	title="Paging"
	lede="Offset and limit, a total you should not count against, and the loop each library writes for you."
>
	<p>A collection answers one shape:</p>

	<Code code={data.blocks.shape.code} html={data.blocks.shape.html} />

	<p>
		<code>limit</code> is 1–100 and 30 by default. <code>offset</code> is where to carry on from.
		<code>total</code> is there wherever the caller pages by offset, because that is exactly when
		somebody has to know how far the list goes.
	</p>

	<h2 id="stop-on-a-short-page">
		Stop on a short page, not on <code>total</code>
		<a class="anchor" href="#stop-on-a-short-page" aria-label="a link to this section">#</a>
	</h2>

	<p>
		This is the one thing worth reading on this page. <code>total</code> is a count taken at the
		moment of the query, and these lists change while they are being read — somebody adds a title,
		a shelf goes private, an import lands. A loop that counts against it either asks for a page
		that is not there or stops before the end.
	</p>

	<p>
		<strong>The test is whether the page came back shorter than it asked for.</strong> Every library
		here does that, and every one of them has a test for it against a server that reports
		<code>total: 4000</code> and hands back five rows.
	</p>

	<Code code={data.blocks.loop.code} html={data.blocks.loop.html} label="the paginator" />
	<Code code={data.blocks.byHand.code} html={data.blocks.byHand.html} label="or by hand" />

	<h2 id="ordering">
		The order is stable
		<a class="anchor" href="#ordering" aria-label="a link to this section">#</a>
	</h2>

	<p>
		Every ordering the catalogue offers ties, and heavily — thousands of titles share a score and
		most share a vote count. A tie the database is free to break differently between two queries is
		a row handed out on page two and again on page three, with another skipped in between. So every
		ordering ends in the id, which is unique and settles every tie the same way twice.
	</p>

	<h2 id="which">
		Which operations page
		<a class="anchor" href="#which" aria-label="a link to this section">#</a>
	</h2>

	<p>
		These {data.paging.length}, read off the contract — an operation gets a paginator when it takes
		both <code>limit</code> and <code>offset</code>, because a loop with only one of the two either
		never advances or cannot be sized.
	</p>

	<ul class="which">
		{#each data.paging as op (op.id)}
			<li>
				<a href="/reference/{op.slug}"><code>{op.path.replace('/api/v1', '')}</code></a>
			</li>
		{/each}
	</ul>

	<p>
		Everything else answers a whole list, and that is a promise rather than an oversight: a title's
		staff, a character's voices and the week's calendar are bounded by what they are, so paging
		them would be a parameter with nothing behind it.
	</p>
</Guide>

<style>
	.which {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-wrap: wrap;
		gap: var(--s-1);
	}
	.which a {
		display: inline-block;
		padding: 3px var(--s-2);
		border: 1px solid var(--border);
		border-radius: var(--r-control);
		font-size: var(--fs-tiny);
		text-decoration: none;
	}
	.which a:hover {
		border-color: var(--accent-soft);
		background: var(--accent-faint);
		text-decoration: none;
	}
</style>
