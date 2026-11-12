import { describe, expect, it } from "vitest";

import { reconcile, remove, replace, sortTabs, touch } from "./mru";

describe("touch", () => {
	it("moves a tab to the front", () => {
		expect(touch([1, 2, 3], 3)).toEqual([3, 1, 2]);
	});

	it("adds a tab it has not seen", () => {
		expect(touch([1, 2], 9)).toEqual([9, 1, 2]);
	});
});

describe("remove", () => {
	it("drops the tab and keeps the rest in order", () => {
		expect(remove([1, 2, 3], 2)).toEqual([1, 3]);
	});
});

describe("replace", () => {
	it("keeps the place of a tab whose id changed", () => {
		expect(replace([1, 2, 3], 2, 7)).toEqual([1, 7, 3]);
	});

	it("does not duplicate an id that was already there", () => {
		expect(replace([1, 2, 7], 2, 7)).toEqual([1, 7]);
	});
});

describe("sortTabs", () => {
	it("puts known tabs in order and the others after by lastAccessed", () => {
		const tabs = [
			{ id: 1, lastAccessed: 10 },
			{ id: 2, lastAccessed: 50 },
			{ id: 3, lastAccessed: 30 },
			{ id: 4, lastAccessed: 40 },
		];
		const sorted = sortTabs(tabs, [3, 1]).map(tab => tab.id);
		expect(sorted).toEqual([3, 1, 2, 4]);
	});
});

describe("reconcile", () => {
	it("drops closed tabs and seeds missing ones from lastAccessed", () => {
		const tabs = [
			{ id: 1, lastAccessed: 10 },
			{ id: 2, lastAccessed: 20 },
			{ id: 4, lastAccessed: 40 },
		];
		expect(reconcile([2, 3, 1], tabs)).toEqual([2, 1, 4]);
	});

	it("orders everything by lastAccessed when nothing is stored", () => {
		const tabs = [{ id: 1, lastAccessed: 10 }, { id: 2 }, { id: 3, lastAccessed: 30 }];
		expect(reconcile([], tabs)).toEqual([3, 1, 2]);
	});
});
