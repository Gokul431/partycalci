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
	import { formatCurrency, formatKg, formatNumber, formatWayNumber, purchaseTypeLabel } from '$lib/utils/format';
	import { KG_PER_BAG, calculateTotalAmount } from '$lib/utils/calculations';
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
		<dt class="text-xs font-medium tracking-wide text-slate-500 uppercase">{label}</dt>
		<dd class="mt-1 text-sm {strong ? 'font-semibold text-slate-900' : 'text-slate-800'} tabular-nums">{value}</dd>
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
	<PageHeader
		title="Way No. {formatWayNumber(tx.wayNumber, tx.purchaseType)}"
		subtitle="{purchaseTypeLabel(tx.purchaseType)} · {formatDate(tx.transactionDate)} · {party?.partyName ?? 'Unknown party'}"
		backHref="/received-from-party"
		backLabel="Back to List"
	>
		{#snippet badge()}<StatusBadge status={tx?.status ?? 'active'} />{/snippet}
		{#snippet actions()}
			<button type="button" class="btn-secondary" onclick={() => (confirmOpen = true)}>
				<Icon name="power" />{tx?.status === 'active' ? 'Cancel Entry' : 'Restore Entry'}
			</button>
			<a href="/received-from-party/{tx?.id}/edit" class="btn-primary"><Icon name="edit" />Edit</a>
		{/snippet}
	</PageHeader>

	<div class="card mb-4 grid grid-cols-2 divide-slate-200 lg:grid-cols-4 lg:divide-x">
		{#each [{ label: 'Total Weight', value: formatKg(tx.total) }, { label: 'Number of Bags', value: formatNumber(tx.bagCount) }, { label: 'Loose Kg', value: formatKg(tx.kg) }, { label: 'Total Amount', value: formatCurrency(calculateTotalAmount(tx.amount, tx.freightCharge)) }] as s (s.label)}
			<div class="px-5 py-4">
				<div class="text-xs font-semibold tracking-wide text-slate-500 uppercase">{s.label}</div>
				<div class="mt-1 text-xl font-bold text-slate-900">{s.value}</div>
			</div>
		{/each}
	</div>

	<div class="grid grid-cols-1 gap-4 xl:grid-cols-2">
		<section class="card">
			<h2 class="border-b border-slate-100 px-5 py-3 text-sm font-semibold text-slate-800">Transaction Details</h2>
			<dl class="grid grid-cols-1 gap-x-6 gap-y-5 p-5 sm:grid-cols-2">
				{@render item('Date', formatDate(tx.transactionDate))}
				{@render item('Purchase Type', purchaseTypeLabel(tx.purchaseType))}
				{@render item('Way Number', formatWayNumber(tx.wayNumber, tx.purchaseType), true)}
				{@render item('Item Name', tx.itemName)}
				<div class="sm:col-span-2">
					<dt class="text-xs font-medium tracking-wide text-slate-500 uppercase">Party</dt>
					<dd class="mt-1 text-sm">
						{#if party}
							<a href="/parties/{party.id}" class="font-medium text-emerald-700 hover:underline">{party.partyName}</a>
							{#if party.status === 'inactive'}<span class="ml-1.5"><StatusBadge status="inactive" /></span>{/if}
							<div class="mt-0.5 text-slate-600">{party.place || '—'}</div>
							<div class="text-slate-600 tabular-nums">{party.phoneNumber || '—'}</div>
						{:else}
							<span class="text-slate-500">{parties.loading ? 'Loading…' : 'Party not found'}</span>
						{/if}
					</dd>
				</div>
			</dl>
		</section>

		<section class="card">
			<h2 class="flex items-center justify-between border-b border-slate-100 px-5 py-3 text-sm font-semibold text-slate-800">
				Weight Details
				{#if !tx.autoCalculate}
					<span class="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-amber-800 uppercase" title="Total and Bags were typed in, not calculated">Manual entry</span>
				{/if}
			</h2>
			<dl class="grid grid-cols-2 gap-x-6 gap-y-5 p-5 sm:grid-cols-3">
				{@render item('Load', formatKg(tx.load))}
				{@render item('Empty', formatKg(tx.empty))}
				{@render item(tx.autoCalculate ? 'Total (Load − Empty)' : 'Total (entered)', formatKg(tx.total), true)}
				{@render item('Number of Bags', formatNumber(tx.bagCount))}
				{@render item('Loose Kg', formatKg(tx.kg), true)}
			</dl>
			<p class="border-t border-slate-100 px-5 py-2.5 text-xs text-slate-500 tabular-nums">
				{formatNumber(tx.total)} kg = {formatNumber(tx.bagCount)} bag{tx.bagCount === 1 ? '' : 's'}
				× {KG_PER_BAG} + {formatNumber(tx.kg)} kg
			</p>
		</section>

		<section class="card xl:col-span-2">
			<h2 class="border-b border-slate-100 px-5 py-3 text-sm font-semibold text-slate-800">Other Details</h2>
			<dl class="grid grid-cols-2 gap-x-6 gap-y-5 p-5 md:grid-cols-4">
				{@render item('Price per Bag', formatCurrency(tx.price))}
				{@render item('Item Amount', formatCurrency(tx.amount))}
				{@render item('Freight Charge', `− ${formatCurrency(tx.freightCharge)}`)}
				{@render item('Total Amount', formatCurrency(calculateTotalAmount(tx.amount, tx.freightCharge)), true)}
				<div>
					<dt class="text-xs font-medium tracking-wide text-slate-500 uppercase">Status</dt>
					<dd class="mt-1"><StatusBadge status={tx.status} /></dd>
				</div>
				<div class="col-span-2 md:col-span-4">
					<dt class="text-xs font-medium tracking-wide text-slate-500 uppercase">Narration</dt>
					<dd class="mt-1 text-sm whitespace-pre-wrap text-slate-800">{tx.narration || '—'}</dd>
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
