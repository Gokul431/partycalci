<script lang="ts">
	import { onMount } from 'svelte';
	import DataTable from '$lib/components/DataTable.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import StatusBadge from '$lib/components/StatusBadge.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import ColumnChart from '$lib/components/charts/ColumnChart.svelte';
	import LineChart from '$lib/components/charts/LineChart.svelte';
	import RankBars from '$lib/components/charts/RankBars.svelte';
	import { getDashboardStats, getRecentTransactions, getWeeklyActivity, type WeeklyActivity } from '$lib/firebase/firestore';
	import { parties } from '$lib/stores/parties.svelte';
	import { session } from '$lib/stores/session.svelte';
	import { friendlyError } from '$lib/utils/errors';
	import { formatDate } from '$lib/utils/dates';
	import { formatCurrency, formatKg, formatNumber } from '$lib/utils/format';
	import type { Transaction } from '$lib/types';

	let stats = $state<Awaited<ReturnType<typeof getDashboardStats>> | null>(null);
	let week = $state<WeeklyActivity | null>(null);
	let recent = $state<Transaction[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);

	async function load() {
		loading = true;
		error = null;
		try {
			[stats, week, recent] = await Promise.all([
				getDashboardStats(),
				getWeeklyActivity(7),
				getRecentTransactions(10)
			]);
		} catch (e) {
			error = friendlyError(e, 'Could not load the dashboard.');
		} finally {
			loading = false;
		}
	}

	onMount(load);

	const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
	const dayLabel = (d: Date) => `${WEEKDAYS[d.getDay()]} ${d.getDate()}`;

	/** Short axis ticks in lakh/crore, since a full ₹ amount is too wide for an axis. */
	function compactCurrency(n: number): string {
		const short = (v: number, suffix: string) => `₹${Number.isInteger(v) ? v : v.toFixed(1)}${suffix}`;
		if (n >= 10_000_000) return short(n / 10_000_000, 'Cr');
		if (n >= 100_000) return short(n / 100_000, 'L');
		if (n >= 1000) return short(n / 1000, 'k');
		return `₹${n}`;
	}

	const greeting = $derived(session.user?.email?.split('@')[0] ?? 'there');
	const today = $derived(week?.days[week.days.length - 1] ?? null);

	const cards = $derived([
		{ label: "Today's Entries", value: today ? formatNumber(today.entries) : '—', href: '/received-from-party' },
		{ label: 'Active Parties', value: stats ? formatNumber(stats.activeParties) : '—', href: '/parties?status=active' },
		{ label: "Today's Value", value: today ? formatCurrency(today.amount) : '—', href: '/received-from-party' },
		{ label: "Today's Weight", value: today ? formatKg(today.total) : '—', href: '/received-from-party' }
	]);

	const strip = $derived([
		{ label: 'Entries this week', value: week ? formatNumber(week.entries) : '—' },
		{ label: 'Weight this week', value: week ? formatKg(week.total) : '—' },
		{ label: 'Value this week', value: week ? formatCurrency(week.amount) : '—' },
		{ label: 'Total parties', value: stats ? formatNumber(stats.totalParties) : '—' }
	]);

	const entrySeries = $derived((week?.days ?? []).map((d) => ({ label: dayLabel(d.date), value: d.entries })));
	const valueSeries = $derived((week?.days ?? []).map((d) => ({ label: dayLabel(d.date), value: d.amount })));
	const topParties = $derived(
		(week?.topParties ?? []).map((p) => ({
			key: p.partyId,
			label: parties.byId.get(p.partyId)?.partyName ?? 'Unknown party',
			caption: formatKg(p.total),
			value: p.entries,
			href: `/parties/${p.partyId}`
		}))
	);
</script>

<svelte:head><title>Dashboard · MillBooks</title></svelte:head>

<div class="mb-6 flex flex-wrap items-end justify-between gap-4">
	<div>
		<p class="text-xs font-semibold tracking-widest text-emerald-700 uppercase">Rice Mill Register</p>
		<h1 class="mt-1 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">Welcome back, {greeting}</h1>
		<p class="mt-1.5 text-sm text-slate-500">Live intake, parties, weight and value — charts update as entries are recorded.</p>
	</div>
	<div class="flex items-center gap-3">
		<span class="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold tracking-wide text-slate-600">
			<span class="h-2 w-2 rounded-full bg-emerald-500"></span>LIVE
		</span>
		<a href="/received-from-party/new" class="btn-primary"><Icon name="plus" />New Entry</a>
	</div>
</div>

<div class="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
	{#each cards as c (c.label)}
		<a href={c.href} class="card border-t-[3px] border-t-emerald-600 p-4 transition-shadow hover:shadow-md">
			<div class="text-xs font-semibold tracking-wide text-slate-500 uppercase">{c.label}</div>
			{#if loading}
				<div class="mt-2 h-8 w-20 animate-pulse rounded bg-slate-200"></div>
			{:else}
				<div class="mt-1 text-2xl font-bold text-slate-900 sm:text-3xl">{c.value}</div>
			{/if}
		</a>
	{/each}
</div>

<div class="card mb-6 grid grid-cols-2 gap-4 p-5 lg:grid-cols-4">
	{#each strip as s (s.label)}
		<div>
			{#if loading}
				<div class="h-6 w-16 animate-pulse rounded bg-slate-200"></div>
			{:else}
				<div class="text-lg font-bold text-slate-900">{s.value}</div>
			{/if}
			<div class="mt-0.5 text-xs font-semibold tracking-wide text-slate-500 uppercase">{s.label}</div>
		</div>
	{/each}
</div>

<div class="mb-6 grid gap-4 lg:grid-cols-2">
	<section class="card p-5">
		<h2 class="text-base font-semibold text-slate-900">Entries · last 7 days</h2>
		<p class="mt-0.5 mb-4 text-xs text-slate-500">Received-from-party entries recorded each day</p>
		{#if loading}
			<div class="h-52 animate-pulse rounded bg-slate-100"></div>
		{:else}
			<ColumnChart data={entrySeries} format={formatNumber} summary="Entries recorded on each of the last 7 days" />
		{/if}
	</section>

	<section class="card p-5">
		<h2 class="text-base font-semibold text-slate-900">Value · last 7 days</h2>
		<p class="mt-0.5 mb-4 text-xs text-slate-500">Total amount across entries recorded each day</p>
		{#if loading}
			<div class="h-52 animate-pulse rounded bg-slate-100"></div>
		{:else}
			<LineChart data={valueSeries} format={formatCurrency} tickFormat={compactCurrency} summary="Entry value on each of the last 7 days" />
		{/if}
	</section>
</div>

<section class="card mb-6 p-5">
	<h2 class="text-base font-semibold text-slate-900">Top parties · last 7 days</h2>
	<p class="mt-0.5 mb-4 text-xs text-slate-500">Ranked by entries received, with total weight alongside</p>
	{#if loading}
		<div class="h-32 animate-pulse rounded bg-slate-100"></div>
	{:else}
		<RankBars rows={topParties} format={formatNumber} empty="No entries received in the last 7 days." />
	{/if}
</section>

<h2 class="mb-2 text-base font-semibold text-slate-900">Recent entries</h2>
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
				<td class="td">
					<a class="font-medium text-emerald-700 hover:underline" href="/received-from-party/{t.id}">{formatDate(t.transactionDate)}</a>
				</td>
				<td class="td"><a class="font-medium text-slate-900 hover:underline" href="/received-from-party/{t.id}">{t.wayNumber}</a></td>
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
