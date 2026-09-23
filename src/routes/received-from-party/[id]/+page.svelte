<script lang="ts">
	import { page } from '$app/state';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import StatusBadge from '$lib/components/StatusBadge.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import { getTransaction, setTransactionStatus } from '$lib/firebase/firestore';
	import { parties } from '$lib/stores/parties.svelte';
	import { toast } from '$lib/stores/toast.svelte';
	import { friendlyError } from '$lib/utils/errors';
	import { formatDate, formatDateTime } from '$lib/utils/dates';
	import { formatCurrency, formatKg, formatNumber, purchaseTypeLabel } from '$lib/utils/format';
	import { KG_PER_BAG } from '$lib/utils/calculations';
	import type { Transaction } from '$lib/types';

	const id = $derived(page.params.id ?? '');
	let tx = $state<Transaction | null>(null);
	let loading = $state(true);
	let error = $state<string | null>(null);

	async function load() {
		loading = true;
		error = null;
		try {
			tx = await getTransaction(id);
		} catch (e) {
			error = friendlyError(e, 'Could not load this entry.');
		} finally {
			loading = false;
		}
	}
	$effect(() => {
		void id;
		load();
	});

	const party = $derived(tx ? parties.byId.get(tx.partyId) : undefined);

	let confirmOpen = $state(false);
	let busy = $state(false);
	async function toggleStatus() {
		if (!tx) return;
		const next = tx.status === 'active' ? 'inactive' : 'active';
		busy = true;
		try {
			await setTransactionStatus(tx.id, next);
			tx.status = next;
			toast.success(next === 'inactive' ? 'Entry cancelled (marked inactive).' : 'Entry restored (marked active).');
			confirmOpen = false;
		} catch (e) {
			toast.error(friendlyError(e, 'Could not update the entry status.'));
		} finally {
			busy = false;
		}
	}
</script>

{#snippet item(label: string, value: string, strong = false)}
	<div>
		<dt class="text-xs text-slate-500">{label}</dt>
		<dd class="text-sm {strong ? 'font-semibold text-slate-900' : 'text-slate-800'} tabular-nums">{value}</dd>
	</div>
{/snippet}

{#if loading}
	<p class="text-sm text-slate-500">Loading entry…</p>
{:else if error}
	<PageHeader title="Entry" backHref="/received-from-party" backLabel="Received From Party" />
	<div class="card p-6 text-sm text-red-700" role="alert">
		{error} <button type="button" class="btn-link ml-2" onclick={load}>Try again</button>
	</div>
{:else if !tx}
	<PageHeader title="Entry not found" backHref="/received-from-party" backLabel="Received From Party" />
	<div class="card"><EmptyState title="This entry does not exist." /></div>
{:else}
	<PageHeader title="Way No. {tx.wayNumber}" subtitle="Received from party entry" backHref="/received-from-party" backLabel="Back to List">
		{#snippet actions()}
			<button type="button" class="btn-secondary" onclick={() => (confirmOpen = true)}>
				<Icon name="power" />{tx?.status === 'active' ? 'Cancel Entry' : 'Restore Entry'}
			</button>
			<a href="/received-from-party/{tx?.id}/edit" class="btn-primary"><Icon name="edit" />Edit</a>
		{/snippet}
	</PageHeader>

	<div class="grid grid-cols-1 gap-4 xl:grid-cols-2">
		<section class="card">
			<h2 class="border-b border-slate-100 px-5 py-3 text-sm font-semibold text-slate-800">Transaction Details</h2>
			<dl class="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
				{@render item('Date', formatDate(tx.transactionDate))}
				{@render item('Purchase Type', purchaseTypeLabel(tx.purchaseType))}
				{@render item('Way Number', tx.wayNumber, true)}
				{@render item('Item Name', tx.itemName)}
				<div class="sm:col-span-2">
					<dt class="text-xs text-slate-500">Party</dt>
					<dd class="text-sm">
						{#if party}
							<a href="/parties/{party.id}" class="font-semibold text-slate-900 hover:underline">{party.partyName}</a>
							{#if party.status === 'inactive'}<span class="ml-1"><StatusBadge status="inactive" /></span>{/if}
							<div class="text-slate-600">{party.place || '—'}</div>
							<div class="text-slate-600 tabular-nums">{party.phoneNumber || '—'}</div>
						{:else}
							<span class="text-slate-500">{parties.loading ? 'Loading…' : 'Party not found'}</span>
						{/if}
					</dd>
				</div>
			</dl>
		</section>

		<section class="card">
			<h2 class="border-b border-slate-100 px-5 py-3 text-sm font-semibold text-slate-800">Weight Details</h2>
			<dl class="grid grid-cols-2 gap-4 p-5 sm:grid-cols-3">
				{@render item('Load', formatKg(tx.load))}
				{@render item('Empty', formatKg(tx.empty))}
				{@render item('Total (Load − Empty)', formatKg(tx.total), true)}
				{@render item('Number of Bags', formatNumber(tx.bagCount))}
				{@render item('Kg', formatKg(tx.kg), true)}
			</dl>
			<p class="border-t border-slate-100 px-5 py-2.5 text-xs text-slate-500 tabular-nums">
				Kg = ({formatNumber(tx.bagCount)} × {KG_PER_BAG}) − {formatNumber(tx.total)} = {formatNumber(tx.kg)}
			</p>
		</section>

		<section class="card xl:col-span-2">
			<h2 class="border-b border-slate-100 px-5 py-3 text-sm font-semibold text-slate-800">Other Details</h2>
			<dl class="grid grid-cols-2 gap-4 p-5 md:grid-cols-4">
				{@render item('Freight Charge', formatCurrency(tx.freightCharge))}
				{@render item('Price', formatCurrency(tx.price))}
				{@render item('Amount', formatCurrency(tx.amount), true)}
				<div><dt class="text-xs text-slate-500">Status</dt><dd><StatusBadge status={tx.status} /></dd></div>
				<div class="col-span-2 md:col-span-4">
					<dt class="text-xs text-slate-500">Narration</dt>
					<dd class="text-sm whitespace-pre-wrap text-slate-800">{tx.narration || '—'}</dd>
				</div>
				{@render item('Created', formatDateTime(tx.createdAt))}
				{@render item('Last Updated', formatDateTime(tx.updatedAt))}
			</dl>
		</section>
	</div>

	<ConfirmDialog
		bind:open={confirmOpen}
		title={tx.status === 'active' ? 'Cancel this entry?' : 'Restore this entry?'}
		message={tx.status === 'active'
			? 'The entry will be marked Inactive. The record is kept and can be restored later.'
			: 'The entry will be marked Active again.'}
		confirmLabel={tx.status === 'active' ? 'Cancel Entry' : 'Restore Entry'}
		tone={tx.status === 'active' ? 'danger' : 'primary'}
		{busy}
		onconfirm={toggleStatus}
	/>
{/if}
