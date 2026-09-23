<script lang="ts">
	import { page } from '$app/state';
	import Icon, { type IconName } from './Icon.svelte';

	let { open = false, onclose }: { open?: boolean; onclose: () => void } = $props();

	const NAV: { href: string; label: string; icon: IconName }[] = [
		{ href: '/', label: 'Dashboard', icon: 'dashboard' },
		{ href: '/parties', label: 'Parties', icon: 'users' },
		{ href: '/received-from-party', label: 'Received From Party', icon: 'truck' },
		{ href: '/reports', label: 'Reports', icon: 'report' }
	];

	const isActive = (href: string) =>
		href === '/' ? page.url.pathname === '/' : page.url.pathname.startsWith(href);
</script>

{#if open}
	<button
		type="button"
		class="fixed inset-0 z-30 bg-slate-900/40 lg:hidden"
		aria-label="Close menu"
		onclick={onclose}
	></button>
{/if}

<aside
	class="fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-slate-200 bg-white transition-transform duration-200 lg:translate-x-0 {open
		? 'translate-x-0'
		: '-translate-x-full'}"
>
	<div class="flex h-14 items-center justify-between border-b border-slate-200 px-4">
		<a href="/" class="flex items-center gap-2" onclick={onclose}>
			<img src="/favicon.svg" alt="" class="h-7 w-7" />
			<span class="leading-tight">
				<span class="block text-sm font-semibold text-slate-900">Party Calci</span>
				<span class="block text-[11px] text-slate-500">Rice Mill Material Register</span>
			</span>
		</a>
		<button type="button" class="rounded p-1 text-slate-500 hover:bg-slate-100 lg:hidden" onclick={onclose} aria-label="Close menu">
			<Icon name="x" class="h-5 w-5" />
		</button>
	</div>
	<nav class="flex-1 space-y-0.5 p-3" aria-label="Main">
		{#each NAV as item (item.href)}
			{@const active = isActive(item.href)}
			<a
				href={item.href}
				onclick={onclose}
				aria-current={active ? 'page' : undefined}
				class="flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors {active
					? 'bg-emerald-50 text-emerald-800'
					: 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}"
			>
				<Icon name={item.icon} class="h-4 w-4 {active ? 'text-emerald-700' : 'text-slate-400'}" />
				{item.label}
			</a>
		{/each}
	</nav>
	<div class="border-t border-slate-200 p-3 text-[11px] text-slate-400">KG per bag: fixed at 62</div>
</aside>
