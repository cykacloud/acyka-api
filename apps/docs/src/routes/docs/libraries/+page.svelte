<script lang="ts">
	import Code from '$lib/Code.svelte';
	import Guide from '$lib/Guide.svelte';

	let { data } = $props();

	const LIBRARIES: { label: string; name: string; needs: string; note: string }[] = [
		{
			label: 'TypeScript',
			name: '@acyka/api',
			needs: 'Node 20+, Bun, Deno, Workers, browsers',
			note: 'No dependencies at all — `fetch` and `crypto.subtle` are everywhere it runs.'
		},
		{
			label: 'Python',
			name: 'acyka',
			needs: '3.11+',
			note: 'Frozen dataclasses with generated parsers, and a synchronous *and* an awaited client. One dependency, httpx.'
		},
		{
			label: 'Rust',
			name: 'acyka',
			needs: '1.75+, tokio',
			note: 'Every read is a builder, and a paginator is a `Stream` that is already `Unpin`. rustls by default.'
		},
		{
			label: 'Kotlin',
			name: 'cc.acyka:acyka',
			needs: 'JVM 17, coroutines',
			note: 'Suspending reads and a `Flow` for pages. Usable from Java too.'
		},
		{
			label: 'C#',
			name: 'Acyka',
			needs: 'net8.0, net10.0',
			note: 'Records, and `IAsyncEnumerable` for pages.'
		},
		{
			label: 'C++',
			name: 'acyka',
			needs: 'C++20, header-only',
			note: 'One include. libcurl behind a seam, so a project that has already chosen an HTTP client can pass its own.'
		}
	];
</script>

<Guide
	title="The libraries"
	lede="Six of them, and they are the same library six times rather than six libraries."
>
	<Code code={data.blocks.install.code} html={data.blocks.install.html} />

	<table>
		<thead>
			<tr><th>language</th><th>package</th><th>runs on</th></tr>
		</thead>
		<tbody>
			{#each LIBRARIES as one (one.label)}
				<tr>
					<td>{one.label}</td>
					<td><code>{one.name}</code></td>
					<td>{one.needs}</td>
				</tr>
			{/each}
		</tbody>
	</table>

	<h2 id="generated">
		What is generated
		<a class="anchor" href="#generated" aria-label="a link to this section">#</a>
	</h2>

	<p>
		The types and one method per operation — {data.counts.operations} of them and
		{data.counts.models} shapes, in every language. They come out of
		<code>openapi.json</code>, which the api writes from annotations that sit on its own handlers,
		and a test there drives every path in that document against the real router.
	</p>

	<p>
		So none of the six can be behind the others, and none of them can describe an endpoint that
		does not exist. There is <strong>one reader</strong> shared by all six emitters, because six
		emitters each reading the document would be six places that have to agree about what
		<code>allOf</code> means — and they would not: the first language written would be right and the
		sixth would have a subtly different idea of which fields are optional.
	</p>

	<h2 id="by-hand">
		What is written by hand, in each of them
		<a class="anchor" href="#by-hand" aria-label="a link to this section">#</a>
	</h2>

	<p>This is the half that decides whether a client is pleasant rather than merely correct.</p>

	<ul>
		<li>
			<strong>The four OAuth flows.</strong> Authorization code with PKCE, the refresh that
			rotates, <code>client_credentials</code>, and the device flow.
		</li>
		<li>
			<strong>A token that renews itself</strong>, with the refresh serialised through one lock.
			Four requests noticing one expiry must send one refresh between them: the tokens rotate, so
			the second would present one the first has retired — and the server can only read that as
			theft.
		</li>
		<li>
			<strong>Backing off on the numbers the server actually sent</strong>, rather than guessing.
		</li>
		<li><strong>Paginators</strong> that stop on a short page rather than on <code>total</code>.</li>
		<li><strong>One error type per phrase name.</strong></li>
		<li><strong>Verifying a webhook</strong>, over the raw bytes, in constant time, with the age checked.</li>
	</ul>

	<h2 id="per-language">
		And the parts that are about the language
		<a class="anchor" href="#per-language" aria-label="a link to this section">#</a>
	</h2>

	<ul>
		{#each LIBRARIES as one (one.label)}
			<li><strong>{one.label}.</strong> {one.note}</li>
		{/each}
	</ul>

	<h2 id="snake-case">
		The wire stays snake_case
		<a class="anchor" href="#snake-case" aria-label="a link to this section">#</a>
	</h2>

	<p>
		Four of the six leave the field names exactly as they arrive, because
		<code>shikimori_id</code> is already their own convention. Kotlin and C# rename them —
		<code>shikimoriId</code>, <code>ShikimoriId</code> — and in those two the mapping is written on
		every single field rather than only where the two disagree: the day a field arrives already
		camelCase it would silently have no annotation, and nobody would notice until it did disagree.
	</p>

	<p>
		The <a href="/reference">reference</a> shows both, and switches with the language tab.
	</p>

	<h2 id="something-missing">
		If something is missing
		<a class="anchor" href="#something-missing" aria-label="a link to this section">#</a>
	</h2>

	<p>
		Every library exposes its transport, so a route that exists and has not been generated yet is
		still reachable — and an issue at
		<a href="https://github.com/cykacloud/acyka-api">cykacloud/acyka-api</a> is the way to say so.
	</p>
</Guide>
