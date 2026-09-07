<script lang="ts">
	import { Button } from '@cyka/ui';
	import Code from '$lib/Code.svelte';
	import { LANGUAGES } from '$lib/type';

	let { data } = $props();
</script>

<svelte:head>
	<title>acyka api — the catalogue, and one account's own things, behind a token</title>
	<meta
		name="description"
		content="The acyka API: {data.counts.operations} operations over the anime catalogue, public profiles and one account's lists and writing. Client libraries for six languages, all generated from one contract."
	/>
</svelte:head>

<div class="front">
	<header class="hero">
		<p class="eyebrow">one contract · six libraries · a playground</p>
		<h1>
			The catalogue, and one account's own things,<br />
			behind a token.
		</h1>
		<p class="lede">
			{data.counts.operations} operations over the anime catalogue, public profiles, and the lists,
			shelves and writing of whoever authorised your application. Every one of them is the same
			function acyka's own site calls, so what you read is what it reads.
		</p>

		<div class="doors">
			<Button size="lg" href="/docs">Start here</Button>
			<Button size="lg" variant="ghost" href="/reference">Reference</Button>
			<Button size="lg" variant="ghost" href="/playground">Playground</Button>
		</div>
	</header>

	<section class="show">
		<Code code={data.helloCode} html={data.hello} label="looking things up" />
		<Code code={data.theirsCode} html={data.theirs} label="acting for a person" />
	</section>

	<section class="why">
		<article>
			<h2>Generated from the server itself</h2>
			<p>
				<code>openapi.json</code> is written by the api from annotations that sit on its own
				handlers, and a test there drives every path in it against the real router. A route that
				changes shape changes the libraries in the same release, and a path that does not exist
				cannot be described.
			</p>
		</article>

		<article>
			<h2>Six libraries, one reader</h2>
			<p>
				The types and the methods are generated; the transport, the four OAuth flows, the token
				that renews itself, the paginators and one error type per refusal are written by hand in
				each language — because that is the half that decides whether a client is pleasant rather
				than merely correct.
			</p>
			<ul class="langs">
				{#each LANGUAGES as language (language.id)}
					<li><code>{language.label}</code></li>
				{/each}
			</ul>
		</article>

		<article>
			<h2>It tells you how much is left</h2>
			<p>
				Every answer carries <code>X-RateLimit-Remaining</code> and
				<code>X-RateLimit-Reset</code>, and a 429 carries <code>Retry-After</code> — including the
				429 itself. Each library reads them and waits exactly as long as the server asked, rather
				than guessing.
			</p>
		</article>

		<article>
			<h2>Or it tells you, instead of you asking</h2>
			<p>
				Seven webhook events — an episode airing, the three ways a list row moves, a post, and the
				two ends of a follow. Signed, queued in a table rather than in memory, and retried for
				about a day, so an application that was down for ten minutes finds out what it missed.
			</p>
		</article>

		<article>
			<h2>Absent is not zero</h2>
			<p>
				A follower count that is missing means “not yours to know”; a <code>0</code> means
				“nobody”. Every library keeps the two apart, because collapsing them is the one thing this
				api's own rules say a client must not do.
			</p>
		</article>

		<article>
			<h2>{data.counts.scopes} scopes, each with something behind it</h2>
			<p>
				A scope is added on the day the thing it guards starts checking for it, not on the day
				somebody imagines the feature. A consent screen that lists something nothing honours
				teaches people that agreeing is a formality.
			</p>
		</article>
	</section>

	<footer class="close">
		<p>
			<a href="https://acyka.cc">acyka.cc</a>
			·
			<a href="https://github.com/cykacloud/acyka-api">the source</a>
			·
			<a href="/reference">{data.counts.operations} operations, {data.counts.models} shapes</a>
		</p>
	</footer>
</div>

<style>
	.front {
		max-width: 62rem;
		margin: 0 auto;
		display: flex;
		flex-direction: column;
		gap: var(--s-12);
	}

	.hero {
		padding-top: var(--s-6);
	}

	.eyebrow {
		margin: 0 0 var(--s-3);
		font-family: var(--font-mono);
		font-size: var(--fs-tiny);
		letter-spacing: 0.04em;
		color: var(--accent-hover);
	}

	h1 {
		margin: 0;
		font-size: clamp(2rem, 5vw, 3.25rem);
		line-height: 1.08;
		letter-spacing: -1.5px;
		color: var(--text-title);
	}

	.lede {
		max-width: 44rem;
		margin: var(--s-4) 0 0;
		font-size: var(--fs-sub);
		line-height: 1.6;
		color: var(--text-caption);
	}

	.doors {
		display: flex;
		flex-wrap: wrap;
		gap: var(--s-2);
		margin-top: var(--s-6);
	}

	.show {
		display: grid;
		gap: var(--s-4);
	}

	.why {
		display: grid;
		gap: var(--s-6);
	}

	.why article {
		display: flex;
		flex-direction: column;
		gap: var(--s-2);
	}

	.why h2 {
		margin: 0;
		font-size: var(--fs-h3);
		letter-spacing: -0.3px;
		color: var(--text-title);
	}

	.why p {
		margin: 0;
		line-height: 1.6;
		color: var(--text-caption);
	}

	.why code {
		font-family: var(--font-mono);
		font-size: 0.88em;
		padding: 0.1em 0.3em;
		border-radius: var(--r-sm);
		background: var(--surface-2);
		color: var(--text-title);
	}

	.langs {
		display: flex;
		flex-wrap: wrap;
		gap: var(--s-1);
		list-style: none;
		margin: var(--s-1) 0 0;
		padding: 0;
	}

	.close {
		padding-top: var(--s-6);
		border-top: 1px solid var(--border);
		color: var(--text-muted);
		font-size: var(--fs-sub);
	}
	.close p {
		margin: 0;
	}

	@media (min-width: 780px) {
		.show {
			grid-template-columns: 1fr 1fr;
			align-items: start;
		}
		.why {
			grid-template-columns: 1fr 1fr;
			gap: var(--s-8) var(--s-6);
		}
	}
</style>
