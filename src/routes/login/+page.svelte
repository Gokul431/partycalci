<script lang="ts">
	import Icon from '$lib/components/Icon.svelte';
	import { login } from '$lib/firebase/auth';
	import { friendlyError } from '$lib/utils/errors';

	let email = $state('');
	let password = $state('');
	let showPassword = $state(false);
	let busy = $state(false);
	let error = $state('');

	const HIGHLIGHTS = [
		'Party master with instant name and phone search',
		'Bags and loose Kg worked out from every weighment',
		'Voucher listings exported to PDF for any period'
	];

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

<svelte:head><title>Sign in · MillBooks</title></svelte:head>

<div class="grid min-h-screen lg:grid-cols-2">
	<!-- Brand panel: the marketing half, hidden on phones where the form needs the room. -->
	<div class="relative hidden flex-col justify-between overflow-hidden bg-slate-900 p-10 lg:flex xl:p-14">
		<div
			class="pointer-events-none absolute -top-24 -right-24 h-96 w-96 rounded-full bg-emerald-600/20 blur-3xl"
			aria-hidden="true"
		></div>

		<div class="relative flex items-center gap-3">
			<span class="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white">
				<img src="/favicon.svg" alt="" class="h-7 w-7" />
			</span>
			<span class="leading-tight">
				<span class="block text-base font-semibold text-white">MillBooks</span>
				<span class="block text-xs tracking-widest text-slate-400 uppercase">Rice Mill Register</span>
			</span>
		</div>

		<div class="relative max-w-md">
			<h2 class="text-3xl font-bold tracking-tight text-white xl:text-4xl">
				Every load weighed, recorded and accounted for.
			</h2>
			<p class="mt-4 text-sm leading-relaxed text-slate-400">
				Keep the party register and every received-from-party voucher in one place, with the
				weights worked out the same way each time.
			</p>
			<ul class="mt-8 space-y-3">
				{#each HIGHLIGHTS as point (point)}
					<li class="flex items-start gap-3 text-sm text-slate-300">
						<span class="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-emerald-600/20">
							<Icon name="check" class="h-3 w-3 text-emerald-400" />
						</span>
						{point}
					</li>
				{/each}
			</ul>
		</div>

		<p class="relative text-xs text-slate-500">Elumalayan Modern Rice Mill</p>
	</div>

	<!-- Form panel -->
	<div class="flex items-center justify-center bg-white px-4 py-10 sm:px-8">
		<div class="w-full max-w-sm">
			<div class="mb-8 flex flex-col items-center text-center lg:hidden">
				<span class="mb-3 grid h-12 w-12 place-items-center rounded-xl bg-slate-900">
					<img src="/favicon.svg" alt="" class="h-7 w-7" />
				</span>
				<h1 class="text-lg font-semibold text-slate-900">MillBooks</h1>
				<p class="text-sm text-slate-500">Rice Mill Material Register</p>
			</div>

			<div class="mb-6">
				<h1 class="text-2xl font-bold tracking-tight text-slate-900">Sign in</h1>
				<p class="mt-1 text-sm text-slate-500">Use the account your administrator set up for you.</p>
			</div>

			<form class="space-y-4" onsubmit={submit} novalidate>
				<div>
					<label class="label" for="email">Email</label>
					<input
						id="email"
						type="email"
						class="input"
						bind:value={email}
						autocomplete="username"
						placeholder="you@example.com"
						required
					/>
				</div>

				<div>
					<label class="label" for="password">Password</label>
					<div class="relative">
						<input
							id="password"
							type={showPassword ? 'text' : 'password'}
							class="input pr-10"
							bind:value={password}
							autocomplete="current-password"
							required
						/>
						<button
							type="button"
							class="absolute inset-y-0 right-0 grid w-10 place-items-center rounded-r-md text-slate-400 transition-colors hover:text-slate-700 focus-visible:ring-2 focus-visible:ring-emerald-600/40 focus-visible:outline-none"
							onclick={() => (showPassword = !showPassword)}
							aria-label={showPassword ? 'Hide password' : 'Show password'}
							aria-pressed={showPassword}
							title={showPassword ? 'Hide password' : 'Show password'}
						>
							<!-- Icon reflects the current state: open eye while the password is visible. -->
							<Icon name={showPassword ? 'eye' : 'eyeOff'} class="h-4 w-4" />
						</button>
					</div>
				</div>

				{#if error}
					<p class="flex items-start gap-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
						<Icon name="alert" class="mt-0.5 h-4 w-4 shrink-0" />{error}
					</p>
				{/if}

				<button type="submit" class="btn-primary w-full py-2.5" disabled={busy}>
					{busy ? 'Signing in…' : 'Sign in'}
				</button>
			</form>

			<p class="mt-8 border-t border-slate-100 pt-4 text-center text-xs text-slate-500">
				Accounts are created by the administrator in Firebase Console.
			</p>
		</div>
	</div>
</div>
