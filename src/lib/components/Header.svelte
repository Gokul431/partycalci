<script lang="ts">
	import { goto } from '$app/navigation';
	import { logout } from '$lib/firebase/auth';
	import { session } from '$lib/stores/session.svelte';
	import { toast } from '$lib/stores/toast.svelte';
	import { friendlyError } from '$lib/utils/errors';
	import Icon from './Icon.svelte';

	let { onmenu }: { onmenu: () => void } = $props();
	let busy = $state(false);

	async function signOut() {
		busy = true;
		try {
			await logout();
			await goto('/login');
		} catch (e) {
			toast.error(friendlyError(e, 'Could not sign out.'));
		} finally {
			busy = false;
		}
	}
</script>

<header class="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-slate-200 bg-white/95 px-4 backdrop-blur lg:px-6">
	<button type="button" class="rounded p-1.5 text-slate-600 hover:bg-slate-100 lg:hidden" onclick={onmenu} aria-label="Open menu">
		<Icon name="menu" class="h-5 w-5" />
	</button>
	<div class="flex-1"></div>
	{#if session.user}
		<span class="hidden text-sm text-slate-600 sm:inline" title="Signed in">{session.user.email}</span>
		<button type="button" class="btn-secondary py-1.5" onclick={signOut} disabled={busy}>
			<Icon name="logout" />
			<span class="hidden sm:inline">Sign out</span>
		</button>
	{/if}
</header>
