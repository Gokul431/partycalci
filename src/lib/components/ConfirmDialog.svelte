<script lang="ts">
	let {
		open = $bindable(false),
		title,
		message,
		confirmLabel = 'Confirm',
		tone = 'primary',
		busy = false,
		onconfirm
	}: {
		open?: boolean;
		title: string;
		message: string;
		confirmLabel?: string;
		tone?: 'primary' | 'danger';
		busy?: boolean;
		onconfirm: () => void | Promise<void>;
	} = $props();

	let dialog: HTMLDialogElement;

	$effect(() => {
		if (open && !dialog.open) dialog.showModal();
		else if (!open && dialog.open) dialog.close();
	});
</script>

<dialog
	bind:this={dialog}
	class="m-auto w-[calc(100%-2rem)] max-w-md rounded-lg border border-slate-200 bg-white p-0 shadow-xl backdrop:bg-slate-900/40"
	onclose={() => (open = false)}
	oncancel={(e) => busy && e.preventDefault()}
	aria-labelledby="confirm-title"
>
	<div class="p-5">
		<h2 id="confirm-title" class="text-base font-semibold text-slate-900">{title}</h2>
		<p class="mt-2 text-sm text-slate-600">{message}</p>
	</div>
	<div class="flex justify-end gap-2 border-t border-slate-100 bg-slate-50 px-5 py-3">
		<button type="button" class="btn-secondary" disabled={busy} onclick={() => (open = false)}>Cancel</button>
		<button type="button" class={tone === 'danger' ? 'btn-danger' : 'btn-primary'} disabled={busy} onclick={onconfirm}>
			{busy ? 'Please wait…' : confirmLabel}
		</button>
	</div>
</dialog>
