/** Tab ids, the most recently used first. */
export type Order = readonly number[];

interface TabLike {
	id?: number;
	lastAccessed?: number;
}

export function touch(order: Order, tabId: number): number[] {
	return [tabId, ...order.filter(id => id !== tabId)];
}

export function remove(order: Order, tabId: number): number[] {
	return order.filter(id => id !== tabId);
}

/** Chrome gives a tab a new id when it swaps in a prerendered or discarded page. */
export function replace(order: Order, oldId: number, newId: number): number[] {
	const swapped = order.map(id => (id === oldId ? newId : id));
	return swapped.filter((id, i) => swapped.indexOf(id) === i);
}

/** Tabs in `order` come first, in that order; the rest follow by `lastAccessed`, latest first. */
export function sortTabs<T extends TabLike>(tabs: readonly T[], order: Order): T[] {
	const rank = new Map(order.map((id, i) => [id, i]));
	return [...tabs].sort((a, b) => {
		const ra = a.id === undefined ? undefined : rank.get(a.id);
		const rb = b.id === undefined ? undefined : rank.get(b.id);
		if (ra !== undefined && rb !== undefined) return ra - rb;
		if (ra !== undefined) return -1;
		if (rb !== undefined) return 1;
		return (b.lastAccessed ?? 0) - (a.lastAccessed ?? 0);
	});
}

/** The order restricted to the tabs that exist, with any tab it lacks added after. */
export function reconcile(order: Order, tabs: readonly TabLike[]): number[] {
	return sortTabs(tabs, order).flatMap(tab => (tab.id === undefined ? [] : [tab.id]));
}
