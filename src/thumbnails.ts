import type { Thumbnails } from "./messages";

/** Twice the width of a card's picture, for sharp thumbnails on Retina screens. */
const WIDTH = 320;
/** Time for a tab to paint after it becomes active or finishes loading. */
const DELAY_MS = 400;
/** Chrome allows two captures a second per extension. */
const GAP_MS = 550;
const PREFIX = "thumb:";

const timers = new Map<number, ReturnType<typeof setTimeout>>();
let queue: Promise<void> = Promise.resolve();
let lastCapture = 0;

/**
 * Captures the active tab of a window shortly after now. Only the visible tab of a
 * window can be captured, so a tab gets its thumbnail while you are on it.
 */
export function scheduleCapture(windowId: number): void {
	clearTimeout(timers.get(windowId));
	timers.set(
		windowId,
		setTimeout(() => {
			timers.delete(windowId);
			queue = queue.then(() => capture(windowId)).catch(() => {});
		}, DELAY_MS)
	);
}

async function capture(windowId: number): Promise<void> {
	const wait = lastCapture + GAP_MS - Date.now();
	if (wait > 0) await new Promise(resolve => setTimeout(resolve, wait));

	const [tab] = await chrome.tabs.query({ active: true, windowId });
	if (tab?.id === undefined) return;
	// A window behind another app may not be painted, and would give a blank picture.
	const window = await chrome.windows.get(windowId);
	if (!window.focused || window.state === "minimized") return;
	if (!(await pageIsClear(tab.id))) return;

	lastCapture = Date.now();
	const shot = await chrome.tabs.captureVisibleTab(windowId, {
		format: "jpeg",
		quality: 85,
	});
	// The user may have switched tab while the capture ran: then the picture is not
	// this tab's.
	const [after] = await chrome.tabs.query({ active: true, windowId });
	if (after?.id !== tab.id) return;
	await chrome.storage.session.set({ [PREFIX + tab.id]: await shrink(shot) });
}

/** False while the list is open in the page, so it never ends up in a thumbnail. */
async function pageIsClear(tabId: number): Promise<boolean> {
	try {
		const answer: unknown = await chrome.tabs.sendMessage(
			tabId,
			{ type: "can-capture" },
			{ frameId: 0 }
		);
		return answer !== false;
	} catch {
		return true; // no content script, so no list either
	}
}

async function shrink(dataUrl: string): Promise<string> {
	const bitmap = await createImageBitmap(await (await fetch(dataUrl)).blob());
	const height = Math.round((bitmap.height * WIDTH) / bitmap.width);
	const canvas = new OffscreenCanvas(WIDTH, height);
	const context = canvas.getContext("2d")!;
	context.imageSmoothingQuality = "high";
	context.drawImage(bitmap, 0, 0, WIDTH, height);
	bitmap.close();
	const blob = await canvas.convertToBlob({ type: "image/jpeg", quality: 0.75 });
	const bytes = new Uint8Array(await blob.arrayBuffer());
	let binary = "";
	for (let i = 0; i < bytes.length; i += 0x8000) {
		binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
	}
	return `data:image/jpeg;base64,${btoa(binary)}`;
}

export async function getThumbnails(tabIds: readonly number[]): Promise<Thumbnails> {
	const stored = await chrome.storage.session.get(tabIds.map(id => PREFIX + id));
	const result: Thumbnails = {};
	for (const id of tabIds) {
		const value: unknown = stored[PREFIX + id];
		if (typeof value === "string") result[id] = value;
	}
	return result;
}

export function forgetThumbnail(tabId: number): void {
	chrome.storage.session.remove(PREFIX + tabId).catch(() => {});
}

export async function moveThumbnail(oldId: number, newId: number): Promise<void> {
	const stored = await chrome.storage.session.get(PREFIX + oldId);
	const value: unknown = stored[PREFIX + oldId];
	if (typeof value === "string") {
		await chrome.storage.session.set({ [PREFIX + newId]: value });
	}
	forgetThumbnail(oldId);
}
