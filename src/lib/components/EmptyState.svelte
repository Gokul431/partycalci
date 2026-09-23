<script lang="ts">
	import type { Snippet } from 'svelte';
	import Icon, { type IconName } from './Icon.svelte';

	let {
		title,
		description,
		icon = 'inbox',
		children
	}: { title: string; description?: string; icon?: IconName; children?: Snippet } = $props();
</script>

<div class="flex flex-col items-center justify-center px-6 py-14 text-center">
	<div class="mb-3 rounded-full bg-slate-100 p-3 text-slate-400"><Icon name={icon} class="h-6 w-6" /></div>
	<p class="text-sm font-semibold text-slate-800">{title}</p>
	{#if description}<p class="mt-1 text-sm text-slate-500">{description}</p>{/if}
	{#if children}<div class="mt-4 flex gap-2">{@render children()}</div>{/if}
</div>
