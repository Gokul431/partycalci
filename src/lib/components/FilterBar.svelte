<script lang="ts">
	import type { TransactionFilters } from '$lib/types';
	import Icon from './Icon.svelte';

	let {
		filters = $bindable(),
		disabled = false,
		onsearch,
		onreset
	}: {
		filters: TransactionFilters;
		disabled?: boolean;
		onsearch: () => void;
		onreset: () => void;
	} = $props();

	const rangeError = $derived(
		filters.dateFrom && filters.dateTo && filters.dateFrom > filters.dateTo
			? 'Date From must be on or before Date To.'
			: ''
	);

	function submit(e: SubmitEvent) {
		e.preventDefault();
		if (!rangeError) onsearch();
	}
</script>

<form class="card mb-4 p-4" onsubmit={submit} aria-label="Filters">
	<div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[10rem_10rem_minmax(0,1fr)_9rem_auto]">
		<div>
			<label class="label" for="f-from">Date From</label>
			<input id="f-from" type="date" class="input" bind:value={filters.dateFrom} max={filters.dateTo || undefined} />
		</div>
		<div>
			<label class="label" for="f-to">Date To</label>
			<input id="f-to" type="date" class="input" bind:value={filters.dateTo} min={filters.dateFrom || undefined} />
		</div>
		<div>
			<label class="label" for="f-search">Party / Phone / Way No</label>
			<div class="relative">
				<Icon name="search" class="pointer-events-none absolute top-2.5 left-2.5 h-4 w-4 text-slate-400" />
				<input id="f-search" type="search" class="input pl-8" placeholder="Search party name, phone or way no..." bind:value={filters.search} />
			</div>
		</div>
		<div>
			<label class="label" for="f-status">Status</label>
			<select id="f-status" class="select" bind:value={filters.status}>
				<option value="">All</option>
				<option value="active">Pending</option>
				<option value="inactive">Completed</option>
			</select>
		</div>
		<div class="flex items-end gap-2 sm:col-span-2 lg:col-span-1">
			<button type="submit" class="btn-primary flex-1 lg:flex-none" {disabled}><Icon name="search" />Search</button>
			<button type="button" class="btn-secondary flex-1 lg:flex-none" {disabled} onclick={onreset}>Reset</button>
		</div>
	</div>
	{#if rangeError}<p class="field-error">{rangeError}</p>{/if}
</form>
