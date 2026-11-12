import type { Item, Message } from "./messages";
import { type Order, reconcile, remove, replace, sortTabs, touch } from "./mru";
import {
	forgetThumbnail,
	getThumbnails,
	moveThumbnail,
	scheduleCapture,
} from "./thumbnails";

const STORAGE_KEY = "order";

// Chrome stops the worker when idle. The order lives here while it runs and in
// storage.session between runs, which outlives the worker but not a browser restart.
let order: number[] = [];
const ready = load();

// Listeners go on at the top level, synchronously: an event that wakes the worker
// reaches only the listeners added in its first turn.
chrome.tabs.onActivated.addListener(({ tabId, windowId }) => {
	void update(o => touch(o, tabId));
	scheduleCapture(windowId);
});
chrome.tabs.onUpdated.addListener((_tabId, change, tab) => {
	if (change.status === "complete" && tab.active) scheduleCapture(tab.windowId);
});
chrome.tabs.onRemoved.addListener(tabId => {
	void update(o => remove(o, tabId));
	forgetThumbnail(tabId);
});
chrome.tabs.onReplaced.addListener((added, removed) => {
	void update(o => replace(o, removed, added));
	void moveThumbnail(removed, added);
});
chrome.windows.onFocusChanged.addListener(windowId => void onWindowFocus(windowId));
chrome.commands.onCommand.addListener((command, tab) => void onCommand(command, tab));
chrome.runtime.onMessage.addListener(onMessage);
chrome.runtime.onInstalled.addListener(() => void injectIntoOpenTabs());

async function load(): Promise<void> {
	const [stored, tabs] = await Promise.all([
		chrome.storage.session.get(STORAGE_KEY),
		chrome.tabs.query({}),
	]);
	const saved: unknown = stored[STORAGE_KEY];
	// Empty after a browser restart: lastAccessed gives a rough order to start from.
	order = reconcile(Array.isArray(saved) ? saved : [], tabs);
	save();
}

async function update(change: (order: Order) => number[]): Promise<void> {
	await ready;
	order = change(order);
	save();
}

function save(): void {
	chrome.storage.session.set({ [STORAGE_KEY]: order }).catch(console.error);
}

async function onWindowFocus(windowId: number): Promise<void> {
	// Switching windows activates no tab, so the focused window's tab is recorded here.
	if (windowId === chrome.windows.WINDOW_ID_NONE) return;
	scheduleCapture(windowId);
	const [tab] = await chrome.tabs.query({ active: true, windowId });
	if (tab?.id !== undefined) await update(o => touch(o, tab.id!));
}

async function onCommand(command: string, tab?: chrome.tabs.Tab): Promise<void> {
	if (command !== "next" && command !== "previous") return;
	const direction = command === "next" ? 1 : -1;
	const current =
		tab ?? (await chrome.tabs.query({ active: true, lastFocusedWindow: true }))[0];
	if (current?.id === undefined) return;
	const [, tabs] = await Promise.all([
		update(o => touch(o, current.id!)),
		chrome.tabs.query({}),
	]);
	const items = sortTabs(tabs, order).flatMap(toItem);

	const message: Message = { type: "cycle", direction, items };
	try {
		await chrome.tabs.sendMessage(current.id, message, { frameId: 0 });
	} catch {
		// No content script answers here (chrome:// pages, the New Tab page, the Web
		// Store, the PDF viewer): switch at once, as a quick tap would.
		const target = items[direction === 1 ? 1 : items.length - 1];
		if (items.length > 1 && target) await activate(target.tabId, target.windowId);
	}
}

/** Returns true when it answers later, as Chrome requires. */
function onMessage(
	message: Message,
	sender: chrome.runtime.MessageSender,
	sendResponse: (response: unknown) => void
): boolean {
	const tabId = sender.tab?.id;
	switch (message.type) {
		case "activate":
			void activate(message.tabId, message.windowId);
			return false;
		case "thumbnails":
			getThumbnails(message.tabIds).then(sendResponse, () => sendResponse({}));
			return true;
		case "frame-ctrl":
			if (tabId !== undefined && sender.frameId !== 0) {
				chrome.tabs.sendMessage(tabId, message, { frameId: 0 }).catch(() => {});
			}
			return false;
		default:
			return false;
	}
}

async function activate(tabId: number, windowId: number): Promise<void> {
	// Recorded now rather than on onActivated, so a quick second press already sees it.
	await update(o => touch(o, tabId));
	// Window first, then tab: QuicKey found that the other order misbehaves on macOS.
	await chrome.windows.update(windowId, { focused: true });
	await chrome.tabs.update(tabId, { active: true });
}

/** Tabs open before the install or a reload have no content script yet. */
async function injectIntoOpenTabs(): Promise<void> {
	const tabs = await chrome.tabs.query({
		url: ["http://*/*", "https://*/*", "file:///*"],
	});
	await Promise.all(
		tabs.map(tab =>
			tab.id === undefined || tab.discarded
				? undefined
				: chrome.scripting
						.executeScript({
							target: { tabId: tab.id, allFrames: true },
							files: ["content.js"],
						})
						.catch(() => {})
		)
	);
}

function toItem(tab: chrome.tabs.Tab): Item[] {
	if (tab.id === undefined) return [];
	return [
		{
			tabId: tab.id,
			windowId: tab.windowId,
			title: tab.title ?? "",
			url: tab.url ?? tab.pendingUrl ?? "",
		},
	];
}
