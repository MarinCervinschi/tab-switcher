import type { Item, Thumbnails } from "./messages";

// The host sits in the page, so its own styles are inline and !important: the page's
// CSS can reach it. Everything inside is in a closed shadow root the page cannot touch.
// `display` is left alone so the browser can still hide the popover when it is closed.
const HOST_STYLE = [
	"position: fixed",
	"inset: 0",
	"margin: auto",
	"width: fit-content",
	"height: fit-content",
	"max-width: 94vw",
	"padding: 0",
	"border: 0",
	"background: transparent",
	"overflow: visible",
	"color-scheme: dark",
]
	.map(rule => `${rule} !important`)
	.join(";");

// Sizes are in px: rem would follow the page's root font size.
const CSS = `
.panel {
	all: initial;
	position: relative;
	display: flex;
	gap: 10px;
	max-width: 94vw;
	box-sizing: border-box;
	padding: 12px;
	overflow-x: auto;
	scrollbar-width: none;
	background: rgba(32, 33, 36, 0.92);
	backdrop-filter: blur(24px);
	border: 1px solid rgba(255, 255, 255, 0.08);
	border-radius: 18px;
	box-shadow: 0 16px 48px rgba(0, 0, 0, 0.5);
	font: 500 13px/1.3 system-ui, -apple-system, "Segoe UI", sans-serif;
	color: #e8eaed;
	cursor: default;
	user-select: none;
}
.card {
	flex: none;
	width: 168px;
	padding: 8px;
	border-radius: 12px;
}
.card[aria-selected="true"] {
	background: #4a4fb3;
}
.thumb {
	display: grid;
	place-items: center;
	height: 100px;
	border-radius: 8px;
	background: #2b2c30;
	overflow: hidden;
}
.thumb .icon {
	width: 32px;
	height: 32px;
}
.thumb .shot {
	width: 100%;
	height: 100%;
	object-fit: cover;
	object-position: top left;
}
.label {
	display: flex;
	align-items: center;
	gap: 6px;
	margin-top: 8px;
}
.label img {
	flex: none;
	width: 16px;
	height: 16px;
}
.label span {
	overflow: hidden;
	white-space: nowrap;
	text-overflow: ellipsis;
}
`;

interface Handlers {
	/** A card was clicked: open its tab. */
	onPick(index: number): void;
	/** The mouse moved over a card: select it. */
	onHover(index: number): void;
}

export class Overlay {
	readonly #host: HTMLElement;
	readonly #panel: HTMLElement;
	#items: readonly Item[] | undefined;
	#thumbnails: Thumbnails = {};

	constructor({ onPick, onHover }: Handlers) {
		this.#host = document.createElement("tab-switcher-overlay");
		this.#host.popover = "manual";
		this.#host.style.cssText = HOST_STYLE;
		const root = this.#host.attachShadow({ mode: "closed" });
		const style = document.createElement("style");
		style.textContent = CSS;
		this.#panel = document.createElement("div");
		this.#panel.className = "panel";
		this.#panel.setAttribute("role", "listbox");
		root.append(style, this.#panel);

		// pointerdown, not click: with Control held, macOS turns a click into a right click.
		this.#panel.addEventListener("pointerdown", event => {
			event.preventDefault();
			const index = cardIndex(event);
			if (index !== undefined) onPick(index);
		});
		this.#panel.addEventListener("pointermove", event => {
			// Chrome also sends moves of zero when the page changes under a still mouse;
			// only a real movement selects, as in Cmd+Tab.
			if (event.movementX === 0 && event.movementY === 0) return;
			const index = cardIndex(event);
			if (index !== undefined) onHover(index);
		});
		this.#panel.addEventListener("contextmenu", event => event.preventDefault());
	}

	show(items: readonly Item[], selected: number): void {
		if (items !== this.#items) {
			this.#items = items;
			this.#thumbnails = {};
			this.#panel.replaceChildren(...items.map(card));
		}
		this.#panel.querySelectorAll(".card").forEach((element, i) => {
			element.setAttribute("aria-selected", String(i === selected));
		});
		if (!this.#host.isConnected) document.documentElement.append(this.#host);
		if (!this.#host.matches(":popover-open")) this.#host.showPopover();
		this.#scrollTo(selected);
	}

	/** Thumbnails arrive after the list is built; cards without one keep the favicon. */
	setThumbnails(items: readonly Item[], thumbnails: Thumbnails): void {
		if (items !== this.#items) return;
		items.forEach((item, i) => {
			const url = thumbnails[item.tabId];
			const thumb = this.#panel.children[i]?.querySelector(".thumb");
			if (!url || !thumb || this.#thumbnails[item.tabId] === url) return;
			const image = document.createElement("img");
			image.className = "shot";
			image.alt = "";
			image.src = url;
			thumb.replaceChildren(image);
		});
		this.#thumbnails = { ...thumbnails };
	}

	hide(): void {
		if (this.#host.isConnected && this.#host.matches(":popover-open")) {
			this.#host.hidePopover();
		}
	}

	destroy(): void {
		this.#host.remove();
	}

	/** Keeps the selected card in view; scrollIntoView could scroll the page as well. */
	#scrollTo(index: number): void {
		const element = this.#panel.children[index] as HTMLElement | undefined;
		if (!element) return;
		const panel = this.#panel;
		const left = element.offsetLeft;
		const right = left + element.offsetWidth;
		if (left < panel.scrollLeft) panel.scrollLeft = left - 12;
		else if (right > panel.scrollLeft + panel.clientWidth) {
			panel.scrollLeft = right - panel.clientWidth + 12;
		}
	}
}

function cardIndex(event: Event): number | undefined {
	const card = (event.target as Element).closest<HTMLElement>(".card");
	return card?.dataset.index ? Number(card.dataset.index) : undefined;
}

function card(item: Item, index: number): HTMLElement {
	const element = document.createElement("div");
	element.className = "card";
	element.dataset.index = String(index);
	element.setAttribute("role", "option");

	const thumb = document.createElement("div");
	thumb.className = "thumb";
	const icon = favicon(item.url, 32);
	icon.className = "icon";
	thumb.append(icon);

	const label = document.createElement("div");
	label.className = "label";
	const title = document.createElement("span");
	title.textContent = item.title || item.url;
	label.append(favicon(item.url, 16), title);

	element.append(thumb, label);
	return element;
}

/** Chrome's favicon cache, served to the page through web_accessible_resources. */
function favicon(pageUrl: string, size: number): HTMLImageElement {
	const image = document.createElement("img");
	const url = new URL(chrome.runtime.getURL("/_favicon/"));
	url.searchParams.set("pageUrl", pageUrl);
	url.searchParams.set("size", String(size * 2));
	image.src = url.href;
	image.alt = "";
	return image;
}
