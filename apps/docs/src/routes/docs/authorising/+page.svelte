<script lang="ts">
	import Code from '$lib/Code.svelte';
	import Guide from '$lib/Guide.svelte';

	let { data } = $props();
</script>

<Guide
	title="Authorising"
	lede="Four ways to hold a token, and which one your application wants."
>
	<p>
		acyka is an OpenID provider, so none of this is bespoke: a library that already speaks OAuth
		2.1 will work against it, and
		<a href="https://acyka.cc/.well-known/openid-configuration">the discovery document</a> says
		everything a client needs to configure itself.
	</p>

	<Code code={data.blocks.discovery.code} html={data.blocks.discovery.html} />

	<p>Three decisions are worth knowing before you pick a flow.</p>

	<ul>
		<li>
			<strong>PKCE is required of every client</strong>, confidential ones included, and only
			<code>S256</code>. A code that leaks from a log, a referer or a browser's history is then
			worth nothing without the verifier.
		</li>
		<li>
			<strong>Access tokens are opaque rows, not JWTs.</strong> That is what makes “revoke” mean
			something: a person taking an application back at
			<a href="https://acyka.cc/settings/security">settings/security</a> stops it immediately, rather
			than in an hour.
		</li>
		<li>
			<strong>Refresh tokens rotate, and reuse kills the family.</strong> The one handed back is the
			one to keep. Presenting a retired one means two parties hold the chain, and the only safe
			reading is that one of them stole it — so the whole chain dies.
		</li>
	</ul>

	<h2 id="app-only">
		An application acting for itself
		<a class="anchor" href="#app-only" aria-label="a link to this section">#</a>
	</h2>

	<p>
		<code>client_credentials</code>. A bot looking up a title has nobody to sign in and nobody to
		show a consent screen to. Confidential clients only: a public client's only proof is PKCE, and
		PKCE has nothing to bind to when there is no code and no user.
	</p>

	<Code code={data.blocks.app.code} html={data.blocks.app.html} />

	<p>
		It can carry <code>catalog:read</code> and <code>people:read</code> and nothing else. Asking for
		<code>lists:read</code> here is refused at the door rather than minted and then refused by every
		route that reads it — a token that opens nothing is worse than a refusal, because it fails later
		and somewhere else.
	</p>

	<h2 id="a-person">
		Acting for a person
		<a class="anchor" href="#a-person" aria-label="a link to this section">#</a>
	</h2>

	<p>The authorization code flow, in three steps.</p>

	<Code code={data.blocks.start.code} html={data.blocks.start.html} label="1 — send them" />
	<Code code={data.blocks.finish.code} html={data.blocks.finish.html} label="2 and 3 — come back" />

	<p>
		<strong>Store what <code>keep</code> hands you.</strong> Concurrent requests that all notice the
		same expiry send one refresh between them — that is why this is a class rather than a helper —
		but a caller who stores the original set for ever has a credential that stops working, and
		presenting it again is what the server reads as theft.
	</p>

	<p>
		Ask for <code>offline_access</code> if you need to act while nobody is watching. Without it
		there is no refresh token at all, which is the consent screen's decision rather than something a
		client can work around.
	</p>

	<h2 id="no-browser">
		Something with no browser
		<a class="anchor" href="#no-browser" aria-label="a link to this section">#</a>
	</h2>

	<p>
		A television, a terminal, a set-top box. The device flow, RFC 8628. What these clients did
		before it existed is draw a login form of their own — and a password typed into whatever is
		running on a television is a password given to whatever is running on a television.
	</p>

	<Code code={data.blocks.device.code} html={data.blocks.device.html} />

	<p>
		The code shown is eight characters from an alphabet with no <code>0</code>, <code>O</code>,
		<code>1</code>, <code>I</code>
		or <code>L</code> in it, because somebody squinting at a screen across a room will confuse
		those. The dash and the case do not matter: <code>abcd-2345</code> and <code>ABCD2345</code> are
		the same code.
	</p>

	<h2 id="a-token-you-have">
		A token you already have
		<a class="anchor" href="#a-token-you-have" aria-label="a link to this section">#</a>
	</h2>

	<p>
		<code>Acyka.token(accessToken)</code>. No refresh: when it runs out the next call raises
		<code>Unauthorized</code>, rather than a credential being swapped underneath a caller who did
		not ask for that.
	</p>
</Guide>
