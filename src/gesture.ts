/**
 * One gesture runs from the first Tab to the release of Control. While Control is held
 * the list is `holding` (not drawn yet) or `shown`; nothing is activated until the end.
 */
export type State<T> =
	| { phase: "idle" }
	| { phase: "holding" | "shown"; items: readonly T[]; index: number };

export interface Step<T> {
	state: State<T>;
	activate?: T;
}

export const idle = { phase: "idle" } as const;

/**
 * What the page knows of Control when a press reaches it. `held`: still down.
 * `released`: up again, so the press arrived late and belongs to a hold that has ended;
 * the caller collects such presses and then releases. `unknown`: the page never saw
 * Control go down (the focus was in the address bar, say).
 */
export type Control = "held" | "released" | "unknown";

/**
 * A press of Ctrl+Tab (direction 1) or Ctrl+Shift+Tab (-1). `items` starts with the
 * current tab and is read on the first press only, so the order stays fixed while
 * cycling.
 */
export function cycle<T>(
	state: State<T>,
	direction: 1 | -1,
	items: readonly T[],
	control: Control
): Step<T> {
	if (state.phase !== "idle") {
		const index = wrap(state.index + direction, state.items.length);
		// A late press moves the selection without showing the list.
		const phase = control === "held" ? "shown" : state.phase;
		return { state: { phase, items: state.items, index } };
	}
	if (items.length < 2) return { state };
	const index = direction === 1 ? 1 : items.length - 1;
	if (control === "unknown") return { state, activate: items[index] };
	return { state: { phase: "holding", items, index } };
}

/** The mouse over a card selects it, as in Cmd+Tab. */
export function select<T>(state: State<T>, index: number): Step<T> {
	if (state.phase === "idle" || index < 0 || index >= state.items.length) {
		return { state };
	}
	return { state: { phase: "shown", items: state.items, index } };
}

export function release<T>(state: State<T>): Step<T> {
	if (state.phase === "idle") return { state };
	return { state: idle, activate: state.items[state.index] };
}

/** Control held long enough after the first press: draw the list. */
export function reveal<T>(state: State<T>): Step<T> {
	if (state.phase !== "holding") return { state };
	return { state: { ...state, phase: "shown" } };
}

export function pick<T>(state: State<T>, index: number): Step<T> {
	if (state.phase === "idle" || index < 0 || index >= state.items.length) {
		return { state };
	}
	return { state: idle, activate: state.items[index] };
}

export function cancel<T>(): Step<T> {
	return { state: idle };
}

function wrap(index: number, length: number): number {
	return ((index % length) + length) % length;
}
