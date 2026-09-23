<script lang="ts">
	import type { Party, TransactionFormValues } from '$lib/types';
	import { PURCHASE_TYPE_OPTIONS, STATUS_OPTIONS } from '$lib/types';
	import { KG_PER_BAG } from '$lib/utils/calculations';
	import {
		computeWeights,
		validateTransaction,
		type FieldErrors,
		type TransactionField
	} from '$lib/utils/validation';
	import { formatKg, formatNumber } from '$lib/utils/format';
	import { friendlyError } from '$lib/utils/errors';
	import { todayISO } from '$lib/utils/dates';
	import { toast } from '$lib/stores/toast.svelte';
	import PartySelect from './PartySelect.svelte';

	let {
		initial,
		parties,
		partiesLoading = false,
		submitLabel = 'Save Entry',
		cancelHref,
		onsubmit
	}: {
		initial?: TransactionFormValues;
		parties: Party[];
		partiesLoading?: boolean;
		submitLabel?: string;
		cancelHref: string;
		onsubmit: (values: TransactionFormValues) => Promise<void>;
	} = $props();

	// svelte-ignore state_referenced_locally
	let v = $state<TransactionFormValues>(
		initial ?? {
			transactionDate: todayISO(),
			purchaseType: 'purchase',
			wayNumber: '',
			partyId: '',
			itemName: '',
			load: null,
			empty: null,
			bagCount: null,
			freightCharge: null,
			narration: '',
			price: null,
			amount: null,
			status: 'active'
		}
	);
	let submitted = $state(false);
	let busy = $state(false);

	// Live calculation — same functions used again before saving.
	const weights = $derived(computeWeights(v));
	const result = $derived(validateTransaction(v));
	const errors = $derived.by<FieldErrors<TransactionField>>(() => {
		if (submitted) return result.ok ? {} : result.errors;
		// Before first submit, surface only the weight-rule errors as the user types.
		const live: FieldErrors<TransactionField> = {};
		if (v.load != null && v.empty != null && weights.errors.empty) live.empty = weights.errors.empty;
		if (weights.errors.kg) live.kg = weights.errors.kg;
		return live;
	});

	async function submit(e: SubmitEvent) {
		e.preventDefault();
		submitted = true;
		if (!result.ok) {
			toast.error('Please correct the highlighted fields.');
			return;
		}
		busy = true;
		try {
			await onsubmit($state.snapshot(v));
		} catch (err) {
			toast.error(friendlyError(err, 'Could not save the entry. Please try again.'));
		} finally {
			busy = false;
		}
	}
</script>

{#snippet err(field: TransactionField)}
	{#if errors[field]}<p class="field-error">{errors[field]}</p>{/if}
{/snippet}

{#snippet req()}<span class="text-red-600">*</span>{/snippet}

<form class="space-y-4" onsubmit={submit} novalidate>
	<section class="card">
		<h2 class="border-b border-slate-100 px-5 py-3 text-sm font-semibold text-slate-800">Basic Details</h2>
		<div class="grid grid-cols-1 gap-4 p-5 md:grid-cols-2">
			<div>
				<label class="label" for="transactionDate">Date {@render req()}</label>
				<input id="transactionDate" type="date" class="input {errors.transactionDate ? 'input-error' : ''}" bind:value={v.transactionDate} />
				{@render err('transactionDate')}
			</div>
			<div>
				<label class="label" for="purchaseType">Type of Purchase {@render req()}</label>
				<select id="purchaseType" class="input {errors.purchaseType ? 'input-error' : ''}" bind:value={v.purchaseType}>
					{#each PURCHASE_TYPE_OPTIONS as o (o.value)}<option value={o.value}>{o.label}</option>{/each}
				</select>
				{@render err('purchaseType')}
			</div>
			<div>
				<label class="label" for="wayNumber">Way Number {@render req()}</label>
				<input id="wayNumber" class="input {errors.wayNumber ? 'input-error' : ''}" bind:value={v.wayNumber} placeholder="e.g. 37473-R" maxlength="50" autocomplete="off" />
				{@render err('wayNumber')}
			</div>
			<div>
				<label class="label" for="party">Party Name {@render req()}</label>
				<PartySelect id="party" bind:value={v.partyId} {parties} loading={partiesLoading} error={errors.partyId} />
				{@render err('partyId')}
			</div>
			<div class="md:col-span-2">
				<label class="label" for="itemName">Item Name {@render req()}</label>
				<input id="itemName" class="input {errors.itemName ? 'input-error' : ''}" bind:value={v.itemName} maxlength="120" placeholder="e.g. Paddy" />
				{@render err('itemName')}
			</div>
		</div>
	</section>

	<section class="card">
		<h2 class="border-b border-slate-100 px-5 py-3 text-sm font-semibold text-slate-800">Weight Details</h2>
		<div class="grid grid-cols-1 gap-4 p-5 md:grid-cols-2">
			<div>
				<label class="label" for="load">Load (kg) {@render req()}</label>
				<input id="load" type="number" inputmode="decimal" min="0" step="any" class="input {errors.load ? 'input-error' : ''}" bind:value={v.load} placeholder="e.g. 7500" />
				{@render err('load')}
			</div>
			<div>
				<label class="label" for="empty">Empty (kg) {@render req()}</label>
				<input id="empty" type="number" inputmode="decimal" min="0" step="any" class="input {errors.empty ? 'input-error' : ''}" bind:value={v.empty} placeholder="e.g. 2500" />
				{@render err('empty')}
			</div>
			<div>
				<label class="label" for="total">Total (kg) <span class="font-normal text-slate-400">— Load − Empty</span></label>
				<input id="total" class="input-readonly" readonly tabindex="-1" value={weights.total == null ? '' : formatNumber(weights.total)} placeholder="Auto calculated" />
			</div>
			<div>
				<label class="label" for="bagCount">Number of Bags {@render req()}</label>
				<input id="bagCount" type="number" inputmode="numeric" min="0" step="1" class="input {errors.bagCount ? 'input-error' : ''}" bind:value={v.bagCount} placeholder="e.g. 100" />
				{@render err('bagCount')}
			</div>
		</div>

		<div class="mx-5 mb-5 rounded-md border px-4 py-3 {errors.kg ? 'border-red-200 bg-red-50' : 'border-slate-200 bg-slate-50'}" aria-live="polite">
			<div class="grid grid-cols-3 gap-3 text-center">
				<div>
					<div class="text-xs text-slate-500">Total Weight</div>
					<div class="font-semibold tabular-nums">{formatKg(weights.total)}</div>
				</div>
				<div>
					<div class="text-xs text-slate-500">Bags</div>
					<div class="font-semibold tabular-nums">{formatNumber(v.bagCount)}</div>
				</div>
				<div>
					<div class="text-xs text-slate-500">Calculated Kg</div>
					<div class="font-semibold tabular-nums {errors.kg ? 'text-red-700' : 'text-emerald-800'}">{formatKg(weights.kg)}</div>
				</div>
			</div>
			<p class="mt-2 text-center text-xs text-slate-500 tabular-nums">
				Kg = (Bags × {KG_PER_BAG}) − Total
				{#if weights.kg != null}
					= ({formatNumber(v.bagCount)} × {KG_PER_BAG}) − {formatNumber(weights.total)} = {formatNumber(weights.kg)}
				{/if}
			</p>
			{#if errors.kg}<p class="mt-1 text-center text-xs font-medium text-red-700">{errors.kg}</p>{/if}
		</div>
	</section>

	<section class="card">
		<h2 class="border-b border-slate-100 px-5 py-3 text-sm font-semibold text-slate-800">Other Details</h2>
		<div class="grid grid-cols-1 gap-4 p-5 md:grid-cols-2">
			<div>
				<label class="label" for="freightCharge">Freight Charge (₹)</label>
				<input id="freightCharge" type="number" inputmode="decimal" min="0" step="0.01" class="input {errors.freightCharge ? 'input-error' : ''}" bind:value={v.freightCharge} placeholder="0.00" />
				{@render err('freightCharge')}
			</div>
			<div>
				<label class="label" for="price">Price (₹)</label>
				<input id="price" type="number" inputmode="decimal" min="0" step="0.01" class="input {errors.price ? 'input-error' : ''}" bind:value={v.price} placeholder="0.00" />
				{@render err('price')}
			</div>
			<div>
				<label class="label" for="amount">Amount (₹)</label>
				<input id="amount" type="number" inputmode="decimal" min="0" step="0.01" class="input {errors.amount ? 'input-error' : ''}" bind:value={v.amount} placeholder="0.00" />
				{@render err('amount')}
			</div>
			<div>
				<label class="label" for="status">Status {@render req()}</label>
				<select id="status" class="input" bind:value={v.status}>
					{#each STATUS_OPTIONS as o (o.value)}<option value={o.value}>{o.label}</option>{/each}
				</select>
				{@render err('status')}
			</div>
			<div class="md:col-span-2">
				<label class="label" for="narration">Narration</label>
				<textarea id="narration" rows="3" class="input {errors.narration ? 'input-error' : ''}" bind:value={v.narration} maxlength="1000"></textarea>
				{@render err('narration')}
			</div>
		</div>
	</section>

	<div class="flex justify-end gap-2">
		<a href={cancelHref} class="btn-secondary">Cancel</a>
		<button type="submit" class="btn-primary" disabled={busy}>{busy ? 'Saving…' : submitLabel}</button>
	</div>
</form>
