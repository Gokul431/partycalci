<script lang="ts">
	import { onMount } from 'svelte';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import DataTable from '$lib/components/DataTable.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import StatusBadge from '$lib/components/StatusBadge.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import { getDashboardStats, getRecentTransactions } from '$lib/firebase/firestore';
	import { parties } from '$lib/stores/parties.svelte';
	import { friendlyError } from '$lib/utils/errors';
	import { formatDate } from '$lib/utils/dates';
	import { formatKg, formatNumber } from '$lib/utils/format';
	import type { Transaction } from '$lib/types';

	let stats = $state<Awaited<ReturnType<typeof getDashboardStats>> | null>(null);
	let recent = $state<Transaction[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);

	async function load() {
		loading = true;
		error = null;
		try {
			[stats, recent] = await Promise.all([getDashboardStats(), getRecentTransactions(10)]);
		} catch (e) {
			error = friendlyError(e, 'Could not load the dashboard.');
		} finally {
			loading = false;
		}
	}

	onMount(load);

	const cards = $derived([
		{ label: 'Total Parties', value: stats?.totalParties, href: '/parties' },
		{ label: 'Active Parties', value: stats?.activeParties, href: '/parties?status=active' },
		{ label: 'Total Received Entries', value: stats?.totalEntries, href: '/received-from-party' },
		{ label: "Today's Entries", value: stats?.todayEntries, href: '/received-from-party' }
	]);
</script>

<PageHeader title="Dashboard" subtitle="Overview of parties and received material">
	{#snippet actions()}
		<a href="/received-from-party/new" class="btn-primary"><Icon name="plus" />New Entry</a>
	{/snippet}
</PageHeader>

<div class="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
	{#each cards as c (c.label)}
		<a href={c.href} class="card p-4 transition-colors hover:border-emerald-300">
			<div class="text-xs font-medium tracking-wide text-slate-500 uppercase">{c.label}</div>
			{#if loading}
				<div class="mt-2 h-7 w-16 animate-pulse rounded bg-slate-200"></div>
			{:else}
				<div class="mt-1 text-2xl font-semibold text-slate-900 tabular-nums">{c.value == null ? '—' : formatNumber(c.value)}</div>
			{/if}
		</a>
	{/each}
</div>

<h2 class="mb-2 text-sm font-semibold text-slate-800">Recent Transactions</h2>
<DataTable {loading} {error} onretry={load} isEmpty={recent.length === 0} skeletonColumns={6}>
	{#snippet head()}
		<tr>
			<th class="th">Date</th><th class="th">Way Number</th><th class="th">Party</th>
			<th class="th">Item</th><th class="th num">Total</th><th class="th">Status</th>
		</tr>
	{/snippet}
	{#snippet body()}
		{#each recent as t (t.id)}
			<tr class="hover:bg-slate-50">
				<td class="td">{formatDate(t.transactionDate)}</td>
				<td class="td"><a class="btn-link" href="/received-from-party/{t.id}">{t.wayNumber}</a></td>
				<td class="td">{parties.byId.get(t.partyId)?.partyName ?? '—'}</td>
				<td class="td">{t.itemName}</td>
				<td class="td num">{formatKg(t.total)}</td>
				<td class="td"><StatusBadge status={t.status} /></td>
			</tr>
		{/each}
	{/snippet}
	{#snippet empty()}
		<EmptyState title="No received-from-party entries found.">
			<a href="/received-from-party/new" class="btn-primary"><Icon name="plus" />New Entry</a>
		</EmptyState>
	{/snippet}
</DataTable>
