<script lang="ts">
	import '../app.css';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import Sidebar from '$lib/components/Sidebar.svelte';
	import Header from '$lib/components/Header.svelte';
	import Toast from '$lib/components/Toast.svelte';
	import { session } from '$lib/stores/session.svelte';
	import { parties } from '$lib/stores/parties.svelte';

	const COLLAPSED_KEY = 'pc:sidebar-collapsed';

	let { children } = $props();
	let menuOpen = $state(false);
	let collapsed = $state(localStorage.getItem(COLLAPSED_KEY) === '1');

	function toggleCollapsed() {
		collapsed = !collapsed;
		localStorage.setItem(COLLAPSED_KEY, collapsed ? '1' : '0');
	}

	const isLogin = $derived(page.url.pathname === '/login');

	// Route guard: every page except /login requires a signed-in user.
	$effect(() => {
		if (!session.ready) return;
		if (!session.user && !isLogin) {
			const next = page.url.pathname + page.url.search;
			goto(`/login${next !== '/' ? `?redirect=${encodeURIComponent(next)}` : ''}`, { replaceState: true });
		} else if (session.user && isLogin) {
			const r = page.url.searchParams.get('redirect');
			goto(r && r.startsWith('/') && !r.startsWith('//') ? r : '/', { replaceState: true });
		}
	});

	// Party master is shared by most pages; subscribe only while signed in.
	$effect(() => {
		if (session.user) parties.start();
		else parties.stop();
	});
</script>

{#if !session.ready || (!session.user && !isLogin)}
	<div class="flex min-h-screen items-center justify-center text-sm text-slate-500">
		<span class="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-emerald-600"></span>
		Loading…
	</div>
{:else if isLogin}
	{@render children()}
{:else}
	<Sidebar open={menuOpen} {collapsed} onclose={() => (menuOpen = false)} ontoggle={toggleCollapsed} />
	<div class="min-h-screen bg-white transition-[padding] duration-200 {collapsed ? 'lg:pl-16' : 'lg:pl-64'}">
		<Header onmenu={() => (menuOpen = true)} />
		<main class="mx-auto max-w-[1600px] px-4 py-6 lg:px-8 lg:py-8">
			{@render children()}
		</main>
	</div>
{/if}

<Toast />
