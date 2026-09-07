<script lang="ts">
	import Code from '$lib/Code.svelte';
	import Guide from '$lib/Guide.svelte';

	let { data } = $props();

	const EVENTS: { key: string; needs: string; about: string; says: string }[] = [
		{
			key: 'episode.aired',
			needs: 'catalog:read',
			about: 'the catalogue',
			says: 'a dub gained an episode. The one event with nobody in it, so every subscriber hears it and no grant is checked.'
		},
		{ key: 'list.saved', needs: 'lists:read', about: 'a person', says: 'a row was written — added, or stepped on' },
		{ key: 'list.removed', needs: 'lists:read', about: 'a person', says: 'a title left their list' },
		{ key: 'list.rated', needs: 'lists:read', about: 'a person', says: 'what they thought of it changed, or was taken back' },
		{ key: 'post.created', needs: 'social:read', about: 'a person', says: 'they wrote something' },
		{ key: 'follow.added', needs: 'social:read', about: 'a person', says: 'they started reading somebody' },
		{ key: 'follow.removed', needs: 'social:read', about: 'a person', says: 'they stopped' }
	];
</script>

<Guide
	title="Webhooks"
	lede="Being told, instead of asking — and the three lines of verification everybody gets wrong."
>
	<p>
		Polling is most of what a rate limit is spent on, and almost all of it is spent learning that
		nothing has happened. Register an endpoint on your application's page at
		<a href="https://acyka.cc/settings/applications">settings/applications</a>, pick what it should
		hear about, and copy the signing secret — it is shown once.
	</p>

	<h2 id="who-hears-what">
		Who hears what
		<a class="anchor" href="#who-hears-what" aria-label="a link to this section">#</a>
	</h2>

	<p>
		An event about a person reaches your endpoint only if <strong>that person authorised your
		application</strong> and it holds the scope that would let it read the same thing. The check
		happens when the event is sent rather than when you subscribed, because an authorization can be
		taken back and a subscription cannot know.
	</p>

	<p>
		So: a webhook is not a second way in. If <code>GET /v1/lists</code> would refuse you for
		somebody, so does the bell.
	</p>

	<table>
		<thead>
			<tr><th>event</th><th>needs</th><th>what it is</th></tr>
		</thead>
		<tbody>
			{#each EVENTS as event (event.key)}
				<tr>
					<td><code>{event.key}</code></td>
					<td><code>{event.needs}</code></td>
					<td>{event.says}</td>
				</tr>
			{/each}
		</tbody>
	</table>

	<h2 id="what-arrives">
		What arrives
		<a class="anchor" href="#what-arrives" aria-label="a link to this section">#</a>
	</h2>

	<Code code={data.blocks.delivery.code} html={data.blocks.delivery.html} />
	<Code code={data.blocks.payload.code} html={data.blocks.payload.html} label="the body of a list event" />

	<p>
		<code>user_id</code> is a string, and it is the id rather than the nickname — a name can move,
		and an application that stored one has a key that stops resolving. It is the same string
		<a href="/reference/get-me"><code>/v1/me</code></a> answers with.
	</p>

	<h2 id="verify">
		Verifying it
		<a class="anchor" href="#verify" aria-label="a link to this section">#</a>
	</h2>

	<p>
		The signature is <code>t=&lt;unix seconds&gt;,v1=&lt;hex hmac-sha256&gt;</code> over
		<code>&lt;t&gt;.&lt;raw body&gt;</code>, with your endpoint's secret as the key. Every library
		here ships the check, and it is worth saying what the three hard parts are — because they are
		the three everybody who writes it themselves gets wrong once.
	</p>

	<ul>
		<li>
			<strong>The raw bytes, not a parsed body.</strong> The signature covers what was sent.
			Parsing and re-serialising gives a different string the moment key order or number
			formatting differs, and the check then fails for good reasons that look like bad ones.
		</li>
		<li>
			<strong>A constant-time compare.</strong> <code>===</code> on strings returns as soon as two
			characters differ, and how long that took is a measurement of how much of the signature was
			right — a hundred requests per byte, and a forgeable signature at the end of it.
		</li>
		<li>
			<strong>Check how old it is.</strong> The timestamp is inside the signed string precisely so
			you can: signing the body alone would give a signature that stays valid for ever, and a
			captured delivery could be replayed next month.
		</li>
	</ul>

	<Code code={data.blocks.verify.code} html={data.blocks.verify.html} />

	<h2 id="retries">
		Retries, and when we stop
		<a class="anchor" href="#retries" aria-label="a link to this section">#</a>
	</h2>

	<p>
		Answer any 2xx and it is done. Anything else — or nothing at all — is retried: eight attempts
		over about a day, ten seconds apart at first and twelve hours apart at the end. Deliveries are
		rows rather than tasks in memory, so an application that was down for ten minutes finds out
		what it missed, including across a deploy on our side.
	</p>

	<p>
		Twenty dead deliveries in a week with nothing landing switches the endpoint off, and the page
		says so. Going on knocking at a URL that has moved is a thing we would be doing to somebody
		else's server rather than for them.
	</p>

	<h2 id="the-address">
		The address has to be public https
		<a class="anchor" href="#the-address" aria-label="a link to this section">#</a>
	</h2>

	<p>
		A hostname on the public internet, over TLS. <code>localhost</code>, a private range and a
		link-local address are all refused — without that rule, a webhook URL is a way to make this
		server call itself or its host's metadata service and hand you the answer.
	</p>

	<p>
		For local work, a tunnel: the endpoint has to be reachable from outside for the same reason your
		own will be.
	</p>
</Guide>
