<script lang="ts">
	interface RankRow {
		key: string;
		label: string;
		value: number;
		caption?: string;
		href?: string;
	}

	let {
		rows,
		format = (n: number) => String(n),
		empty = 'Nothing to show yet.'
	}: { rows: RankRow[]; format?: (n: number) => string; empty?: string } = $props();

	const max = $derived(Math.max(...rows.map((r) => r.value), 1));
</script>

{#if rows.length === 0}
	<p class="py-8 text-center text-sm text-slate-400">{empty}</p>
{:else}
	<div class="space-y-3">
		{#each rows as row (row.key)}
			<div class="grid grid-cols-[minmax(0,10rem)_1fr_auto] items-center gap-3">
				<div class="min-w-0">
					{#if row.href}
						<a href={row.href} class="block truncate text-sm font-medium text-slate-700 hover:text-emerald-700" title={row.label}>
							{row.label}
						</a>
					{:else}
						<span class="block truncate text-sm font-medium text-slate-700" title={row.label}>{row.label}</span>
					{/if}
					{#if row.caption}
						<span class="block truncate text-xs text-slate-400">{row.caption}</span>
					{/if}
				</div>
				<div class="h-4 rounded-r-[4px] bg-slate-100">
					<div class="h-full rounded-r-[4px] bg-emerald-600" style="width: {(row.value / max) * 100}%"></div>
				</div>
				<span class="text-sm font-semibold text-slate-700 tabular-nums">{format(row.value)}</span>
			</div>
		{/each}
	</div>
{/if}
