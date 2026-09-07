<script lang="ts">
	import { slug } from '$lib/slug';
	import Guide from '$lib/Guide.svelte';

	let { data } = $props();

	/** What a word is for, in a sentence rather than a phrase name. */
	const SAYS: Record<string, string> = {
		openid: 'Makes this an identity request rather than a plain OAuth one. Without it no id token is minted.',
		offline_access:
			'A refresh token, so the application can act while nobody is watching. Without it there is none.',
		profile: 'The nickname, the picture, the banner, the line under the name, and the day the account was made.',
		email: 'The address on the account, and whether it is confirmed.',
		'catalog:read': 'Looking things up, and nothing about anybody.',
		'people:read':
			'Everybody else, as far as they have agreed to be read — public profiles, their lists and shelves, who follows whom.',
		'lists:read': 'What this person is watching, planning, and has finished, and the shelves they named.',
		'lists:write': 'Adding titles, stepping episodes, rating, and making shelves — in their name.',
		'social:read': "This person's own posts and who they read. Not everybody's.",
		'social:write': 'Writing posts and following people, in their name.'
	};

	const SENSITIVE = new Set(['lists:write', 'social:write']);
</script>

<Guide
	title="Scopes"
	lede="What each word opens, and why the list is short."
>
	<p>
		A scope is added on the day the thing it guards starts checking for it, not on the day somebody
		imagines the feature. That is not tidiness: a consent screen listing something nothing honours
		teaches people that agreeing is a formality, and the next screen they click through is the one
		that mattered.
	</p>

	<p>
		So the list below is <strong>generated from the same document the libraries are</strong>, and
		every operation named under a word is an operation that actually checks for it.
	</p>

	<p>
		Ask for the fewest you can. A person reading a consent screen with two words on it reads both;
		one with nine reads none.
	</p>

	{#each data.scopes as scope (scope.key)}
		<section class="scope">
			<h2 id={scope.key.replace(':', '-')}>
				<code>{scope.key}</code>
				{#if SENSITIVE.has(scope.key)}<span class="mark">shown apart</span>{/if}
				<a class="anchor" href="#{scope.key.replace(':', '-')}" aria-label="a link to this scope">
					#
				</a>
			</h2>

			<p>{SAYS[scope.key] ?? ''}</p>

			{#if SENSITIVE.has(scope.key)}
				<p class="note">
					Writing as somebody is one of the two a person should have to look at twice, so the
					consent screen shows it apart from the rest.
				</p>
			{/if}

			{#if scope.opens.length}
				<ul class="opens">
					{#each scope.opens as op (op.id)}
						<li>
							<a href="/reference/{slug(op.id)}">
								<code class="verb">{op.method}</code>
								<code>{op.path.replace('/api/v1', '')}</code>
							</a>
						</li>
					{/each}
				</ul>
			{:else}
				<p class="nothing">
					Nothing under <code>/api/v1</code> checks for this one — it is about the sign-in itself
					rather than about an endpoint.
				</p>
			{/if}
		</section>
	{/each}
</Guide>

<style>
	.scope h2 code {
		font-size: 0.85em;
	}

	.mark {
		margin-left: var(--s-2);
		padding: 2px 8px;
		border-radius: var(--r-full);
		background: var(--accent-faint);
		color: var(--accent-hover);
		font-size: var(--fs-tiny);
		font-weight: 500;
		letter-spacing: 0;
		text-transform: none;
	}

	.note {
		padding-left: var(--s-3);
		border-left: 2px solid var(--accent-soft);
		color: var(--text-muted);
	}

	.opens {
		list-style: none;
		margin: var(--s-2) 0 0;
		padding: 0;
		display: flex;
		flex-wrap: wrap;
		gap: var(--s-1);
	}

	.opens a {
		display: inline-flex;
		align-items: baseline;
		gap: var(--s-2);
		padding: 3px var(--s-2);
		border: 1px solid var(--border);
		border-radius: var(--r-control);
		font-family: var(--font-mono);
		font-size: var(--fs-tiny);
		color: var(--text-2);
		text-decoration: none;
	}
	.opens a:hover {
		border-color: var(--accent-soft);
		background: var(--accent-faint);
		color: var(--text-title);
		text-decoration: none;
	}

	.verb {
		color: var(--text-muted);
	}

	.nothing {
		color: var(--text-muted);
	}
</style>
