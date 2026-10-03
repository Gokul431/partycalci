<script lang="ts">
	import type { PartyInput } from '$lib/types';
	import { PARTY_TYPE_OPTIONS, STATUS_OPTIONS } from '$lib/types';
	import { validateParty, type FieldErrors, type PartyField } from '$lib/utils/validation';
	import { friendlyError } from '$lib/utils/errors';
	import { toast } from '$lib/stores/toast.svelte';

	let {
		initial,
		submitLabel = 'Save Party',
		cancelHref,
		onsubmit
	}: {
		initial?: PartyInput;
		submitLabel?: string;
		cancelHref: string;
		onsubmit: (input: PartyInput) => Promise<void>;
	} = $props();

	// svelte-ignore state_referenced_locally
	let values = $state<PartyInput>({
		partyName: '',
		place: '',
		phoneNumber: '',
		partyType: 'wholesale',
		accountName: '',
		accountNo: '',
		ifscCode: '',
		bankName: '',
		status: 'active',
		...initial
	});
	let submitted = $state(false);
	let busy = $state(false);

	const result = $derived(validateParty(values));
	const errors = $derived<FieldErrors<PartyField>>(submitted && !result.ok ? result.errors : {});

	async function submit(e: SubmitEvent) {
		e.preventDefault();
		submitted = true;
		if (!result.ok) return;
		busy = true;
		try {
			await onsubmit(result.data);
		} catch (err) {
			toast.error(friendlyError(err, 'Could not save the party. Please try again.'));
		} finally {
			busy = false;
		}
	}
</script>

<form class="card" onsubmit={submit} novalidate>
	<header class="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-3">
		<h2 class="text-sm font-semibold text-slate-800">Party Information</h2>
		<p class="text-xs text-slate-500"><span class="text-red-600">*</span> Required fields</p>
	</header>

	<div class="grid grid-cols-1 gap-x-6 gap-y-5 p-5 sm:grid-cols-2 lg:grid-cols-3">
		<div>
			<label class="label" for="partyName">Party Name <span class="text-red-600">*</span></label>
			<input id="partyName" class="input {errors.partyName ? 'input-error' : ''}" bind:value={values.partyName} maxlength="120" autocomplete="off" aria-invalid={!!errors.partyName} />
			{#if errors.partyName}<p class="field-error">{errors.partyName}</p>{/if}
		</div>
		<div>
			<label class="label" for="place">Place</label>
			<input id="place" class="input {errors.place ? 'input-error' : ''}" bind:value={values.place} maxlength="120" placeholder="Village or town" />
			{#if errors.place}<p class="field-error">{errors.place}</p>{/if}
		</div>
		<div>
			<label class="label" for="phoneNumber">Phone Number</label>
			<input id="phoneNumber" type="tel" inputmode="tel" class="input {errors.phoneNumber ? 'input-error' : ''}" bind:value={values.phoneNumber} maxlength="20" placeholder="e.g. 9626540553" aria-invalid={!!errors.phoneNumber} />
			{#if errors.phoneNumber}<p class="field-error">{errors.phoneNumber}</p>{/if}
		</div>
		<div>
			<label class="label" for="partyType">Party Type <span class="text-red-600">*</span></label>
			<select id="partyType" class="select {errors.partyType ? 'input-error' : ''}" bind:value={values.partyType}>
				{#each PARTY_TYPE_OPTIONS as o (o.value)}<option value={o.value}>{o.label}</option>{/each}
			</select>
			{#if errors.partyType}<p class="field-error">{errors.partyType}</p>{/if}
			<p class="mt-1 text-xs text-slate-500">
				Wholesale is billed for full bags only. A farmer is also paid for the loose Kg.
			</p>
		</div>
		<div>
			<label class="label" for="status">Status <span class="text-red-600">*</span></label>
			<select id="status" class="select" bind:value={values.status}>
				{#each STATUS_OPTIONS as o (o.value)}<option value={o.value}>{o.label}</option>{/each}
			</select>
			{#if errors.status}<p class="field-error">{errors.status}</p>{/if}
			<p class="mt-1 text-xs text-slate-500">Only active parties can be chosen for new entries.</p>
		</div>
	</div>

	<header class="flex flex-wrap items-center justify-between gap-2 border-t border-b border-slate-100 px-5 py-3">
		<h2 class="text-sm font-semibold text-slate-800">Bank Details</h2>
		<p class="text-xs text-slate-500">Optional bank information</p>
	</header>

	<div class="grid grid-cols-1 gap-x-6 gap-y-5 p-5 sm:grid-cols-2 lg:grid-cols-4">
		<div>
			<label class="label" for="accountName">Account Name</label>
			<input id="accountName" class="input {errors.accountName ? 'input-error' : ''}" bind:value={values.accountName} maxlength="120" placeholder="e.g. Prasanna Venkatesh" />
			{#if errors.accountName}<p class="field-error">{errors.accountName}</p>{/if}
		</div>
		<div>
			<label class="label" for="accountNo">Account NO</label>
			<input id="accountNo" class="input {errors.accountNo ? 'input-error' : ''}" bind:value={values.accountNo} maxlength="50" placeholder="e.g. 123456789012" />
			{#if errors.accountNo}<p class="field-error">{errors.accountNo}</p>{/if}
		</div>
		<div>
			<label class="label" for="ifscCode">IFSC code</label>
			<input id="ifscCode" class="input uppercase {errors.ifscCode ? 'input-error' : ''}" bind:value={values.ifscCode} maxlength="20" placeholder="e.g. SBIN0001234" />
			{#if errors.ifscCode}<p class="field-error">{errors.ifscCode}</p>{/if}
		</div>
		<div>
			<label class="label" for="bankName">Bank Name</label>
			<input id="bankName" class="input {errors.bankName ? 'input-error' : ''}" bind:value={values.bankName} maxlength="120" placeholder="e.g. State Bank of India" />
			{#if errors.bankName}<p class="field-error">{errors.bankName}</p>{/if}
		</div>
	</div>

	<div class="flex justify-end gap-2 border-t border-slate-100 bg-slate-50 px-5 py-3">
		<a href={cancelHref} class="btn-secondary">Cancel</a>
		<button type="submit" class="btn-primary" disabled={busy}>{busy ? 'Saving…' : submitLabel}</button>
	</div>
</form>
