<script lang="ts">
	/**
	 * The same api, from a browser, signed in as whoever is reading.
	 *
	 * **It talks to the live api directly.** No proxy on this server, and that is
	 * the whole point: every request from this page is a cross-site request from a
	 * browser carrying a bearer token, which is exactly what a reader's own
	 * single-page application will make. If the api's CORS rule ever stops
	 * allowing that, it breaks here — on the site that documents it — rather than
	 * in somebody's project a month later.
	 *
	 * Writes are marked and are real. There is no sandbox: a token acts for an
	 * account, and pretending otherwise would be a playground that teaches the
	 * wrong thing about what a token can do.
	 */
	import { page } from '$app/state';
	import { Badge, Button, Input, Search, TextArea, Tabs } from '@cyka/ui';
	import IconSearch from '@tabler/icons-svelte/icons/search';
	import IconPlayerPlay from '@tabler/icons-svelte/icons/player-play';
	import IconAlertTriangle from '@tabler/icons-svelte/icons/alert-triangle';
	import Code from '$lib/Code.svelte';
	import { ASKING, send, signed, type Answer } from '$lib/auth.svelte';

	let { data } = $props();

	type Op = (typeof data.ops)[number];

	let filter = $state('');
	let chosen = $state<Op | undefined>(undefined);
	let values = $state<Record<string, string>>({});
	let body = $state('{\n  \n}');
	let answer = $state<Answer | null>(null);
	let running = $state(false);
	let failed = $state('');

	/** The operation named in `?op=`, so a reference page can link straight here. */
	$effect(() => {
		const asked = page.url.searchParams.get('op');
		if (!asked || chosen) return;
		const found = data.ops.find((op) => op.slug === asked);
		if (found) pick(found);
	});

	const showing = $derived.by(() => {
		const asked = filter.trim().toLowerCase();
		const all = data.ops;
		if (!asked) return all;
		return all.filter(
			(op) =>
				op.id.toLowerCase().includes(asked) ||
				op.path.toLowerCase().includes(asked) ||
				op.summary.toLowerCase().includes(asked)
		);
	});

	function pick(op: Op) {
		chosen = op;
		answer = null;
		failed = '';
		values = {};
		body = '{\n  \n}';
	}

	/** The address as it stands, so a reader can see what they are about to send. */
	const url = $derived.by(() => {
		if (!chosen) return '';
		let path = chosen.path;
		for (const p of chosen.params.filter((x) => x.where === 'path')) {
			path = path.replace(`{${p.name}}`, encodeURIComponent(values[p.name] ?? `{${p.name}}`));
		}
		const query = chosen.params
			.filter((p) => p.where === 'query' && (values[p.name] ?? '') !== '')
			.map((p) => `${p.name}=${encodeURIComponent(values[p.name]!)}`)
			.join('&');
		return `https://api.acyka.cc${path}${query ? `?${query}` : ''}`;
	});

	const ready = $derived.by(() => {
		if (!chosen) return false;
		return chosen.params
			.filter((p) => p.required)
			.every((p) => (values[p.name] ?? '').trim() !== '');
	});

	async function run() {
		if (!chosen || running) return;
		running = true;
		failed = '';
		answer = null;

		let path = chosen.path;
		for (const p of chosen.params.filter((x) => x.where === 'path')) {
			path = path.replace(`{${p.name}}`, values[p.name] ?? '');
		}
		const query: Record<string, string> = {};
		for (const p of chosen.params.filter((x) => x.where === 'query')) {
			const value = values[p.name] ?? '';
			if (value !== '') query[p.name] = value;
		}

		try {
			answer = await send(
				chosen.method,
				path,
				query,
				chosen.body ? body : undefined
			);
		} catch (err) {
			// A cross-site request the browser refused never reaches a status, and
			// the message it gives is deliberately vague — so this says where to
			// look rather than repeating it.
			failed =
				err instanceof TypeError
					? 'the browser would not send that — the console has the reason, and it is usually CORS or a blocked network'
					: err instanceof Error
						? err.message
						: 'something went wrong';
		} finally {
			running = false;
		}
	}

	const shown = $derived(answer ? JSON.stringify(answer.body, null, 2) : '');
</script>

<svelte:head>
	<title>Playground — acyka api</title>
	<meta
		name="description"
		content="Call the acyka API from your browser, signed in as yourself. Every request is the same cross-site call your own application will make."
	/>
</svelte:head>

<div class="ground">
	<header class="prose">
		<h1>Playground</h1>
		<p class="lede">
			The live api, from this browser, with your own token. Every call here is the same cross-site
			request your own single-page application will make — there is no proxy in between.
		</p>
	</header>

	<section class="who">
		{#if signed.in}
			<p class="in">
				<Badge>signed in</Badge>
				<span>granted <code>{signed.scopes.join(' ')}</code></span>
			</p>
			<Button size="sm" variant="ghost" onclick={() => signed.out()}>Sign out</Button>
		{:else}
			<p class="out">
				<span>
					Reads of the catalogue need a token too, so sign in to try anything. You will be asked
					for <code>{ASKING.join(' ')}</code>, and it lasts an hour.
				</span>
			</p>
			<Button size="sm" onclick={() => signed.start(page.url.pathname + page.url.search)}>
				Sign in with acyka
			</Button>
		{/if}
	</section>

	<div class="split">
		<aside class="list">
			<Search bind:value={filter} placeholder="filter" label="filter the operations">
				{#snippet icon()}<IconSearch size={16} stroke={1.7} />{/snippet}
			</Search>

			<ul>
				{#each showing as op (op.id)}
					<li>
						<button
							type="button"
							class:on={chosen?.id === op.id}
							onclick={() => pick(op)}
						>
							<span class="verb" data-verb={op.method}>{op.method}</span>
							<code>{op.path.replace('/api/v1', '')}</code>
						</button>
					</li>
				{/each}
			</ul>
		</aside>

		<div class="work">
			{#if !chosen}
				<p class="pick">Pick something on the left.</p>
			{:else}
				<h2>
					<span class="verb" data-verb={chosen.method}>{chosen.method}</span>
					<code>{chosen.path}</code>
				</h2>
				{#if chosen.summary}<p class="says">{chosen.summary}</p>{/if}

				<p class="meta">
					<a href="/reference/{chosen.slug}">the reference for this one</a>
					{#if chosen.scope}
						· needs <code>{chosen.scope}</code>
						{#if signed.in && !signed.carries(chosen.scope)}
							<span class="warn">
								<IconAlertTriangle size={14} stroke={1.8} /> not granted — this will answer 403
							</span>
						{/if}
					{/if}
				</p>

				{#if chosen.writes}
					<p class="real">
						<IconAlertTriangle size={16} stroke={1.8} />
						<span>
							This one writes, and it writes for real — there is no sandbox behind this api. It
							will change your own account.
						</span>
					</p>
				{/if}

				{#if chosen.params.length}
					<div class="params">
						{#each chosen.params as param (param.name)}
							<label>
								<span class="name">
									<code>{param.name}</code>
									{#if param.required}<em>required</em>{/if}
									<small>{param.where === 'path' ? 'in the address' : 'narrows it'}</small>
								</span>
								<Input
									bind:value={values[param.name]}
									placeholder={param.kind === 'string' ? 'text' : 'a number'}
									hint={param.doc}
								/>
							</label>
						{/each}
					</div>
				{/if}

				{#if chosen.body}
					<label class="body">
						<span class="name">
							<code>{chosen.body}</code>
							<small>the request body, as JSON</small>
						</span>
						<TextArea bind:value={body} rows={6} />
					</label>
				{/if}

				<div class="going">
					<code class="url">{url}</code>
					<!-- The kit's `icon` prop is a boolean — "this button is only an
					     icon" — so the icon goes in the content beside the word. -->
					<Button disabled={!ready || running || !signed.in} loading={running} onclick={run}>
						<span class="go"><IconPlayerPlay size={15} stroke={1.9} /> Send</span>
					</Button>
				</div>

				{#if !signed.in}
					<p class="hint">Sign in first — every route on this api needs a token.</p>
				{:else if !ready}
					<p class="hint">Fill in what is required.</p>
				{/if}

				{#if failed}
					<p class="failed">{failed}</p>
				{/if}

				{#if answer}
					<div class="answer">
						<p class="line">
							<Badge>{answer.status}</Badge>
							<span>{answer.took} ms</span>
							{#if answer.pace.remaining}
								<span class="pace">
									{answer.pace.remaining} of {answer.pace.limit} left · resets in
									{answer.pace.reset}s
								</span>
							{/if}
						</p>
						<Code code={shown} />
					</div>
				{/if}
			{/if}
		</div>
	</div>
</div>

<style>
	.ground {
		max-width: 72rem;
		display: flex;
		flex-direction: column;
		gap: var(--s-4);
	}

	.lede {
		color: var(--text-2);
		font-size: var(--fs-sub);
	}

	.who {
		display: flex;
		align-items: center;
		justify-content: space-between;
		flex-wrap: wrap;
		gap: var(--s-3);
		padding: var(--s-3);
		border: 1px solid var(--border);
		border-radius: var(--r-md);
		background: var(--surface);
	}
	.who p {
		margin: 0;
		display: flex;
		align-items: center;
		gap: var(--s-2);
		flex-wrap: wrap;
		font-size: var(--fs-sub);
		color: var(--text-caption);
	}

	.split {
		display: grid;
		grid-template-columns: 1fr;
		gap: var(--s-4);
		align-items: start;
	}

	.list {
		display: flex;
		flex-direction: column;
		gap: var(--s-2);
		min-width: 0;
	}

	.list ul {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 1px;
		max-height: 22rem;
		overflow-y: auto;
	}

	.list button {
		display: flex;
		align-items: baseline;
		gap: var(--s-2);
		width: 100%;
		padding: 5px var(--s-2);
		border: 0;
		border-radius: var(--r-control);
		background: transparent;
		color: var(--text-2);
		font: inherit;
		font-size: var(--fs-sub);
		text-align: left;
		cursor: pointer;
	}
	.list button:hover {
		background: var(--surface-2);
		color: var(--text);
	}
	.list button.on {
		background: var(--accent-faint);
		color: var(--text-title);
		font-weight: 600;
	}
	.list code {
		font-family: var(--font-mono);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.verb {
		flex: none;
		padding: 1px 6px;
		border-radius: var(--r-sm);
		background: var(--surface-3);
		color: var(--text-2);
		font-family: var(--font-mono);
		font-size: 10px;
		font-weight: 700;
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

	.work {
		display: flex;
		flex-direction: column;
		gap: var(--s-3);
		min-width: 0;
		padding: var(--s-4);
		border: 1px solid var(--border);
		border-radius: var(--r-md);
		background: var(--surface);
	}

	.work h2 {
		display: flex;
		align-items: center;
		gap: var(--s-2);
		margin: 0;
		font-size: var(--fs-h3);
	}
	.work h2 code {
		font-family: var(--font-mono);
		font-size: 0.8em;
		color: var(--text-title);
	}

	.says,
	.meta,
	.hint,
	.pick {
		margin: 0;
		font-size: var(--fs-sub);
		color: var(--text-muted);
	}

	.meta {
		display: flex;
		align-items: center;
		gap: var(--s-2);
		flex-wrap: wrap;
	}

	.warn {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		color: var(--gold);
	}

	.real {
		display: flex;
		align-items: flex-start;
		gap: var(--s-2);
		margin: 0;
		padding: var(--s-2) var(--s-3);
		border: 1px solid color-mix(in oklab, var(--gold) 35%, var(--border));
		border-radius: var(--r-control);
		background: color-mix(in oklab, var(--gold) 8%, transparent);
		color: var(--text-caption);
		font-size: var(--fs-sub);
	}

	.params {
		display: grid;
		gap: var(--s-3);
	}

	label {
		display: flex;
		flex-direction: column;
		gap: var(--s-1);
	}

	.name {
		display: flex;
		align-items: baseline;
		gap: var(--s-2);
		flex-wrap: wrap;
		font-size: var(--fs-sub);
	}
	.name code {
		font-family: var(--font-mono);
		color: var(--text-title);
		font-weight: 600;
	}
	.name em {
		font-style: normal;
		font-size: var(--fs-tiny);
		color: var(--accent-hover);
	}
	.name small {
		color: var(--text-muted);
		font-size: var(--fs-tiny);
	}

	.going {
		display: flex;
		align-items: center;
		gap: var(--s-3);
		flex-wrap: wrap;
		padding-top: var(--s-2);
		border-top: 1px solid var(--border);
	}

	.url {
		flex: 1;
		min-width: 0;
		font-family: var(--font-mono);
		font-size: var(--fs-tiny);
		color: var(--text-muted);
		overflow-x: auto;
		white-space: nowrap;
	}

	.go {
		display: inline-flex;
		align-items: center;
		gap: 6px;
	}

	.failed {
		margin: 0;
		color: var(--red);
		font-size: var(--fs-sub);
	}

	.answer {
		display: flex;
		flex-direction: column;
		gap: var(--s-2);
		min-width: 0;
	}

	.line {
		display: flex;
		align-items: center;
		gap: var(--s-2);
		flex-wrap: wrap;
		margin: 0;
		font-size: var(--fs-sub);
		color: var(--text-muted);
	}

	.pace {
		font-family: var(--font-mono);
		font-size: var(--fs-tiny);
	}

	@media (min-width: 900px) {
		.split {
			grid-template-columns: 20rem minmax(0, 1fr);
		}
		.list ul {
			max-height: calc(100dvh - 20rem);
		}
	}
</style>
