import { describe, expect, it } from "vitest";

import {
	cancel,
	cycle,
	idle,
	pick,
	release,
	reveal,
	select,
	type State,
} from "./gesture";

const tabs = ["current", "previous", "older", "oldest"];

describe("a quick tap", () => {
	it("goes to the previous tab without showing anything", () => {
		const step = cycle(idle, 1, tabs, "unknown");
		expect(step).toEqual({ state: idle, activate: "previous" });
	});

	it("goes to the oldest tab with Shift", () => {
		expect(cycle(idle, -1, tabs, "unknown").activate).toBe("oldest");
	});

	it("does nothing with a single tab", () => {
		expect(cycle(idle, 1, ["current"], "unknown")).toEqual({ state: idle });
	});
});

describe("holding Control", () => {
	const holding = cycle(idle, 1, tabs, "held").state;

	it("selects the previous tab and waits before showing the list", () => {
		expect(holding).toEqual({ phase: "holding", items: tabs, index: 1 });
	});

	it("shows the list after the delay", () => {
		expect(reveal(holding).state).toMatchObject({ phase: "shown", index: 1 });
	});

	it("shows the list and moves on at the next press", () => {
		expect(cycle(holding, 1, [], "held").state).toMatchObject({
			phase: "shown",
			index: 2,
		});
	});

	it("keeps the order of the first press", () => {
		const state = cycle(holding, 1, ["something", "else"], "held").state;
		expect(state).toMatchObject({ items: tabs });
	});

	it("wraps around both ways", () => {
		let state: State<string> = holding;
		for (let i = 0; i < 3; i++) state = cycle(state, 1, [], "held").state;
		expect(state).toMatchObject({ index: 0 });
		state = cycle(state, -1, [], "held").state;
		expect(state).toMatchObject({ index: 3 });
	});

	it("opens the selected tab on release", () => {
		const shown = cycle(holding, 1, [], "held").state;
		expect(release(shown)).toEqual({ state: idle, activate: "older" });
	});

	it("opens the previous tab on a release before the list appears", () => {
		expect(release(holding)).toEqual({ state: idle, activate: "previous" });
	});

	it("opens a picked tab", () => {
		expect(pick(reveal(holding).state, 3)).toEqual({ state: idle, activate: "oldest" });
	});

	it("ignores a pick outside the list", () => {
		expect(pick(holding, 9)).toEqual({ state: holding });
	});

	it("opens nothing when cancelled", () => {
		expect(cancel()).toEqual({ state: idle });
	});
});

describe("presses that arrive after Control's release", () => {
	it("are collected without showing the list, then lead to the right tab", () => {
		let state: State<string> = cycle(idle, 1, tabs, "released").state;
		expect(state).toEqual({ phase: "holding", items: tabs, index: 1 });
		state = cycle(state, 1, [], "released").state;
		expect(state).toEqual({ phase: "holding", items: tabs, index: 2 });
		expect(release(state).activate).toBe("older");
	});
});

describe("the mouse", () => {
	const holding = cycle(idle, 1, tabs, "held").state;

	it("over a card selects it, and release opens it", () => {
		const hovered = select(reveal(holding).state, 3).state;
		expect(hovered).toMatchObject({ phase: "shown", index: 3 });
		expect(release(hovered).activate).toBe("oldest");
	});

	it("outside the list changes nothing", () => {
		expect(select(holding, -1)).toEqual({ state: holding });
	});
});

describe("when idle", () => {
	it("ignores a release, a reveal and the mouse", () => {
		expect(release(idle)).toEqual({ state: idle });
		expect(reveal(idle)).toEqual({ state: idle });
		expect(select(idle, 1)).toEqual({ state: idle });
	});
});
