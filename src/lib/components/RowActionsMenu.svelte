<script lang="ts" module>
	import type { IconName } from './Icon.svelte';

	export interface RowAction {
		label: string;
		icon: IconName;
		href?: string;
		onclick?: () => void;
		tone?: 'default' | 'danger' | 'success';
		/** Draw a separator above this item. */
		divider?: boolean;
	}
</script>

<script lang="ts">
	import { tick } from 'svelte';
	import Icon from './Icon.svelte';

	let { label, items }: { label: string; items: RowAction[] } = $props();

	const MENU_WIDTH = 192;
	let open = $state(false);
	let button: HTMLButtonElement;
	let menu = $state<HTMLDivElement>();
	let pos = $state({ top: 0, left: 0 });

	const TONE = {
		default: 'text-slate-700 hover:bg-slate-100',
		danger: 'text-red-600 hover:bg-red-50',
		success: 'text-emerald-700 hover:bg-emerald-50'
	};

	const menuItems = () => Array.from(menu?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);

	// Fixed positioning so the menu is never clipped by the table's horizontal scroll area;
	// flips above the button when there is no room below.
	function place() {
		const r = button.getBoundingClientRect();
		const h = menu?.offsetHeight ?? 0;
		const below = r.bottom + 4;
		const top = below + h > window.innerHeight - 8 ? Math.max(8, r.top - h - 4) : below;
		pos = { top, left: Math.max(8, r.right - MENU_WIDTH) };
	}

	async function toggle() {
		open = !open;
		if (!open) return;
		await tick();
		place();
		menuItems()[0]?.focus();
	}

	// Render the menu at <body> level: the sticky Actions column creates its own stacking
	// context, so a menu left inside it gets painted over by the rows below.
	function portal(node: HTMLElement) {
		document.body.appendChild(node);
		return { destroy: () => node.remove() };
	}

	function close(returnFocus = false) {
		open = false;
		if (returnFocus) button.focus();
	}

	function run(item: RowAction) {
		close();
		item.onclick?.();
	}

	function onkeydown(e: KeyboardEvent) {
		const list = menuItems();
		const i = list.indexOf(document.activeElement as HTMLElement);
		if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
			e.preventDefault();
			const step = e.key === 'ArrowDown' ? 1 : -1;
			list[(i + step + list.length) % list.length]?.focus();
		} else if (e.key === 'Home' || e.key === 'End') {
			e.preventDefault();
			list[e.key === 'Home' ? 0 : list.length - 1]?.focus();
		} else if (e.key === 'Escape') {
			e.preventDefault();
			close(true);
		} else if (e.key === 'Tab') {
			close();
		}
	}

	$effect(() => {
		if (!open) return;
		const onPointer = (e: PointerEvent) => {
			const t = e.target as Node;
			if (!menu?.contains(t) && !button.contains(t)) close();
		};
		const onMove = () => close();
		document.addEventListener('pointerdown', onPointer);
		window.addEventListener('scroll', onMove, true);
		window.addEventListener('resize', onMove);
		return () => {
			document.removeEventListener('pointerdown', onPointer);
			window.removeEventListener('scroll', onMove, true);
			window.removeEventListener('resize', onMove);
		};
	});
</script>

<button
	bind:this={button}
	type="button"
	class="icon-action {open ? 'bg-slate-100 text-slate-700' : ''}"
	title="Actions"
	aria-label={label}
	aria-haspopup="menu"
	aria-expanded={open}
	onclick={toggle}
>
	<Icon name="moreVertical" class="h-4 w-4" />
</button>

{#if open}
	<div
		bind:this={menu}
		use:portal
		role="menu"
		tabindex="-1"
		aria-label={label}
		class="fixed z-50 rounded-lg border border-slate-200 bg-white py-1 text-left shadow-lg"
		style="top: {pos.top}px; left: {pos.left}px; width: {MENU_WIDTH}px"
		{onkeydown}
	>
		{#each items as item (item.label)}
			{@const cls = `flex w-full items-center gap-2.5 px-3 py-2 text-sm font-medium focus:outline-none focus-visible:bg-slate-100 ${TONE[item.tone ?? 'default']}`}
			{#if item.divider}<div class="my-1 border-t border-slate-100" role="separator"></div>{/if}
			{#if item.href}
				<a role="menuitem" tabindex="-1" href={item.href} class={cls} onclick={() => close()}>
					<Icon name={item.icon} class="h-4 w-4 opacity-80" />{item.label}
				</a>
			{:else}
				<button role="menuitem" tabindex="-1" type="button" class={cls} onclick={() => run(item)}>
					<Icon name={item.icon} class="h-4 w-4 opacity-80" />{item.label}
				</button>
			{/if}
		{/each}
	</div>
{/if}
