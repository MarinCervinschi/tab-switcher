import {
	cancel,
	cycle,
	idle,
	pick,
	release,
	reveal,
	select,
	type Control,
	type State,
	type Step,
} from "./gesture";
import type { Item, Message, Thumbnails } from "./messages";
import { Overlay } from "./overlay";

/** How long Control has to stay down after the first press before the list appears. */
const REVEAL_DELAY_MS = 200;
/** A press that arrives this soon after Control's release belongs to that hold. */
const LATE_MS = 1000;
/** Late presses arrive together; this is how long to wait for the rest of them. */
const LATE_WAIT_MS = 80;
/**
 * Chrome stops the worker after 30 s idle, and waking it takes long enough that a fast
 * Ctrl+Tab can end before its presses reach the page. The focused page keeps it awake.
 */
const PING_EVERY_MS = 20_000;

declare global {
	interface Window {
		__tabSwitcherCleanup?: () => void;
	}
}

// The script can land twice in a frame (the manifest, then the injection after an
// install or a reload): the newer copy removes the older one.
window.__tabSwitcherCleanup?.();
const controller = new AbortController();
// Capture listeners added at document_start run before any of the page's own.
const listen = { capture: true, signal: controller.signal };

if (window === window.top) runTopFrame();
else runInnerFrame();

/** An inner frame only reports Control, since the keys go to the frame with the focus. */
function runInnerFrame(): void {
	let ctrl = false;
	const set = (down: boolean, blur = false) => {
		if (down === ctrl) return;
		ctrl = down;
		send({ type: "frame-ctrl", down, blur });
	};
	const onKey = (event: KeyboardEvent) => {
		if (event.isTrusted) set(event.ctrlKey);
	};
	window.addEventListener("keydown", onKey, listen);
	window.addEventListener("keyup", onKey, listen);
	window.addEventListener("blur", () => set(false, true), listen);
	window.__tabSwitcherCleanup = () => controller.abort();
}

/** The top frame owns the gesture and draws the list. */
function runTopFrame(): void {
	let ctrl = false;
	let innerCtrl = false;
	let releasedAt = -Infinity;
	let lastPing = -Infinity;
	let state: State<Item> = idle;
	let timer: ReturnType<typeof setTimeout> | undefined;
	let lateTimer: ReturnType<typeof setTimeout> | undefined;
	let overlay: Overlay | undefined;
	let thumbnails: Thumbnails = {};

	const apply = (step: Step<Item>) => {
		const before = state.phase;
		const next = step.state;
		state = next;
		if (next.phase === "holding" && before === "idle" && (ctrl || innerCtrl)) {
			// A new gesture: fetch the thumbnails while Control is held, before the list
			// appears. A quick tap never asks for them.
			loadThumbnails(next.items);
		}
		if (state.phase === "holding" && before !== "holding") {
			timer = setTimeout(() => apply(reveal(state)), REVEAL_DELAY_MS);
		} else if (state.phase !== "holding") {
			clearTimeout(timer);
		}
		if (state.phase === "idle") clearTimeout(lateTimer);
		if (state.phase === "shown") {
			overlay ??= new Overlay({
				onPick: index => apply(pick(state, index)),
				onHover: index => apply(select(state, index)),
			});
			overlay.show(state.items, state.index);
			overlay.setThumbnails(state.items, thumbnails);
		} else {
			overlay?.hide();
		}
		if (step.activate) {
			const { tabId, windowId } = step.activate;
			send({ type: "activate", tabId, windowId });
		}
	};

	const loadThumbnails = (items: readonly Item[]) => {
		thumbnails = {};
		const tabIds = items.map(item => item.tabId);
		void ask<Thumbnails>({ type: "thumbnails", tabIds }).then(result => {
			if (!result || state.phase === "idle" || state.items !== items) return;
			thumbnails = result;
			overlay?.setThumbnails(items, result);
		});
	};

	const KEYS: Record<string, (state: State<Item>) => Step<Item>> = {
		Escape: () => cancel(),
		Enter: state => release(state),
	};

	const ping = () => {
		lastPing = performance.now();
		send({ type: "ping" });
	};
	/** Wakes the worker unless this page pinged it recently enough to keep it awake. */
	const wake = () => {
		if (performance.now() - lastPing > PING_EVERY_MS / 2) ping();
	};

	const onKey = (event: KeyboardEvent) => {
		if (!event.isTrusted) return;
		const wasDown = ctrl;
		ctrl = event.ctrlKey;
		// Control goes down before Tab: waking the worker now gains that time.
		if (!wasDown && ctrl) wake();
		if (wasDown && !ctrl) releasedAt = performance.now();
		if (state.phase === "idle") return;
		const action = event.type === "keydown" ? KEYS[event.key] : undefined;
		if (action) {
			event.preventDefault();
			event.stopImmediatePropagation();
			apply(action(state));
		} else if (!ctrl) {
			// Control's keyup, or any key that arrives without Control: either way it is up.
			apply(release(state));
		}
	};

	const onMessage = (
		message: Message,
		_sender: chrome.runtime.MessageSender,
		sendResponse: (response: boolean) => void
	) => {
		switch (message.type) {
			case "cycle": {
				const control: Control =
					ctrl || innerCtrl
						? "held"
						: performance.now() - releasedAt < LATE_MS
							? "released"
							: "unknown";
				apply(cycle(state, message.direction, message.items, control));
				if (control === "released" && state.phase !== "idle") {
					clearTimeout(lateTimer);
					lateTimer = setTimeout(() => apply(release(state)), LATE_WAIT_MS);
				}
				sendResponse(true);
				break;
			}
			case "can-capture":
				sendResponse(state.phase === "idle" && document.visibilityState === "visible");
				break;
			case "frame-ctrl": {
				const wasDown = innerCtrl;
				innerCtrl = message.down;
				if (wasDown && !message.down && !message.blur) {
					releasedAt = performance.now();
				}
				if (state.phase === "idle") break;
				if (message.blur) apply(cancel());
				else if (wasDown && !message.down) apply(release(state));
				break;
			}
		}
	};

	window.addEventListener("keydown", onKey, listen);
	window.addEventListener("keyup", onKey, listen);
	window.addEventListener(
		"pointermove",
		event => {
			// A missed keyup shows here: the mouse moves with Control up.
			if (event.isTrusted && state.phase !== "idle" && !innerCtrl && !event.ctrlKey) {
				apply(release(state));
			}
		},
		listen
	);
	window.addEventListener(
		"blur",
		() => {
			ctrl = false;
			if (state.phase !== "idle" && !innerCtrl) apply(cancel());
		},
		listen
	);
	document.addEventListener(
		"visibilitychange",
		() => {
			if (document.hidden && state.phase !== "idle") apply(cancel());
		},
		listen
	);
	window.addEventListener("focus", wake, listen);
	const pinger = setInterval(() => {
		if (document.visibilityState === "visible" && document.hasFocus()) ping();
	}, PING_EVERY_MS);
	chrome.runtime.onMessage.addListener(onMessage);

	window.__tabSwitcherCleanup = () => {
		controller.abort();
		clearInterval(pinger);
		clearTimeout(timer);
		clearTimeout(lateTimer);
		overlay?.destroy();
		try {
			chrome.runtime.onMessage.removeListener(onMessage);
		} catch {
			// This copy belongs to a reloaded extension and has no runtime left.
		}
	};
}

function send(message: Message): void {
	void ask(message);
}

/** Resolves to undefined when the extension was reloaded and this copy is orphaned. */
async function ask<T>(message: Message): Promise<T | undefined> {
	try {
		return (await chrome.runtime.sendMessage(message)) as T;
	} catch {
		return undefined;
	}
}
