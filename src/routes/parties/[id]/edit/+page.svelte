<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import PartyForm from '$lib/components/PartyForm.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import { parties } from '$lib/stores/parties.svelte';
	import { updateParty } from '$lib/firebase/firestore';
	import { toast } from '$lib/stores/toast.svelte';
	import type { PartyInput } from '$lib/types';

	const id = $derived(page.params.id ?? '');
	const party = $derived(parties.byId.get(id) ?? null);

	async function save(input: PartyInput) {
		await updateParty(id, input);
		toast.success('Party updated successfully.');
		await goto(`/parties/${id}`);
	}
</script>

<PageHeader title="Edit Party" backHref="/parties/{id}" backLabel="Party details" />
{#if parties.loading}
	<p class="text-sm text-slate-500">Loading party…</p>
{:else if parties.error}
	<p class="text-sm text-red-600">{parties.error}</p>
{:else if !party}
	<div class="card"><EmptyState title="This party does not exist." icon="users"><a href="/parties" class="btn-secondary">Back to Parties</a></EmptyState></div>
{:else}
	{#key party.id}
		<PartyForm
			initial={{
				partyName: party.partyName,
				place: party.place,
				phoneNumber: party.phoneNumber,
				partyType: party.partyType,
				accountName: party.accountName ?? '',
				accountNo: party.accountNo ?? '',
				ifscCode: party.ifscCode ?? '',
				bankName: party.bankName ?? '',
				status: party.status
			}}
			submitLabel="Save Changes"
			cancelHref="/parties/{party.id}"
			onsubmit={save}
		/>
	{/key}
{/if}
