<script lang="ts">
	import { page } from '$app/state';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import DataTable from '$lib/components/DataTable.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import StatusBadge from '$lib/components/StatusBadge.svelte';
	import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import { parties } from '$lib/stores/parties.svelte';
	import { getRecentTransactions, setPartyStatus } from '$lib/firebase/firestore';
	import { toast } from '$lib/stores/toast.svelte';
	import { friendlyError } from '$lib/utils/errors';
	import { formatDate, formatDateTime } from '$lib/utils/dates';
	import { formatKg } from '$lib/utils/format';
	import type { Transaction } from '$lib/types';

	const id = $derived(page.params.id ?? '');
	const party = $derived(parties.byId.get(id) ?? null);

	let recent = $state<Transaction[]>([]);
	let loadingTx = $state(true);
	let txError = $state<string | null>(null);

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

	$effect(() => {
		void id;
		loadTx();
	});

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
	<PageHeader title={party.partyName} backHref="/parties" backLabel="Parties">
		{#snippet actions()}
			<button type="button" class="btn-secondary" onclick={() => (confirmOpen = true)}>
				<Icon name="power" />{party.status === 'active' ? 'Deactivate' : 'Activate'}
			</button>
			<a href="/parties/{party.id}/edit" class="btn-primary"><Icon name="edit" />Edit</a>
		{/snippet}
	</PageHeader>

	<div class="card mb-6 max-w-2xl">
		<dl class="grid grid-cols-1 gap-x-6 gap-y-4 p-5 sm:grid-cols-2">
			<div><dt class="text-xs text-slate-500">Party Name</dt><dd class="text-sm font-medium">{party.partyName}</dd></div>
			<div><dt class="text-xs text-slate-500">Status</dt><dd><StatusBadge status={party.status} /></dd></div>
			<div><dt class="text-xs text-slate-500">Place</dt><dd class="text-sm">{party.place || '—'}</dd></div>
			<div><dt class="text-xs text-slate-500">Phone Number</dt><dd class="text-sm tabular-nums">{party.phoneNumber || '—'}</dd></div>
			<div><dt class="text-xs text-slate-500">Created</dt><dd class="text-sm">{formatDateTime(party.createdAt)}</dd></div>
			<div><dt class="text-xs text-slate-500">Last Updated</dt><dd class="text-sm">{formatDateTime(party.updatedAt)}</dd></div>
		</dl>
	</div>

	<div class="mb-2 flex items-center justify-between">
		<h2 class="text-sm font-semibold text-slate-800">Recent Entries</h2>
		<a class="btn-link" href="/received-from-party?q={encodeURIComponent(party.phoneNumber || party.partyName)}">View all entries</a>
	</div>
	<DataTable loading={loadingTx} error={txError} onretry={loadTx} isEmpty={recent.length === 0}>
		{#snippet head()}
			<tr><th class="th">Date</th><th class="th">Way Number</th><th class="th">Item</th><th class="th num">Total</th><th class="th num">Kg</th><th class="th">Status</th></tr>
		{/snippet}
		{#snippet body()}
			{#each recent as t (t.id)}
				<tr class="hover:bg-slate-50">
					<td class="td">{formatDate(t.transactionDate)}</td>
					<td class="td"><a class="btn-link" href="/received-from-party/{t.id}">{t.wayNumber}</a></td>
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
