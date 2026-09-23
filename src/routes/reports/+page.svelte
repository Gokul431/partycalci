<script lang="ts">
	import { untrack } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import FilterBar from '$lib/components/FilterBar.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import { getReportTotals, resolveFilters, type ReportTotals } from '$lib/firebase/firestore';
	import { parties } from '$lib/stores/parties.svelte';
	import { friendlyError } from '$lib/utils/errors';
	import { formatDate, parseISODate } from '$lib/utils/dates';
	import { formatCurrency, formatKg, formatNumber } from '$lib/utils/format';
	import { filtersFromUrl, filtersToSearch, hasActiveFilters } from '$lib/utils/filters';
	import { EMPTY_FILTERS, type TransactionFilters } from '$lib/types';

	const filters = $derived(filtersFromUrl(page.url));
	let draft = $state<TransactionFilters>({ ...EMPTY_FILTERS });
	$effect(() => {
		draft = { ...filters };
	});

	let totals = $state<ReportTotals | null>(null);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let requestId = 0;

	async function load() {
		const id = ++requestId;
		loading = true;
		error = null;
		try {
			const result = await getReportTotals(resolveFilters(filters, parties.list));
			if (id === requestId) totals = result;
		} catch (e) {
			if (id === requestId) error = friendlyError(e, 'Could not load the report.');
		} finally {
			if (id === requestId) loading = false;
		}
	}

	$effect(() => {
		void page.url.search;
		if (parties.loading) return;
		untrack(load);
	});

	const apply = (f: TransactionFilters) => goto(`/reports${filtersToSearch(f)}`, { keepFocus: true, noScroll: true });

	const summary = $derived.by(() => {
		const parts: string[] = [];
		const from = parseISODate(filters.dateFrom);
		const to = parseISODate(filters.dateTo);
		if (from && to) parts.push(`${formatDate(from)} to ${formatDate(to)}`);
		else if (from) parts.push(`From ${formatDate(from)}`);
		else if (to) parts.push(`Up to ${formatDate(to)}`);
		if (filters.search) parts.push(`Party: “${filters.search}”`);
		if (filters.status) parts.push(`Status: ${filters.status === 'active' ? 'Active' : 'Inactive'}`);
		return parts.length ? parts.join(' · ') : 'All entries';
	});

	const cards = $derived(
		totals
			? [
					{ label: 'Total Entries', value: formatNumber(totals.entries) },
					{ label: 'Total Load', value: formatKg(totals.load) },
					{ label: 'Total Empty', value: formatKg(totals.empty) },
					{ label: 'Total Weight', value: formatKg(totals.total) },
					{ label: 'Total Bags', value: formatNumber(totals.bagCount) },
					{ label: 'Total Kg', value: formatKg(totals.kg) },
					{ label: 'Total Freight', value: formatCurrency(totals.freightCharge) },
					{ label: 'Total Amount', value: formatCurrency(totals.amount) }
				]
			: []
	);
</script>

<PageHeader title="Reports" subtitle="Totals for received-from-party entries matching the filters" />

<FilterBar bind:filters={draft} onsearch={() => apply(draft)} onreset={() => apply(EMPTY_FILTERS)} />

<div class="mb-3 flex flex-wrap items-center justify-between gap-2">
	<p class="text-sm text-slate-600"><span class="font-medium text-slate-800">Showing:</span> {summary}</p>
	<a class="btn-link inline-flex items-center gap-1" href="/received-from-party{filtersToSearch(filters)}">
		<Icon name="eye" class="h-3.5 w-3.5" />View matching entries
	</a>
</div>

{#if error}
	<div class="card flex flex-col items-center gap-3 p-8 text-center" role="alert">
		<p class="text-sm text-slate-700">{error}</p>
		<button type="button" class="btn-secondary" onclick={load}><Icon name="refresh" />Try again</button>
	</div>
{:else}
	<div class="grid grid-cols-2 gap-3 md:grid-cols-4 {loading && totals ? 'opacity-60' : ''}">
		{#if !totals}
			{#each Array(8) as _, i (i)}
				<div class="card p-4"><div class="h-3 w-20 animate-pulse rounded bg-slate-200"></div><div class="mt-3 h-6 w-24 animate-pulse rounded bg-slate-200"></div></div>
			{/each}
		{:else}
			{#each cards as c (c.label)}
				<div class="card p-4">
					<div class="text-xs font-medium tracking-wide text-slate-500 uppercase">{c.label}</div>
					<div class="mt-1 text-xl font-semibold text-slate-900 tabular-nums">{c.value}</div>
				</div>
			{/each}
		{/if}
	</div>
	{#if totals && totals.entries === 0 && !loading}
		<p class="mt-4 text-sm text-slate-500">
			No records match your filters.
			{#if hasActiveFilters(filters)}<button type="button" class="btn-link ml-1" onclick={() => apply(EMPTY_FILTERS)}>Reset Filters</button>{/if}
		</p>
	{/if}
{/if}
