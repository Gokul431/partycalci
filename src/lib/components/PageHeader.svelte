<script lang="ts">
	import type { Snippet } from 'svelte';
	import Icon from './Icon.svelte';

	let {
		title,
		subtitle,
		backHref,
		backLabel = 'Back',
		actions
	}: { title: string; subtitle?: string; backHref?: string; backLabel?: string; actions?: Snippet } = $props();
</script>

<svelte:head><title>{title} · Party Calci</title></svelte:head>

<div class="mb-5">
	{#if backHref}
		<a href={backHref} class="mb-2 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
			<Icon name="back" class="h-3.5 w-3.5" />{backLabel}
		</a>
	{/if}
	<div class="flex flex-wrap items-center justify-between gap-3">
		<div>
			<h1 class="text-xl font-semibold tracking-tight text-slate-900">{title}</h1>
			{#if subtitle}<p class="mt-0.5 text-sm text-slate-500">{subtitle}</p>{/if}
		</div>
		{#if actions}<div class="flex flex-wrap items-center gap-2">{@render actions()}</div>{/if}
	</div>
</div>
