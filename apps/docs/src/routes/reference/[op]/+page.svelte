<script lang="ts">
	import { Badge, Button, Tabs } from '@cyka/ui';
	import Fields from '$lib/Fields.svelte';
	import Samples from '$lib/Samples.svelte';
	import { LANGUAGES, links, optional, written, type Language } from '$lib/type';
	import { slug } from '$lib/slug';

	let { data } = $props();

	const op = $derived(data.op);

	/**
	 * Which language the shapes are written in.
	 *
	 * Its own state rather than the samples' one: the tab strip above the code is
	 * `Samples`' business and this is the table's, and binding them together
	 * would mean a reader who wants the curl example loses the Rust types.
	 */
	let language = $state<Language>('typescript');

	const paragraphs = $derived((op.doc ?? '').split('\n\n').filter(Boolean));
	const answer = $derived(op.ok.ty);
	const query = $derived(op.params.filter((p) => p.where === 'query'));
	const path = $derived(op.params.filter((p) => p.where === 'path'));
</script>

<svelte:head>
	<title>{op.id} — acyka api</title>
	<meta name="description" content={op.summary ?? `${op.method} ${op.path}`} />
</svelte:head>

<article class="prose op">
	<header>
		<p class="where">
			<span class="verb" data-verb={op.method}>{op.method}</span>
			<code>{op.path}</code>
		</p>
		<h1>{op.id}</h1>
		{#if op.scope}
			<p class="needs">
				needs <a href="/docs/scopes#{op.scope.replace(':', '-')}"><code>{op.scope}</code></a>
			</p>
		{/if}
	</header>

	{#each paragraphs as text, i (i)}
		<p>{text}</p>
	{/each}

	<Samples samples={data.samples} />

	<h2 id="asking">
		Asking
		<a class="anchor" href="#asking" aria-label="a link to this section">#</a>
	</h2>

	{#if !op.params.length && !op.body}
		<p>Nothing. The address is the whole of the question.</p>
	{:else}
		<div class="langs">
			<!-- `scroll`, because seven tabs do not fit a phone and a strip that
			     wraps to two lines moves the table under it every time somebody
			     switches. -->
			<Tabs
				items={LANGUAGES.map((one) => ({ id: one.id, label: one.label }))}
				bind:value={language}
				scroll
			/>
		</div>

		{#if path.length}
			<h3>In the address</h3>
			<Fields
				fields={path.map((p) => ({ name: p.name, ty: p.ty, optional: false, doc: p.doc }))}
				{language}
			/>
		{/if}

		{#if query.length}
			<h3>Narrowing it</h3>
			<Fields
				fields={query.map((p) => ({
					name: p.name,
					ty: p.ty,
					optional: !p.required,
					doc: p.doc
				}))}
				{language}
			/>
		{/if}

		{#if op.body}
			<h3>The body</h3>
			<p>
				<code>{op.body.model}</code>, sent as JSON. Every field it has is under
				<a href="#shape-{op.body.model}">the shapes</a> below.
			</p>
		{/if}
	{/if}

	<h2 id="answer">
		Answering
		<a class="anchor" href="#answer" aria-label="a link to this section">#</a>
	</h2>

	<p class="status">
		<Badge>{op.ok.status}</Badge>
		{#if answer}
			<code>{written(answer, language)}</code>
			{#if answer.k === 'page'}
				<span class="aside">
					a page: <code>items</code>, and <code>total</code> beside it
				</span>
			{/if}
		{:else}
			<span class="aside">nothing — the status line carries the news</span>
		{/if}
	</p>

	{#if op.pages}
		<p>
			It pages by <code>limit</code> and <code>offset</code>. Every library has a paginator that
			walks it — see <a href="/docs/paging">Paging</a>, which is also where the reason it stops on a
			short page rather than on <code>total</code> is written down.
		</p>
	{/if}

	{#if data.shapes.length}
		<h2 id="shapes">
			The shapes
			<a class="anchor" href="#shapes" aria-label="a link to this section">#</a>
		</h2>

		{#each data.shapes as shape (shape.name)}
			<section class="shape">
				<h3 id="shape-{shape.name}">
					<code>{shape.name}</code>
					<a class="anchor" href="#shape-{shape.name}" aria-label="a link to this shape">#</a>
				</h3>
				{#each (shape.doc ?? '').split('\n\n').filter(Boolean) as text, i (i)}
					<p>{text}</p>
				{/each}
				<Fields fields={shape.fields} {language} />
			</section>
		{/each}
	{/if}

	<h2 id="refusals">
		When it says no
		<a class="anchor" href="#refusals" aria-label="a link to this section">#</a>
	</h2>

	<p>
		A refusal is <code>{'{ "message": "errors.something" }'}</code> — a phrase name and never a
		sentence, because one screen can be read in five languages. Every library turns the name into a
		type, so you catch the class you can do something about. <a href="/docs/errors">Errors</a> has
		the list.
	</p>

	<footer>
		<Button variant="ghost" href="/playground?op={slug(op.id)}">Try it in the playground</Button>
	</footer>
</article>

<style>
	.op {
		max-width: 54rem;
	}

	header {
		display: flex;
		flex-direction: column;
		gap: var(--s-2);
	}

	.where {
		display: flex;
		align-items: center;
		gap: var(--s-2);
		margin: 0;
		font-family: var(--font-mono);
		font-size: var(--fs-sub);
	}

	.verb {
		padding: 2px 8px;
		border-radius: var(--r-sm);
		font-size: var(--fs-tiny);
		font-weight: 700;
		letter-spacing: 0.04em;
		background: var(--surface-3);
		color: var(--text-title);
	}
	/* A verb is coloured by what it does to the world, not by fashion: reads are
	   quiet, writes are the accent, and a delete is the one worth a second look. */
	.verb[data-verb='GET'] {
		background: var(--surface-3);
		color: var(--text-2);
	}
	.verb[data-verb='POST'],
	.verb[data-verb='PUT'] {
		background: var(--accent-faint);
		color: var(--accent-hover);
	}
	.verb[data-verb='DELETE'] {
		background: color-mix(in oklab, var(--red) 18%, transparent);
		color: var(--red);
	}

	.needs {
		margin: 0;
		font-size: var(--fs-sub);
		color: var(--text-muted);
	}

	.langs {
		margin: var(--s-4) 0 var(--s-2);
	}

	.status {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: var(--s-2);
	}

	.aside {
		color: var(--text-muted);
		font-size: var(--fs-sub);
	}

	.shape {
		margin-top: var(--s-6);
	}

	footer {
		margin-top: var(--s-8);
		padding-top: var(--s-4);
		border-top: 1px solid var(--border);
	}
</style>
