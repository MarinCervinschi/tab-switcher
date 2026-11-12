/** A tab as the list shows it. */
export interface Item {
	tabId: number;
	windowId: number;
	title: string;
	url: string;
}

/** JPEG data URLs by tab id, for the tabs that have one. */
export type Thumbnails = Record<number, string>;

export type Message =
	/** Worker to top frame: a press of one of the two commands. */
	| { type: "cycle"; direction: 1 | -1; items: Item[] }
	/** Top frame to worker: switch to this tab. */
	| { type: "activate"; tabId: number; windowId: number }
	/** Top frame to worker, answered with `Thumbnails`. Asked once per gesture. */
	| { type: "thumbnails"; tabIds: number[] }
	/** Worker to top frame, answered with a boolean: is the page free of the list? */
	| { type: "can-capture" }
	/** Top frame to worker: keeps it awake, or wakes it before the first press. */
	| { type: "ping" }
	/**
	 * Inner frame to worker, relayed to the top frame: Control went down or up in a
	 * frame that has the focus. `blur` marks a reset because the frame lost the focus,
	 * which is not a release.
	 */
	| { type: "frame-ctrl"; down: boolean; blur?: boolean };
