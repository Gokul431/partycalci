<script lang="ts">
	import type { Snippet } from 'svelte';
	import Icon from './Icon.svelte';

	let {
		loading = false,
		error = null,
		isEmpty = false,
		skeletonColumns = 6,
		onretry,
		head,
		body,
		empty,
		footer
	}: {
		loading?: boolean;
		error?: string | null;
		isEmpty?: boolean;
		skeletonColumns?: number;
		onretry?: () => void;
		head: Snippet;
		body: Snippet;
		empty?: Snippet;
		footer?: Snippet;
	} = $props();
</script>

<div class="card overflow-hidden">
	{#if error}
		<div class="flex flex-col items-center gap-3 px-6 py-12 text-center" role="alert">
			<div class="rounded-full bg-red-50 p-3 text-red-500"><Icon name="alert" class="h-6 w-6" /></div>
			<p class="max-w-md text-sm text-slate-700">{error}</p>
			{#if onretry}
				<button type="button" class="btn-secondary" onclick={onretry}><Icon name="refresh" />Try again</button>
			{/if}
		</div>
	{:else}
		<div class="relative overflow-x-auto">
			<table class="min-w-full divide-y divide-slate-200">
				<thead class="bg-slate-50">{@render head()}</thead>
				<tbody class="divide-y divide-slate-100 {loading && !isEmpty ? 'opacity-50' : ''}">
					{#if loading && isEmpty}
						{#each Array(5) as _, i (i)}
							<tr>
								{#each Array(skeletonColumns) as _, j (j)}
									<td class="td"><div class="h-3.5 w-full max-w-24 animate-pulse rounded bg-slate-200"></div></td>
								{/each}
							</tr>
						{/each}
					{:else if !isEmpty}
						{@render body()}
					{/if}
				</tbody>
			</table>
			{#if loading && !isEmpty}
				<div class="absolute inset-0 flex items-start justify-center pt-16" aria-live="polite">
					<span class="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-600 shadow">Loading…</span>
				</div>
			{/if}
		</div>
		{#if !loading && isEmpty && empty}
			{@render empty()}
		{/if}
		{#if footer && !isEmpty}
			<div class="border-t border-slate-200 px-3 py-2.5">{@render footer()}</div>
		{/if}
	{/if}
</div>
