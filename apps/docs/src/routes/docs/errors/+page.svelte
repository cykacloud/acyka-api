<script lang="ts">
	import Code from '$lib/Code.svelte';
	import Guide from '$lib/Guide.svelte';

	let { data } = $props();

	/** The refusals a caller can actually act on, and what to do about each. */
	const REFUSALS: { status: number; name: string; means: string }[] = [
		{ status: 400, name: 'errors.badData', means: 'the request was refused before anything looked at it — a status that is not one of the six, a title that is empty' },
		{ status: 400, name: 'post.tooLong', means: 'a post past the one length the site allows' },
		{ status: 400, name: 'post.badMarkup', means: 'a wall of punctuation with no words in it' },
		{ status: 401, name: 'errors.unauthorized', means: 'no token, an expired one, or one whose application was switched off. Refresh, then retry once.' },
		{ status: 403, name: 'errors.oauthInsufficientScope', means: 'the token is good and does not carry this. Refreshing will not help; ask for the scope. `scope` names it.' },
		{ status: 403, name: 'errors.oauthUserRequired', means: 'an application acting for itself asked for something about a person' },
		{ status: 403, name: 'errors.suspended', means: 'the account the token acts for is suspended' },
		{ status: 403, name: 'errors.noAccess', means: 'a shelf that is readable and not writable by this person' },
		{ status: 404, name: 'errors.notFound', means: 'there is nothing there, or it is not yours to read' },
		{ status: 404, name: 'errors.unknownTitle', means: 'no such title — or one marked 18+ and an account that has not opened the switch' },
		{ status: 404, name: 'errors.profileNotFound', means: 'no account answers to that name' },
		{ status: 429, name: 'common.tooOften', means: 'the minute is spent. `Retry-After` says how long.' }
	];
</script>

<Guide
	title="Errors"
	lede="A phrase name and never a sentence — and why that is what makes a real error type possible."
>
	<p>Every refusal on this api is the same shape:</p>

	<Code code={data.blocks.shape.code} html={data.blocks.shape.html} />

	<p>
		<code>message</code> is a <strong>phrase name</strong>. Not a sentence, and not English — one
		acyka screen can be read in five languages at once, and the server does not get to choose which.
		Extra fields are merged in beside it wherever a refusal owes a reason: the scope that was
		missing, how long a ban has left.
	</p>

	<p>
		That is usually described as a limitation. For a client library it is the opposite: a stable,
		enumerable set of names is what makes a real type per refusal possible, instead of matching on
		prose that changes the day somebody rewrites a sentence.
	</p>

	<Code code={data.blocks.typed.code} html={data.blocks.typed.html} />

	<h2 id="the-distinction">
		401 and 403 are not the same problem
		<a class="anchor" href="#the-distinction" aria-label="a link to this section">#</a>
	</h2>

	<p>
		A <strong>401</strong> means the credential is stale — refresh and try again, which every
		library does once by itself. A <strong>403</strong> means the token is good and does not carry
		what this endpoint wants: refreshing produces the same token with the same scopes and earns the
		same refusal, for ever. A client that retries a 403 is a client in a loop.
	</p>

	<h2 id="the-names">
		The names
		<a class="anchor" href="#the-names" aria-label="a link to this section">#</a>
	</h2>

	<table>
		<thead>
			<tr>
				<th>status</th>
				<th>name</th>
				<th>what it means</th>
			</tr>
		</thead>
		<tbody>
			{#each REFUSALS as one (one.status + one.name)}
				<tr>
					<td><code>{one.status}</code></td>
					<td><code>{one.name}</code></td>
					<td>{one.means}</td>
				</tr>
			{/each}
		</tbody>
	</table>

	<p>
		The list grows. A name your build has never seen is not an error in itself — read
		<code>err.code</code>, show your own words for the ones you know, and the name itself for the
		ones you do not.
	</p>

	<Code code={data.blocks.own.code} html={data.blocks.own.html} />

	<h2 id="not-json">
		An answer that is not JSON
		<a class="anchor" href="#not-json" aria-label="a link to this section">#</a>
	</h2>

	<p>
		A proxy's own 502 is HTML. Every library here turns that into the same
		<code>ServerError</code> a JSON 502 would have produced, because a parse error at that moment
		tells a caller nothing about what happened — and being told “the api is having a bad minute” is
		what they need.
	</p>
</Guide>
