<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { logout } from '$lib/firebase/auth';
	import { session } from '$lib/stores/session.svelte';
	import { toast } from '$lib/stores/toast.svelte';
	import { friendlyError } from '$lib/utils/errors';
	import AccountDialog from './AccountDialog.svelte';
	import ConfirmDialog from './ConfirmDialog.svelte';
	import Icon, { type IconName } from './Icon.svelte';

	let {
		open = false,
		collapsed = false,
		onclose,
		ontoggle
	}: { open?: boolean; collapsed?: boolean; onclose: () => void; ontoggle: () => void } = $props();

	const NAV: { href: string; label: string; icon: IconName }[] = [
		{ href: '/', label: 'Dashboard', icon: 'dashboard' },
		{ href: '/parties', label: 'Parties', icon: 'users' },
		{ href: '/received-from-party', label: 'Received From Party', icon: 'truck' }
	];

	const isActive = (href: string) =>
		href === '/' ? page.url.pathname === '/' : page.url.pathname.startsWith(href);

	const email = $derived(session.user?.email ?? '');
	const initial = $derived((email[0] ?? '?').toUpperCase());

	let busy = $state(false);
	let confirmOpen = $state(false);
	let accountOpen = $state(false);

	async function signOut() {
		busy = true;
		try {
			await logout();
			confirmOpen = false;
			onclose();
			await goto('/login');
		} catch (e) {
			toast.error(friendlyError(e, 'Could not sign out.'));
		} finally {
			busy = false;
		}
	}
</script>

{#if open}
	<button type="button" class="fixed inset-0 z-30 bg-slate-900/50 lg:hidden" aria-label="Close menu" onclick={onclose}></button>
{/if}

<aside
	class="fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-slate-900 transition-[transform,width] duration-200 lg:translate-x-0 {open
		? 'translate-x-0'
		: '-translate-x-full'} {collapsed ? 'lg:w-16' : 'lg:w-64'}"
>
	<div class="flex h-16 items-center gap-2.5 px-4 {collapsed ? 'lg:justify-center lg:px-0' : ''}">
		<a href="/" class="flex min-w-0 items-center gap-2.5" onclick={onclose}>
			<span class="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white">
				<img src="/favicon.svg" alt="" class="h-6 w-6" />
			</span>
			<span class="min-w-0 leading-tight {collapsed ? 'lg:hidden' : ''}">
				<span class="block truncate text-sm font-semibold text-white">MillBooks</span>
				<span class="block truncate text-[11px] tracking-wide text-slate-400 uppercase">Rice Mill Register</span>
			</span>
		</a>
		<button
			type="button"
			class="ml-auto rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-white lg:hidden"
			onclick={onclose}
			aria-label="Close menu"
		>
			<Icon name="x" class="h-5 w-5" />
		</button>
	</div>

	<div class="px-4 pt-3 pb-1 text-[11px] font-semibold tracking-widest text-slate-500 uppercase {collapsed ? 'lg:hidden' : ''}">
		Workspace
	</div>

	<nav class="flex-1 space-y-1 px-3 py-1 {collapsed ? 'lg:px-2' : ''}" aria-label="Main">
		{#each NAV as item (item.href)}
			{@const active = isActive(item.href)}
			<a
				href={item.href}
				onclick={onclose}
				aria-current={active ? 'page' : undefined}
				title={collapsed ? item.label : undefined}
				class="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors {collapsed
					? 'lg:justify-center lg:px-0'
					: ''} {active ? 'bg-emerald-600 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}"
			>
				<Icon name={item.icon} class="h-[18px] w-[18px] shrink-0" />
				<span class="truncate {collapsed ? 'lg:hidden' : ''}">{item.label}</span>
			</a>
		{/each}
	</nav>

	<button
		type="button"
		class="mx-3 mb-2 hidden items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-400 transition-colors hover:bg-slate-800 hover:text-white lg:flex {collapsed
			? 'lg:justify-center lg:px-0'
			: ''}"
		onclick={ontoggle}
		title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
		aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
	>
		<Icon name={collapsed ? 'chevronRight' : 'chevronLeft'} class="h-[18px] w-[18px] shrink-0" />
		<span class="truncate {collapsed ? 'lg:hidden' : ''}">Collapse</span>
	</button>

	<div class="border-t border-slate-800 p-3">
		<div class="flex items-center gap-2.5 {collapsed ? 'lg:flex-col lg:gap-2' : ''}">
			<span class="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-slate-700 text-xs font-semibold text-white" title={email}>
				{initial}
			</span>
			<span class="min-w-0 flex-1 leading-tight {collapsed ? 'lg:hidden' : ''}">
				<span class="block truncate text-xs text-slate-400">Signed in</span>
				<span class="block truncate text-sm text-white">{email}</span>
			</span>
			<button
				type="button"
				class="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white disabled:opacity-50"
				onclick={() => (accountOpen = true)}
				disabled={busy}
				title="Change email or password"
				aria-label="Change email or password"
			>
				<Icon name="key" class="h-[18px] w-[18px]" />
			</button>
			<button
				type="button"
				class="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white disabled:opacity-50"
				onclick={() => (confirmOpen = true)}
				disabled={busy}
				title="Sign out"
				aria-label="Sign out"
			>
				<Icon name="logout" class="h-[18px] w-[18px]" />
			</button>
		</div>
	</div>
</aside>

<AccountDialog bind:open={accountOpen} />

<ConfirmDialog
	bind:open={confirmOpen}
	title="Sign out?"
	message="You will need to sign in again to view or record entries."
	confirmLabel="Sign out"
	{busy}
	onconfirm={signOut}
/>
