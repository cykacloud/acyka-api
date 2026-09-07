<script lang="ts">
	import Code from '$lib/Code.svelte';
	import Guide from '$lib/Guide.svelte';

	let { data } = $props();
</script>

<Guide
	title="Start here"
	lede="What this api is, what it is not, and a call that works in about two minutes."
>
	<p>
		<code>https://api.acyka.cc/api/v1</code> answers {data.counts.operations} operations over the
		anime catalogue, public profiles, and the lists, shelves and writing of whoever authorised your
		application. Every one of them is the same function acyka's own site calls — the cast ordering,
		the search that folds <code>ё</code> onto <code>е</code>, the filter that keeps a sequel out of
		“similar”. There is no second implementation to disagree with the first.
	</p>

	<h2 id="the-shape-of-it">
		The shape of it
		<a class="anchor" href="#the-shape-of-it" aria-label="a link to this section">#</a>
	</h2>

	<ul>
		<li>
			<strong>Everything needs a bearer token.</strong> No route here reads a cookie, which is why
			none of them needs a CSRF rule and why a page in a browser can call them cross-site.
		</li>
		<li>
			<strong>snake_case.</strong> <code>shikimori_id</code>, <code>title_orig</code>,
			<code>email_verified</code> — the same words in the reference, in a <code>curl</code> answer,
			and in five of the six libraries.
		</li>
		<li>
			<strong>A collection answers <code>{'{ "items": [...] }'}</code></strong>, with
			<code>total</code> beside it wherever the caller pages by offset. A single resource answers as
			itself, at the top level.
		</li>
		<li>
			<strong>Absent is not zero.</strong> A missing follower count means “not yours to know”; a
			<code>0</code> means “nobody”. Nothing here collapses the two, and neither should your code.
		</li>
	</ul>

	<h2 id="not-here">
		What is deliberately not here
		<a class="anchor" href="#not-here" aria-label="a link to this section">#</a>
	</h2>

	<p>
		<strong>Video.</strong> The site's player is fed addresses at Kodik, AnimeLib and AniLibria —
		somebody else's files under somebody else's terms. Serving them to acyka's own player is one
		argument; handing them to your application as a documented, versioned promise is a different one
		that nobody has made.
	</p>

	<p>
		<strong>Rooms.</strong> A room is one process's memory with a stream hanging off it. The
		contract you would be holding is “this stays open”, and a deploy is a restart.
	</p>

	<h2 id="register">
		Register an application
		<a class="anchor" href="#register" aria-label="a link to this section">#</a>
	</h2>

	<p>
		At <a href="https://acyka.cc/settings/applications">acyka.cc/settings/applications</a>. Keep it
		<strong>confidential</strong> if it runs on a server you control, and allow it
		<code>catalog:read</code>. You get a client id and a secret; the secret is shown once, because
		what is stored is an argon2 hash and nothing can produce it again.
	</p>

	<h2 id="install">
		Install a library
		<a class="anchor" href="#install" aria-label="a link to this section">#</a>
	</h2>

	<Code code={data.blocks.install.code} html={data.blocks.install.html} />

	<p>
		Six of them — TypeScript, Python, Rust, Kotlin, C# and C++ — and they are the same library six
		times rather than six libraries: the types and the methods are generated from one contract, so
		none of them can be behind the others. <a href="/docs/libraries">The libraries</a> says what is
		hand-written in each and why.
	</p>

	<h2 id="first-call">
		The first call
		<a class="anchor" href="#first-call" aria-label="a link to this section">#</a>
	</h2>

	<Code code={data.blocks.first.code} html={data.blocks.first.html} label="index.ts" />

	<p>
		Only <code>catalog:read</code> and <code>people:read</code> can be held this way. Everything
		else on this api is about a person, and an application speaking for itself has nobody to act for
		— see <a href="/docs/authorising">Authorising</a> for the flow that does.
	</p>

	<Code code={data.blocks.curl.code} html={data.blocks.curl.html} label="or without a library" />

	<h2 id="then">
		Then
		<a class="anchor" href="#then" aria-label="a link to this section">#</a>
	</h2>

	<ul>
		<li><a href="/reference">The reference</a> — every operation, in seven languages.</li>
		<li><a href="/playground">The playground</a> — the same calls, signed in as you, in a browser.</li>
		<li><a href="/docs/rate-limits">Rate limits</a> — what you get, and how to be told what is left.</li>
	</ul>
</Guide>
