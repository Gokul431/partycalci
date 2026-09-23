<script lang="ts">
	import { login } from '$lib/firebase/auth';
	import { friendlyError } from '$lib/utils/errors';

	let email = $state('');
	let password = $state('');
	let busy = $state(false);
	let error = $state('');

	async function submit(e: SubmitEvent) {
		e.preventDefault();
		error = '';
		if (!email.trim() || !password) {
			error = 'Enter your email and password.';
			return;
		}
		busy = true;
		try {
			await login(email, password);
			// The layout's route guard redirects once the session updates.
		} catch (err) {
			error = friendlyError(err, 'Could not sign in. Please try again.');
			busy = false;
		}
	}
</script>

<svelte:head><title>Sign in · Party Calci</title></svelte:head>

<div class="flex min-h-screen items-center justify-center bg-slate-100 px-4">
	<div class="w-full max-w-sm">
		<div class="mb-6 flex flex-col items-center text-center">
			<img src="/favicon.svg" alt="" class="mb-3 h-10 w-10" />
			<h1 class="text-lg font-semibold text-slate-900">Party Calci</h1>
			<p class="text-sm text-slate-500">Rice Mill Material Register</p>
		</div>
		<form class="card space-y-4 p-6" onsubmit={submit} novalidate>
			<div>
				<label class="label" for="email">Email</label>
				<input id="email" type="email" class="input" bind:value={email} autocomplete="username" required />
			</div>
			<div>
				<label class="label" for="password">Password</label>
				<input id="password" type="password" class="input" bind:value={password} autocomplete="current-password" required />
			</div>
			{#if error}
				<p class="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{error}</p>
			{/if}
			<button type="submit" class="btn-primary w-full" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
		</form>
		<p class="mt-4 text-center text-xs text-slate-500">Accounts are created by the administrator in Firebase Console.</p>
	</div>
</div>
