<script lang="ts">
	import Icon from './Icon.svelte';
	import { changePassword, requestEmailChange } from '$lib/firebase/auth';
	import { session } from '$lib/stores/session.svelte';
	import { toast } from '$lib/stores/toast.svelte';
	import { friendlyError } from '$lib/utils/errors';

	let { open = $bindable(false) }: { open?: boolean } = $props();

	/** Firebase's own floor. Anything shorter is rejected server-side as a weak password. */
	const MIN_PASSWORD = 6;

	const currentEmail = $derived(session.user?.email ?? '');

	let currentPassword = $state('');
	let newEmail = $state('');
	let newPassword = $state('');
	let confirmPassword = $state('');
	let showPasswords = $state(false);
	let busy = $state(false);
	let error = $state('');
	let dialog: HTMLDialogElement;

	const wantsEmail = $derived(newEmail.trim() !== '' && newEmail.trim() !== currentEmail);
	const wantsPassword = $derived(newPassword !== '');

	function reset() {
		currentPassword = '';
		newEmail = '';
		newPassword = '';
		confirmPassword = '';
		showPasswords = false;
		error = '';
	}

	$effect(() => {
		if (open && !dialog.open) {
			reset();
			dialog.showModal();
		} else if (!open && dialog.open) {
			dialog.close();
		}
	});

	/** Returns the first problem with the form, or '' when it is ready to submit. */
	function validate(): string {
		if (!currentPassword) return 'Enter your current password to confirm the change.';
		if (!wantsEmail && !wantsPassword) return 'Enter a new email address or a new password.';
		if (wantsPassword) {
			if (newPassword.length < MIN_PASSWORD)
				return `Choose a password of at least ${MIN_PASSWORD} characters.`;
			if (newPassword === currentPassword)
				return 'The new password is the same as your current one.';
			if (newPassword !== confirmPassword) return 'The two new passwords do not match.';
		}
		return '';
	}

	async function submit(e: SubmitEvent) {
		e.preventDefault();
		error = validate();
		if (error) return;
		busy = true;
		try {
			// Password first: once the email change is pending, a second reauthentication
			// in the same session is more likely to be rejected.
			if (wantsPassword) await changePassword(currentPassword, newPassword);
			if (wantsEmail) await requestEmailChange(currentPassword, newEmail);

			if (wantsPassword && wantsEmail) {
				toast.success(`Password updated. Confirm the link sent to ${newEmail.trim()} to finish the email change.`);
			} else if (wantsPassword) {
				toast.success('Password updated.');
			} else {
				toast.success(`Confirmation link sent to ${newEmail.trim()}. Open it to finish the change.`);
			}
			open = false;
		} catch (err) {
			error = friendlyError(err, 'Could not update your account. Please try again.');
		} finally {
			busy = false;
		}
	}
</script>

<dialog
	bind:this={dialog}
	class="m-auto w-[calc(100%-2rem)] max-w-md rounded-lg border border-slate-200 bg-white p-0 shadow-xl backdrop:bg-slate-900/40"
	onclose={() => (open = false)}
	oncancel={(e) => busy && e.preventDefault()}
	aria-labelledby="account-title"
>
	<form onsubmit={submit} novalidate>
		<div class="border-b border-slate-100 px-5 py-3">
			<h2 id="account-title" class="text-base font-semibold text-slate-900">Account</h2>
			<p class="mt-0.5 text-sm text-slate-500">Signed in as {currentEmail}</p>
		</div>

		<div class="space-y-4 p-5">
			<div>
				<label class="label" for="currentPassword">Current password <span class="text-red-600">*</span></label>
				<div class="relative">
					<input
						id="currentPassword"
						type={showPasswords ? 'text' : 'password'}
						class="input pr-10"
						bind:value={currentPassword}
						autocomplete="current-password"
					/>
					<button
						type="button"
						class="absolute inset-y-0 right-0 grid w-10 place-items-center rounded-r-md text-slate-400 transition-colors hover:text-slate-700"
						onclick={() => (showPasswords = !showPasswords)}
						aria-label={showPasswords ? 'Hide passwords' : 'Show passwords'}
						aria-pressed={showPasswords}
					>
						<Icon name={showPasswords ? 'eye' : 'eyeOff'} class="h-4 w-4" />
					</button>
				</div>
				<p class="mt-1 text-xs text-slate-500">Required to confirm it is really you.</p>
			</div>

			<div class="border-t border-slate-100 pt-4">
				<label class="label" for="newEmail">New email address</label>
				<input
					id="newEmail"
					type="email"
					class="input"
					bind:value={newEmail}
					placeholder={currentEmail}
					autocomplete="email"
				/>
				<p class="mt-1 text-xs text-slate-500">
					Leave blank to keep it. A confirmation link is sent to the new address — the change
					only takes effect once you open it, so your current address keeps working until then.
				</p>
			</div>

			<div class="border-t border-slate-100 pt-4">
				<label class="label" for="newPassword">New password</label>
				<input
					id="newPassword"
					type={showPasswords ? 'text' : 'password'}
					class="input"
					bind:value={newPassword}
					autocomplete="new-password"
					placeholder="At least {MIN_PASSWORD} characters"
				/>
			</div>

			<div>
				<label class="label" for="confirmPassword">Confirm new password</label>
				<input
					id="confirmPassword"
					type={showPasswords ? 'text' : 'password'}
					class="input"
					bind:value={confirmPassword}
					autocomplete="new-password"
				/>
				<p class="mt-1 text-xs text-slate-500">Leave both blank to keep your current password.</p>
			</div>

			{#if error}
				<p class="flex items-start gap-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
					<Icon name="alert" class="mt-0.5 h-4 w-4 shrink-0" />{error}
				</p>
			{/if}
		</div>

		<div class="flex justify-end gap-2 border-t border-slate-100 bg-slate-50 px-5 py-3">
			<button type="button" class="btn-secondary" disabled={busy} onclick={() => (open = false)}>Cancel</button>
			<button type="submit" class="btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save Changes'}</button>
		</div>
	</form>
</dialog>
