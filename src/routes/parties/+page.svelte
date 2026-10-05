<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import DataTable from '$lib/components/DataTable.svelte';
	import Pagination from '$lib/components/Pagination.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import StatusBadge from '$lib/components/StatusBadge.svelte';
	import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import RowActionsMenu from '$lib/components/RowActionsMenu.svelte';
	import { parties } from '$lib/stores/parties.svelte';
	import { untrack } from 'svelte';
	import { SvelteMap } from 'svelte/reactivity';
	import { getPartySummary, matchPartyIds, setPartyStatus, type PartySummary } from '$lib/firebase/firestore';
	import { formatDate } from '$lib/utils/dates';
	import { formatKg, formatNumber } from '$lib/utils/format';
	import { toast } from '$lib/stores/toast.svelte';
	import { friendlyError } from '$lib/utils/errors';
	import { pageSizeFromUrl } from '$lib/utils/filters';
	import type { Party, Status } from '$lib/types';

	// Search/status live in the URL so the list is restored after View/Edit.
	let search = $state(page.url.searchParams.get('q') ?? '');
	let status = $state<Status | ''>(
		(['active', 'inactive'] as const).find((s) => s === page.url.searchParams.get('status')) ?? ''
	);
	let pageSize = $state(pageSizeFromUrl(page.url));
	let pageNo = $state(1);

	const filtered = $derived.by(() => {
		let list = parties.list;
		if (status) list = list.filter((p) => p.status === status);
		if (search.trim()) {
			const ids = new Set(matchPartyIds(list, search));
			list = list.filter((p) => ids.has(p.id));
		}
		return list;
	});
	const rows = $derived(filtered.slice((pageNo - 1) * pageSize, pageNo * pageSize));

	// Per-party activity (Active entries only), loaded just for the rows on screen.
	type SummaryState = { state: 'loading' } | { state: 'ready'; data: PartySummary } | { state: 'error' };
	const summaries = new SvelteMap<string, SummaryState>();

	$effect(() => {
		for (const p of rows) {
			if (untrack(() => summaries.has(p.id))) continue;
			summaries.set(p.id, { state: 'loading' });
			getPartySummary(p.id)
				.then((data) => summaries.set(p.id, { state: 'ready', data }))
				.catch((e) => {
					console.error(e);
					summaries.set(p.id, { state: 'error' });
				});
		}
	});

	/** Received From Party list filtered to this party's entries (optionally Active only). */
	const entriesHref = (p: Party, activeOnly: boolean) =>
		`/received-from-party?${new URLSearchParams({ q: p.phoneNumber || p.partyName, ...(activeOnly ? { status: 'active' } : {}) })}`;
	const hasFilters = $derived(!!search.trim() || !!status);

	// Reset to page 1 and sync the URL whenever the filters change.
	$effect(() => {
		const p = new URLSearchParams();
		if (search.trim()) p.set('q', search.trim());
		if (status) p.set('status', status);
		if (pageSize !== 20) p.set('size', String(pageSize));
		pageNo = 1;
		const qs = p.toString();
		if (qs !== page.url.searchParams.toString())
			goto(`/parties${qs ? `?${qs}` : ''}`, { replaceState: true, keepFocus: true, noScroll: true });
	});

	let confirmOpen = $state(false);
	let target = $state<Party | null>(null);
	let busy = $state(false);

	function askToggle(p: Party) {
		target = p;
		confirmOpen = true;
	}

	async function toggle() {
		if (!target) return;
		const next: Status = target.status === 'active' ? 'inactive' : 'active';
		busy = true;
		try {
			await setPartyStatus(target.id, next);
			toast.success(`${target.partyName} marked as ${next === 'active' ? 'Active' : 'Inactive'}.`);
			confirmOpen = false;
		} catch (e) {
			toast.error(friendlyError(e, 'Could not update the party status.'));
		} finally {
			busy = false;
		}
	}

	function reset() {
		search = '';
		status = '';
	}
</script>

<PageHeader title="Parties" subtitle="Party master — parties are never deleted, only deactivated">
	{#snippet actions()}
		<a href="/parties/new" class="btn-primary"><Icon name="plus" />Add Party</a>
	{/snippet}
</PageHeader>

<div class="card mb-4 flex flex-col gap-3 p-4 sm:flex-row sm:items-end">
	<div class="flex-1">
		<label class="label" for="party-search">Search</label>
		<div class="relative">
			<Icon name="search" class="pointer-events-none absolute top-2.5 left-2.5 h-4 w-4 text-slate-400" />
			<input id="party-search" type="search" class="input pl-8" placeholder="Search party name or phone number..." bind:value={search} />
		</div>
	</div>
	<div class="sm:w-44">
		<label class="label" for="party-status">Status</label>
		<select id="party-status" class="select" bind:value={status}>
			<option value="">All</option>
			<option value="active">Active</option>
			<option value="inactive">Inactive</option>
		</select>
	</div>
	{#if hasFilters}<button type="button" class="btn-secondary" onclick={reset}>Reset</button>{/if}
</div>

{#snippet billCount(p: Party, n: number, activeOnly: boolean)}
	<td class="td num">
		{#if n > 0}
			<a
				href={entriesHref(p, activeOnly)}
				class="font-medium text-emerald-700 hover:underline"
				title={activeOnly ? "View this party's active bills" : "View all of this party's bills"}>{formatNumber(n)}</a
			>
		{:else}
			<span class="text-slate-400">0</span>
		{/if}
	</td>
{/snippet}

<DataTable loading={parties.loading} error={parties.error} onretry={() => parties.start()} isEmpty={rows.length === 0} skeletonColumns={9}>
	{#snippet head()}
		<tr>
			<th class="th">Party Name</th><th class="th">Place</th><th class="th">Phone Number</th>
			<th class="th num" title="Bills still pending">Pending Bills</th>
			<th class="th num" title="All bills, pending and completed">Total Bills</th>
			<th class="th num" title="Load − Empty across active bills">Total Weight</th><th class="th">Last Entry</th>
			<th class="th">Status</th><th class="th w-16 text-right">Actions</th>
		</tr>
	{/snippet}
	{#snippet body()}
		{#each rows as p (p.id)}
			{@const sum = summaries.get(p.id)}
			<tr class="hover:bg-slate-50">
				<td class="td">
					<span class="inline-flex items-center gap-2">
						<a href="/parties/{p.id}" class="font-medium text-emerald-700 hover:underline">{p.partyName}</a>
						<span class="rounded px-1.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase {p.partyType === 'farmer'
							? 'bg-emerald-50 text-emerald-700'
							: 'bg-slate-100 text-slate-600'}">
							{p.partyType === 'farmer' ? 'Farmer' : 'Wholesale'}
						</span>
					</span>
				</td>
				<td class="td">{p.place || '—'}</td>
				<td class="td tabular-nums">{p.phoneNumber || '—'}</td>
				{#if sum?.state === 'ready'}
					{@render billCount(p, sum.data.entries, true)}
					{@render billCount(p, sum.data.allEntries, false)}
					<td class="td num font-medium">{formatKg(sum.data.total)}</td>
					<td class="td">{sum.data.lastEntry ? formatDate(sum.data.lastEntry) : '—'}</td>
				{:else if sum?.state === 'error'}
					<td class="td num text-slate-400" colspan="4" title="Could not load this party's totals">Unavailable</td>
				{:else}
					{#each Array(4) as _, i (i)}
						<td class="td"><div class="ml-auto h-3.5 w-12 animate-pulse rounded bg-slate-200"></div></td>
					{/each}
				{/if}
				<td class="td"><StatusBadge status={p.status} /></td>
				<td class="td">
					<div class="flex justify-end">
						<RowActionsMenu
							label="Actions for {p.partyName}"
							items={[
								{ label: 'View', icon: 'eye', href: `/parties/${p.id}` },
								{ label: 'Edit', icon: 'edit', href: `/parties/${p.id}/edit` },
								p.status === 'active'
									? { label: 'Mark as Inactive', icon: 'ban', tone: 'danger', divider: true, onclick: () => askToggle(p) }
									: { label: 'Mark as Active', icon: 'checkCircle', tone: 'success', divider: true, onclick: () => askToggle(p) }
							]}
						/>
					</div>
				</td>
			</tr>
		{/each}
	{/snippet}
	{#snippet empty()}
		{#if hasFilters}
			<EmptyState title="No records match your filters." icon="filter">
				<button type="button" class="btn-secondary" onclick={reset}>Reset Filters</button>
			</EmptyState>
		{:else}
			<EmptyState title="No parties found." description="Add your first party to get started." icon="users">
				<a href="/parties/new" class="btn-primary"><Icon name="plus" />Add Party</a>
			</EmptyState>
		{/if}
	{/snippet}
	{#snippet footer()}
		<Pagination
			page={pageNo}
			{pageSize}
			rowCount={rows.length}
			total={filtered.length}
			hasNext={pageNo * pageSize < filtered.length}
			onprev={() => pageNo--}
			onnext={() => pageNo++}
			onpagesize={(s) => (pageSize = s)}
		/>
	{/snippet}
</DataTable>

<ConfirmDialog
	bind:open={confirmOpen}
	title={target?.status === 'active' ? 'Mark party as Inactive?' : 'Mark party as Active?'}
	message={target?.status === 'active'
		? `${target?.partyName} will no longer appear in the party list for new entries. Existing entries are not affected.`
		: `${target?.partyName} will be available again for new entries.`}
	confirmLabel={target?.status === 'active' ? 'Mark as Inactive' : 'Mark as Active'}
	tone={target?.status === 'active' ? 'danger' : 'primary'}
	{busy}
	onconfirm={toggle}
/>
