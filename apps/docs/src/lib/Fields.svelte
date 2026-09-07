<script lang="ts">
	/**
	 * A shape's fields, as one language writes them.
	 *
	 * The wire's own name is always shown, whatever the language, because that is
	 * what a `curl` answer holds and what the reader will be looking at in their
	 * debugger. Where a language renames it — Kotlin and C# do — the renamed one
	 * is shown beside it rather than instead of it.
	 */
	import type { Field } from '$tools/spec';
	import { links, member, optional, written, type Language } from '$lib/type';

	let { fields, language }: { fields: Field[]; language: Language } = $props();

	const renames = $derived(language === 'kotlin' || language === 'csharp');
</script>

<table>
	<thead>
		<tr>
			<th>field</th>
			<th>type</th>
			<th>what it is</th>
		</tr>
	</thead>
	<tbody>
		{#each fields as field (field.name)}
			<!-- `{@const}` has to be the immediate child of a block, which is what
			     this `{#each}` is — inside the `<td>` it was a compile error. -->
			{@const shape = links(field.ty)}
			{@const spelled = written(field.ty, language)}
			{@const shown = field.optional ? optional(spelled, language) : spelled}
			<tr>
				<td>
					<code class="name">{field.name}</code>
					{#if renames}
						<code class="renamed">{member(field.name, language)}</code>
					{/if}
					{#if field.optional}<span class="maybe">may be absent</span>{/if}
				</td>
				<td>
					<code class="type">
						{#if shape}
							<a href="#shape-{shape}">{shown}</a>
						{:else}
							{shown}
						{/if}
					</code>
				</td>
				<td class="says">{field.doc ?? ''}</td>
			</tr>
		{/each}
	</tbody>
</table>

<style>
	table {
		width: 100%;
		border-collapse: collapse;
		font-size: var(--fs-sub);
	}

	th {
		text-align: left;
		padding: var(--s-1) var(--s-3);
		border-bottom: 1px solid var(--border);
		color: var(--text-2);
		font-size: var(--fs-tiny);
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}

	td {
		padding: var(--s-2) var(--s-3);
		border-bottom: 1px solid var(--border);
		vertical-align: top;
		color: var(--text-caption);
	}

	tr:last-child td {
		border-bottom: none;
	}

	code {
		font-family: var(--font-mono);
		font-size: 0.9em;
	}

	.name {
		color: var(--text-title);
		font-weight: 600;
	}

	/* The name the language gives it, quieter than the wire's own. */
	.renamed {
		margin-left: var(--s-2);
		color: var(--text-muted);
	}

	.type {
		color: var(--accent-hover);
		white-space: nowrap;
	}

	.maybe {
		display: block;
		margin-top: 2px;
		font-size: var(--fs-tiny);
		color: var(--text-muted);
	}

	.says {
		max-width: 34rem;
		line-height: 1.55;
	}

	/* A table wider than the column scrolls inside itself rather than taking the
	   page sideways with it. */
	@media (max-width: 720px) {
		table {
			display: block;
			overflow-x: auto;
			white-space: nowrap;
		}
		.says {
			white-space: normal;
		}
	}
</style>
