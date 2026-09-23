<script lang="ts">
	import { PAGE_SIZES } from '$lib/types';
	import Icon from './Icon.svelte';

	let {
		page,
		pageSize,
		rowCount,
		total = null,
		hasNext,
		disabled = false,
		onprev,
		onnext,
		onpagesize
	}: {
		page: number; // 1-based
		pageSize: number;
		rowCount: number;
		total?: number | null;
		hasNext: boolean;
		disabled?: boolean;
		onprev: () => void;
		onnext: () => void;
		onpagesize: (size: number) => void;
	} = $props();

	const from = $derived(rowCount ? (page - 1) * pageSize + 1 : 0);
	const to = $derived((page - 1) * pageSize + rowCount);
	const pages = $derived(total != null ? Math.max(1, Math.ceil(total / pageSize)) : null);
</script>

<div class="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600">
	<div class="flex items-center gap-2">
		<label for="page-size" class="text-slate-500">Rows per page</label>
		<select
			id="page-size"
			class="select w-auto py-1"
			value={pageSize}
			{disabled}
			onchange={(e) => onpagesize(Number(e.currentTarget.value))}
		>
			{#each PAGE_SIZES as s (s)}<option value={s}>{s}</option>{/each}
		</select>
	</div>
	<div class="flex items-center gap-3">
		<span class="tabular-nums">
			{from}–{to}{#if total != null}&nbsp;of {total}{/if}
			{#if pages != null}<span class="text-slate-400"> · Page {page} of {pages}</span>{/if}
		</span>
		<div class="flex gap-1">
			<button type="button" class="btn-secondary px-2 py-1" onclick={onprev} disabled={disabled || page <= 1} aria-label="Previous page">
				<Icon name="chevronLeft" />
			</button>
			<button type="button" class="btn-secondary px-2 py-1" onclick={onnext} disabled={disabled || !hasNext} aria-label="Next page">
				<Icon name="chevronRight" />
			</button>
		</div>
	</div>
</div>
