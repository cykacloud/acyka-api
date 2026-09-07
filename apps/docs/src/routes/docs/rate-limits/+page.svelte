<script lang="ts">
	import Code from '$lib/Code.svelte';
	import Guide from '$lib/Guide.svelte';

	let { data } = $props();
</script>

<Guide
	title="Rate limits"
	lede="Sixty a minute, six hundred once somebody has vouched for you, and three headers so you never have to guess."
>
	<h2 id="what-you-get">
		What you get
		<a class="anchor" href="#what-you-get" aria-label="a link to this section">#</a>
	</h2>

	<table>
		<thead>
			<tr><th></th><th>per minute</th></tr>
		</thead>
		<tbody>
			<tr><td>an ordinary application</td><td><code>60</code></td></tr>
			<tr><td>one a moderator has marked verified</td><td><code>600</code></td></tr>
		</tbody>
	</table>

	<p>
		Sixty is a number you can build against without asking: a page of the catalogue, a title and
		its cast is three calls, so a minute of ordinary use is nowhere near it. What it stops is a loop
		with no sleep in it.
	</p>

	<p>
		The window is <strong>the application and the person</strong>, not the token. A token is
		something a client can mint another of, so keying on one would make “refresh twice a minute”
		the way round the limit. An application acting for itself has no person, so the whole
		application is one window — which is right, because there is one of it.
	</p>

	<h2 id="the-headers">
		Three headers, on every answer
		<a class="anchor" href="#the-headers" aria-label="a link to this section">#</a>
	</h2>

	<Code code={data.blocks.headers.code} html={data.blocks.headers.html} />

	<p>
		<code>X-RateLimit-Reset</code> is seconds until the window turns, not a timestamp — a clock
		that disagrees with ours is then not your problem.
	</p>

	<p>
		A browser client can read all three: they are on <code>Access-Control-Expose-Headers</code>,
		without which a cross-site page would be able to see the numbers on the wire and not in
		JavaScript.
	</p>

	<h2 id="the-refusal">
		And on the refusal
		<a class="anchor" href="#the-refusal" aria-label="a link to this section">#</a>
	</h2>

	<Code code={data.blocks.refused.code} html={data.blocks.refused.html} />

	<p>
		<strong>Including the 429</strong>, which is the half that is easy to forget and the half that
		matters. A client told only “too many” has nothing to wait for and tries again immediately —
		which is how a limit turns one impatient caller into a loop against the door.
	</p>

	<p>
		<code>Retry-After</code> is the same number the limiter is holding, so waiting exactly that long
		is neither too little (and refused again) nor too much (and asleep for nothing).
	</p>

	<h2 id="what-the-libraries-do">
		What the libraries do about it
		<a class="anchor" href="#what-the-libraries-do" aria-label="a link to this section">#</a>
	</h2>

	<p>
		Read the header and wait exactly that long, then try again — up to three times by default. A
		429, a 5xx and a socket that never answered are retried; a request refused on its merits is not.
	</p>

	<Code code={data.blocks.watching.code} html={data.blocks.watching.html} />

	<p>
		<code>maxWait</code> exists for a reason worth stating: sleeping a whole window inside one
		<code>await</code> looks exactly like a hang to whoever is waiting on it. Past that ceiling the
		<code>RateLimited</code> is raised and the decision is yours.
	</p>

	<h2 id="the-other-ceiling">
		There is a second ceiling, and it is not about you
		<a class="anchor" href="#the-other-ceiling" aria-label="a link to this section">#</a>
	</h2>

	<p>
		The edge refuses about twenty requests a second from one address, whoever is asking. It is set
		where no person will ever reach it, because it keys on an address — a carrier's NAT is one
		bucket for a city — and what it is for is the case where being right about <em>who</em> is
		beside the point: a flood arriving faster than the api can refuse it, where every refusal has
		already cost a connection and a database handle.
	</p>

	<h2 id="asking-for-more">
		Asking for more
		<a class="anchor" href="#asking-for-more" aria-label="a link to this section">#</a>
	</h2>

	<p>
		The verified mark on an application is what lifts it to six hundred, and it means “this app is
		who it says it is” rather than “this app is important”. It is asked for the way everything else
		on this api is: through the account that owns the application.
	</p>
</Guide>
