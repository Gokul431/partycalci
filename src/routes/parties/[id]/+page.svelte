<script lang="ts">
	import { page } from '$app/state';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import DataTable from '$lib/components/DataTable.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import StatusBadge from '$lib/components/StatusBadge.svelte';
	import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import { parties } from '$lib/stores/parties.svelte';
	import { getRecentTransactions, getReportTotals, setPartyStatus, type ReportTotals } from '$lib/firebase/firestore';
	import { toast } from '$lib/stores/toast.svelte';
	import { friendlyError } from '$lib/utils/errors';
	import { formatDate, formatDateTime } from '$lib/utils/dates';
	import { formatCurrency, formatKg, formatNumber } from '$lib/utils/format';
	import type { Transaction } from '$lib/types';

	const id = $derived(page.params.id ?? '');
	const party = $derived(parties.byId.get(id) ?? null);

	let recent = $state<Transaction[]>([]);
	let loadingTx = $state(true);
	let txError = $state<string | null>(null);

	let totals = $state<ReportTotals | null>(null);
	let loadingTotals = $state(true);

	async function loadTx() {
		loadingTx = true;
		txError = null;
		try {
			recent = await getRecentTransactions(10, id);
		} catch (e) {
			txError = friendlyError(e, 'Could not load entries for this party.');
		} finally {
			loadingTx = false;
		}
	}

	async function loadTotals() {
		loadingTotals = true;
		try {
			totals = await getReportTotals({ dateFrom: '', dateTo: '', status: '', partyIds: [id] });
		} catch (e) {
			// The summary is supporting detail; the entries table below still stands on its own.
			totals = null;
			console.error(e);
		} finally {
			loadingTotals = false;
		}
	}

	$effect(() => {
		void id;
		loadTx();
		loadTotals();
	});

	const summary = $derived([
		{ label: 'Total Entries', value: totals ? formatNumber(totals.entries) : '—' },
		{ label: 'Total Weight', value: totals ? formatKg(totals.total) : '—' },
		{ label: 'Total Bags', value: totals ? formatNumber(totals.bagCount) : '—' },
		{ label: 'Total Value', value: totals ? formatCurrency(totals.amount) : '—' }
	]);

	let confirmOpen = $state(false);
	let busy = $state(false);
	async function toggle() {
		if (!party) return;
		const next = party.status === 'active' ? 'inactive' : 'active';
		busy = true;
		try {
			await setPartyStatus(party.id, next);
			toast.success(`Party ${next === 'active' ? 'activated' : 'deactivated'}.`);
			confirmOpen = false;
		} catch (e) {
			toast.error(friendlyError(e, 'Could not update the party status.'));
		} finally {
			busy = false;
		}
	}
</script>

{#if parties.loading}
	<p class="text-sm text-slate-500">Loading party…</p>
{:else if parties.error}
	<p class="text-sm text-red-600">{parties.error}</p>
{:else if !party}
	<PageHeader title="Party not found" backHref="/parties" backLabel="Parties" />
	<div class="card"><EmptyState title="This party does not exist." icon="users"><a href="/parties" class="btn-secondary">Back to Parties</a></EmptyState></div>
{:else}
	<PageHeader title={party.partyName} subtitle={party.place || undefined} backHref="/parties" backLabel="Parties">
		{#snippet badge()}<StatusBadge status={party?.status ?? 'active'} />{/snippet}
		{#snippet actions()}
			<button type="button" class="btn-secondary" onclick={() => (confirmOpen = true)}>
				<Icon name="power" />{party.status === 'active' ? 'Deactivate' : 'Activate'}
			</button>
			<a href="/parties/{party.id}/edit" class="btn-primary"><Icon name="edit" />Edit</a>
		{/snippet}
	</PageHeader>

	<div class="card mb-4 grid grid-cols-2 divide-slate-200 lg:grid-cols-4 lg:divide-x">
		{#each summary as s (s.label)}
			<div class="px-5 py-4">
				<div class="text-xs font-semibold tracking-wide text-slate-500 uppercase">{s.label}</div>
				{#if loadingTotals}
					<div class="mt-2 h-6 w-20 animate-pulse rounded bg-slate-200"></div>
				{:else}
					<div class="mt-1 text-xl font-bold text-slate-900">{s.value}</div>
				{/if}
			</div>
		{/each}
	</div>

	<section class="card mb-6">
		<header class="border-b border-slate-100 px-5 py-3">
			<h2 class="text-sm font-semibold text-slate-800">Party Details</h2>
		</header>
		<dl class="grid grid-cols-1 gap-x-6 gap-y-5 p-5 sm:grid-cols-2 lg:grid-cols-4">
			<div>
				<dt class="text-xs font-medium tracking-wide text-slate-500 uppercase">Party Name</dt>
				<dd class="mt-1 text-sm font-medium text-slate-900">{party.partyName}</dd>
			</div>
			<div>
				<dt class="text-xs font-medium tracking-wide text-slate-500 uppercase">Place</dt>
				<dd class="mt-1 text-sm text-slate-900">{party.place || '—'}</dd>
			</div>
			<div>
				<dt class="text-xs font-medium tracking-wide text-slate-500 uppercase">Phone Number</dt>
				<dd class="mt-1 text-sm text-slate-900 tabular-nums">{party.phoneNumber || '—'}</dd>
			</div>
			<div>
				<dt class="text-xs font-medium tracking-wide text-slate-500 uppercase">Status</dt>
				<dd class="mt-1"><StatusBadge status={party.status} /></dd>
			</div>
			<div>
				<dt class="text-xs font-medium tracking-wide text-slate-500 uppercase">Created</dt>
				<dd class="mt-1 text-sm text-slate-900">{formatDateTime(party.createdAt)}</dd>
			</div>
			<div>
				<dt class="text-xs font-medium tracking-wide text-slate-500 uppercase">Last Updated</dt>
				<dd class="mt-1 text-sm text-slate-900">{formatDateTime(party.updatedAt)}</dd>
			</div>
		</dl>
	</section>

	<div class="mb-2 flex items-center justify-between">
		<h2 class="text-base font-semibold text-slate-900">Recent Entries</h2>
		<a class="btn-link" href="/received-from-party?q={encodeURIComponent(party.phoneNumber || party.partyName)}">View all entries</a>
	</div>
	<DataTable loading={loadingTx} error={txError} onretry={loadTx} isEmpty={recent.length === 0}>
		{#snippet head()}
			<tr><th class="th">Date</th><th class="th">Way Number</th><th class="th">Item</th><th class="th num">Total</th><th class="th num">Kg</th><th class="th">Status</th></tr>
		{/snippet}
		{#snippet body()}
			{#each recent as t (t.id)}
				<tr class="hover:bg-slate-50">
					<td class="td">
						<a class="font-medium text-emerald-700 hover:underline" href="/received-from-party/{t.id}">{formatDate(t.transactionDate)}</a>
					</td>
					<td class="td"><a class="font-medium text-slate-900 hover:underline" href="/received-from-party/{t.id}">{t.wayNumber}</a></td>
					<td class="td">{t.itemName}</td>
					<td class="td num">{formatKg(t.total)}</td>
					<td class="td num">{formatKg(t.kg)}</td>
					<td class="td"><StatusBadge status={t.status} /></td>
				</tr>
			{/each}
		{/snippet}
		{#snippet empty()}
			<EmptyState title="No received-from-party entries for this party yet." />
		{/snippet}
	</DataTable>

	<ConfirmDialog
		bind:open={confirmOpen}
		title={party.status === 'active' ? 'Deactivate party?' : 'Activate party?'}
		message={party.status === 'active'
			? 'This party will no longer be selectable for new entries. Existing entries are not affected.'
			: 'This party will be available again for new entries.'}
		confirmLabel={party.status === 'active' ? 'Deactivate' : 'Activate'}
		tone={party.status === 'active' ? 'danger' : 'primary'}
		{busy}
		onconfirm={toggle}
	/>
{/if}
