export type ToastKind = 'success' | 'error' | 'info';

export interface ToastItem {
	id: number;
	kind: ToastKind;
	message: string;
}

let nextId = 1;

class Toasts {
	items = $state<ToastItem[]>([]);

	show(kind: ToastKind, message: string, ms = kind === 'error' ? 6000 : 3500) {
		const id = nextId++;
		this.items.push({ id, kind, message });
		setTimeout(() => this.dismiss(id), ms);
	}

	dismiss(id: number) {
		this.items = this.items.filter((t) => t.id !== id);
	}
}

const toasts = new Toasts();
export { toasts };

export const toast = {
	success: (m: string) => toasts.show('success', m),
	error: (m: string) => toasts.show('error', m),
	info: (m: string) => toasts.show('info', m)
};
