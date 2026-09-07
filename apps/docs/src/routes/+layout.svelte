<script lang="ts">
	/**
	 * The frame: a rail of addresses, the page, and a search box.
	 *
	 * Written here rather than taken from the kit, and that is a decision worth
	 * recording. `@cyka/ui` exports a `Shell` which is the right shape for a
	 * settings hub — a fixed rail and a column of cards — and its page is 860px
	 * wide and stacks its children with a gap. Documentation wants three columns
	 * and a reference table wider than that, and those styles are scoped inside
	 * the kit where nothing here can reach them. Everything else on this site is
	 * the kit's: the tokens, the motion, and every control.
	 */
	import { page } from '$app/state';
	import { Search } from '@cyka/ui';
	import IconSearch from '@tabler/icons-svelte/icons/search';
	import IconMenu from '@tabler/icons-svelte/icons/menu-2';
	import IconX from '@tabler/icons-svelte/icons/x';
	import IconBrandGithub from '@tabler/icons-svelte/icons/brand-github';
	import type { Group } from '$lib/nav';
	import '../app.css';

	let { data, children }: { data: { rail: Group[] }; children: import('svelte').Snippet } =
		$props();

	/*
	 * The rail arrives as data rather than being read here.
	 *
	 * It is derived from `openapi.json`, and this file runs in the browser as well
	 * as on the server — so calling the reader from it put the whole 160 KB
	 * document into the client bundle of every page on the site. `+layout.server.ts`
	 * does it once and hands over the finished links.
	 */
	const groups = $derived(data.rail);
	let open = $state(false);
	let filter = $state('');

	/** The rail, narrowed by whatever was typed into the box above it. */
	const showing = $derived.by(() => {
		const asked = filter.trim().toLowerCase();
		if (!asked) return groups;
		return groups
			.map((group) => ({
				label: group.label,
				links: group.links.filter(
					(link) =>
						link.label.toLowerCase().includes(asked) ||
						(link.hint ?? '').toLowerCase().includes(asked)
				)
			}))
			.filter((group) => group.links.length > 0);
	});

	/**
	 * Which link is the page.
	 *
	 * Exact first, then the longest prefix — without the second `/docs/errors`
	 * marks nothing while the rail shows `/docs`; without the first, `/docs`
	 * marks every guide as well as itself.
	 */
	const here = $derived.by(() => {
		const at = page.url.pathname;
		const all = groups.flatMap((g) => g.links);
		return (
			all.find((l) => l.href === at) ??
			all
				.filter((l) => at.startsWith(`${l.href}/`))
				.sort((a, b) => b.href.length - a.href.length)[0]
		);
	});

	// A rail that stays open after a tap is a rail covering the page somebody
	// just asked for.
	$effect(() => {
		void page.url.pathname;
		open = false;
	});
</script>

<svelte:head>
	<meta name="theme-color" content="#0b0b0f" />
</svelte:head>

<div class="frame" class:open>
	<header class="top">
		<button
			type="button"
			class="menu"
			aria-label={open ? 'close the menu' : 'open the menu'}
			aria-expanded={open}
			onclick={() => (open = !open)}
		>
			{#if open}<IconX size={20} stroke={1.8} />{:else}<IconMenu size={20} stroke={1.8} />{/if}
		</button>

		<a class="brand" href="/">
			<img src="/logo.svg" alt="" width="24" height="24" />
			<span>acyka</span>
			<span class="tag">api</span>
		</a>

		<nav class="wide">
			<a href="/docs" aria-current={page.url.pathname.startsWith('/docs') ? 'page' : undefined}>
				Guides
			</a>
			<a
				href="/reference"
				aria-current={page.url.pathname.startsWith('/reference') ? 'page' : undefined}
			>
				Reference
			</a>
			<a
				href="/playground"
				aria-current={page.url.pathname.startsWith('/playground') ? 'page' : undefined}
			>
				Playground
			</a>
		</nav>

		<a
			class="out"
			href="https://github.com/cykacloud/acyka-api"
			target="_blank"
			rel="noreferrer"
			aria-label="the source on GitHub"
		>
			<IconBrandGithub size={18} stroke={1.7} />
		</a>
	</header>

	<aside class="rail">
		<div class="find">
			<!-- The kit's own search box rather than an `Input` with an icon glued
			     to it: it already carries the icon slot, the clear button and the
			     `type="search"` semantics a browser gives a search field. -->
			<Search bind:value={filter} placeholder="filter" label="filter the list">
				{#snippet icon()}<IconSearch size={16} stroke={1.7} />{/snippet}
			</Search>
		</div>

		<nav>
			{#each showing as group (group.label)}
				<div class="group">
					<p class="label">{group.label}</p>
					{#each group.links as link (link.href)}
						<a href={link.href} aria-current={link === here ? 'page' : undefined}>
							<span class="text">{link.label}</span>
							{#if link.hint}<code>{link.hint}</code>{/if}
						</a>
					{/each}
				</div>
			{/each}

			{#if showing.length === 0}
				<p class="nothing">nothing matches “{filter}”</p>
			{/if}
		</nav>
	</aside>

	<main>{@render children()}</main>
</div>

<style>
	.frame {
		display: grid;
		grid-template-columns: 1fr;
		grid-template-rows: auto 1fr;
		grid-template-areas: 'top' 'main';
		min-height: 100dvh;
		background: var(--bg-solid);
	}

	.top {
		grid-area: top;
		position: sticky;
		top: 0;
		z-index: 3;
		display: flex;
		align-items: center;
		gap: var(--s-3);
		height: 56px;
		padding: 0 var(--s-3);
		background: color-mix(in oklab, var(--bg-solid) 88%, transparent);
		backdrop-filter: blur(12px);
		border-bottom: 1px solid var(--border);
	}

	.menu {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: var(--control-h);
		height: var(--control-h);
		border: 0;
		border-radius: var(--r-control);
		background: transparent;
		color: var(--text-2);
		cursor: pointer;
	}
	.menu:hover {
		background: var(--surface-2);
		color: var(--text);
	}

	.brand {
		display: inline-flex;
		align-items: center;
		gap: var(--s-2);
		color: var(--text-title);
		font-weight: 650;
		letter-spacing: -0.2px;
		text-decoration: none;
	}
	.brand:hover {
		text-decoration: none;
	}
	.tag {
		padding: 1px 6px;
		border-radius: var(--r-full);
		border: 1px solid var(--border);
		background: var(--surface-2);
		color: var(--text-muted);
		font-family: var(--font-mono);
		font-size: var(--fs-tiny);
		font-weight: 500;
	}

	.wide {
		display: none;
		margin-left: var(--s-4);
		gap: var(--s-1);
	}
	.wide a {
		padding: 6px var(--s-3);
		border-radius: var(--r-control);
		color: var(--text-2);
		font-size: var(--fs-sub);
		text-decoration: none;
	}
	.wide a:hover {
		background: var(--surface-2);
		color: var(--text);
		text-decoration: none;
	}
	.wide a[aria-current='page'] {
		color: var(--text-title);
		background: var(--surface-2);
		font-weight: 600;
	}

	.out {
		margin-left: auto;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: var(--control-h);
		height: var(--control-h);
		border-radius: var(--r-control);
		color: var(--text-2);
	}
	.out:hover {
		background: var(--surface-2);
		color: var(--text);
	}

	/*
	 * On a phone the rail is not squeezed, it is put away — a rail narrowed to
	 * icons is a rail nobody can read, and this list is words. It slides over
	 * the page rather than pushing it, so the address somebody is reading does
	 * not move under them.
	 */
	.rail {
		grid-area: main;
		position: fixed;
		inset: 56px 0 0 0;
		z-index: 2;
		display: none;
		flex-direction: column;
		gap: var(--s-3);
		padding: var(--s-3);
		background: var(--bg-solid);
		overflow-y: auto;
		overscroll-behavior: contain;
	}
	.frame.open .rail {
		display: flex;
	}

	.find {
		flex: none;
	}

	.rail nav {
		display: flex;
		flex-direction: column;
		gap: var(--s-4);
		padding-bottom: var(--s-8);
	}

	.group {
		display: flex;
		flex-direction: column;
		gap: 1px;
	}

	.label {
		margin: 0 0 var(--s-1);
		padding: 0 var(--s-2);
		font-size: var(--fs-tiny);
		font-weight: 600;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--text-caption);
	}

	.rail nav a {
		display: flex;
		align-items: baseline;
		gap: var(--s-2);
		padding: 5px var(--s-2);
		border-radius: var(--r-control);
		color: var(--text-2);
		font-size: var(--fs-sub);
		text-decoration: none;
		transition: background var(--t) var(--ease), color var(--t) var(--ease);
	}
	.rail nav a:hover {
		background: var(--surface-2);
		color: var(--text);
		text-decoration: none;
	}
	.rail nav a[aria-current='page'] {
		background: var(--accent-faint);
		color: var(--text-title);
		font-weight: 600;
	}

	.text {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		text-transform: capitalize;
	}

	.rail nav code {
		flex: none;
		font-family: var(--font-mono);
		font-size: 10px;
		color: var(--text-muted);
	}

	.nothing {
		padding: var(--s-3) var(--s-2);
		color: var(--text-muted);
		font-size: var(--fs-sub);
	}

	main {
		grid-area: main;
		/*
		 * A grid item is `min-width: auto`, so a wide reference table would push
		 * this column past the screen and take the text with it. This is the line
		 * that stops the page scrolling sideways.
		 */
		min-width: 0;
		padding: var(--s-6) var(--s-4) var(--s-12);
	}

	@media (min-width: 960px) {
		.frame {
			grid-template-columns: 272px minmax(0, 1fr);
			grid-template-areas: 'top top' 'rail main';
		}

		.menu {
			display: none;
		}

		.wide {
			display: flex;
		}

		.rail {
			grid-area: rail;
			display: flex;
			/* Sticky rather than fixed: a fixed rail on a short viewport puts its
			   own last item below the fold with nothing to scroll. */
			position: sticky;
			/*
			 * `inset` before `top`, and that order is the whole of it.
			 *
			 * The phone rule pins all four edges, so they have to be let go of
			 * here — but `inset: auto` is shorthand for all four, and written
			 * *after* `top` it silently resets it. A sticky element with
			 * `top: auto` never sticks: it scrolls away with the page and looks
			 * exactly like a rail somebody forgot to make sticky.
			 */
			inset: auto;
			top: 56px;
			align-self: start;
			max-height: calc(100dvh - 56px);
			border-right: 1px solid var(--border);
		}

		main {
			padding: var(--s-8) var(--s-8) var(--s-12);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.rail nav a {
			transition: none;
		}
	}
</style>
