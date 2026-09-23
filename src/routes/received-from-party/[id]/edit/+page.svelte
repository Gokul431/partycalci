<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import TransactionForm from '$lib/components/TransactionForm.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import { getTransaction, updateTransaction } from '$lib/firebase/firestore';
	import { parties } from '$lib/stores/parties.svelte';
	import { toast } from '$lib/stores/toast.svelte';
	import { friendlyError } from '$lib/utils/errors';
	import { toISODate } from '$lib/utils/dates';
	import type { Transaction, TransactionFormValues } from '$lib/types';

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

	// Active parties, plus the entry's current party even if it has since been deactivated.
	const options = $derived.by(() => {
		const current = tx ? parties.byId.get(tx.partyId) : undefined;
		return current && current.status !== 'active' ? [current, ...parties.active] : parties.active;
	});

	function toForm(t: Transaction): TransactionFormValues {
		return {
			transactionDate: toISODate(t.transactionDate),
			purchaseType: t.purchaseType,
			wayNumber: t.wayNumber,
			partyId: t.partyId,
			itemName: t.itemName,
			load: t.load,
			empty: t.empty,
			bagCount: t.bagCount,
			freightCharge: t.freightCharge,
			narration: t.narration,
			price: t.price,
			amount: t.amount,
			status: t.status
		};
	}

	async function save(values: TransactionFormValues) {
		if (!tx) return;
		await updateTransaction(tx.id, values, tx.partyId);
		toast.success('Received from party entry updated successfully.');
		await goto(`/received-from-party/${tx.id}`);
	}
</script>

<PageHeader title="Edit Received From Party" backHref="/received-from-party/{id}" backLabel="Entry details" />

{#if loading || parties.loading}
	<p class="text-sm text-slate-500">Loading entry…</p>
{:else if error}
	<div class="card p-6 text-sm text-red-700" role="alert">
		{error} <button type="button" class="btn-link ml-2" onclick={load}>Try again</button>
	</div>
{:else if !tx}
	<div class="card"><EmptyState title="This entry does not exist." /></div>
{:else}
	{#key tx.id}
		<TransactionForm initial={toForm(tx)} parties={options} submitLabel="Save Changes" cancelHref="/received-from-party/{tx.id}" onsubmit={save} />
	{/key}
{/if}
