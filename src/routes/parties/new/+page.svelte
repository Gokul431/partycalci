<script lang="ts">
	import { goto } from '$app/navigation';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import PartyForm from '$lib/components/PartyForm.svelte';
	import { createParty } from '$lib/firebase/firestore';
	import { toast } from '$lib/stores/toast.svelte';
	import type { PartyInput } from '$lib/types';

	async function save(input: PartyInput) {
		await createParty(input);
		toast.success('Party created successfully.');
		await goto('/parties');
	}
</script>

<PageHeader title="Add Party" subtitle="Add a new party to the master list" backHref="/parties" backLabel="Parties" />
<PartyForm cancelHref="/parties" onsubmit={save} />
