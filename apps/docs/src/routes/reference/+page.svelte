<script lang="ts">
	import { slug } from '$lib/slug';

	let { data } = $props();
</script>

<svelte:head>
	<title>Reference — acyka api</title>
	<meta name="description" content="Every operation the acyka API answers, by what it is about." />
</svelte:head>

<div class="prose index">
	<h1>Reference</h1>
	<p>
		Every operation the api answers. Each page carries the same call in seven languages, what it
		asks for, what it answers with, and every shape that answer contains — because reading a
		reference is reading a shape and the shapes inside it.
	</p>

	{#each data.groups as group (group.tag)}
		<section>
			<h2 id={group.tag}>
				{group.tag}
				<a class="anchor" href="#{group.tag}" aria-label="a link to this section">#</a>
			</h2>
			{#if group.doc}<p>{group.doc}</p>{/if}

			<ul class="ops">
				{#each group.ops as op (op.id)}
					<li>
						<a href="/reference/{slug(op.id)}">
							<span class="verb" data-verb={op.method}>{op.method}</span>
							<code class="path">{op.path.replace('/api/v1', '')}</code>
							<span class="says">{op.summary ?? op.id}</span>
						</a>
					</li>
				{/each}
			</ul>
		</section>
	{/each}
</div>

<style>
	.index {
		max-width: 54rem;
	}

	.ops {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 1px;
	}

	.ops a {
		display: grid;
		grid-template-columns: 4.5rem minmax(0, 14rem) minmax(0, 1fr);
		align-items: baseline;
		gap: var(--s-3);
		padding: var(--s-2) var(--s-3);
		border-radius: var(--r-control);
		color: var(--text-caption);
		text-decoration: none;
	}
	.ops a:hover {
		background: var(--surface-2);
		text-decoration: none;
	}

	.verb {
		justify-self: start;
		padding: 2px 7px;
		border-radius: var(--r-sm);
		font-family: var(--font-mono);
		font-size: 10px;
		font-weight: 700;
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

	.path {
		font-family: var(--font-mono);
		font-size: var(--fs-sub);
		color: var(--text-title);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.says {
		font-size: var(--fs-sub);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	@media (max-width: 720px) {
		.ops a {
			grid-template-columns: 4.5rem minmax(0, 1fr);
		}
		.says {
			grid-column: 1 / -1;
			color: var(--text-muted);
		}
	}
</style>
