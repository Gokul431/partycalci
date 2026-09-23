<script lang="ts">
	import { goto } from '$app/navigation';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import TransactionForm from '$lib/components/TransactionForm.svelte';
	import { createTransaction } from '$lib/firebase/firestore';
	import { parties } from '$lib/stores/parties.svelte';
	import { toast } from '$lib/stores/toast.svelte';
	import type { TransactionFormValues } from '$lib/types';

	async function save(values: TransactionFormValues) {
		await createTransaction(values);
		toast.success('Received from party entry created successfully.');
		await goto('/received-from-party');
	}
</script>

<PageHeader title="New Received From Party" backHref="/received-from-party" backLabel="Received From Party" />

{#if parties.error}
	<p class="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{parties.error}</p>
{/if}

<!-- Only Active parties are selectable for new entries. -->
<TransactionForm parties={parties.active} partiesLoading={parties.loading} cancelHref="/received-from-party" onsubmit={save} />
