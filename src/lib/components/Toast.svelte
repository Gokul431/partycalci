<script lang="ts">
	import { toasts } from '$lib/stores/toast.svelte';
	import Icon from './Icon.svelte';

	const STYLE = {
		success: { icon: 'check', cls: 'border-emerald-200 text-emerald-800', iconCls: 'text-emerald-600' },
		error: { icon: 'alert', cls: 'border-red-200 text-red-800', iconCls: 'text-red-600' },
		info: { icon: 'info', cls: 'border-slate-200 text-slate-800', iconCls: 'text-slate-500' }
	} as const;
</script>

<div class="pointer-events-none fixed right-4 bottom-4 z-50 flex w-[calc(100%-2rem)] max-w-sm flex-col gap-2" aria-live="polite">
	{#each toasts.items as t (t.id)}
		{@const s = STYLE[t.kind]}
		<div class="pointer-events-auto flex items-start gap-2.5 rounded-lg border bg-white px-4 py-3 text-sm shadow-lg {s.cls}" role={t.kind === 'error' ? 'alert' : 'status'}>
			<Icon name={s.icon} class="mt-0.5 h-4 w-4 shrink-0 {s.iconCls}" />
			<p class="flex-1">{t.message}</p>
			<button type="button" class="text-slate-400 hover:text-slate-700" onclick={() => toasts.dismiss(t.id)} aria-label="Dismiss">
				<Icon name="x" class="h-4 w-4" />
			</button>
		</div>
	{/each}
</div>
