# tab-switcher

A Chrome extension that makes Ctrl+Tab switch tabs in most-recently-used order, like Cmd+Tab on macOS. A quick Ctrl+Tab goes back to the last tab you used. Hold Ctrl and press Tab again to see your tabs in a row, with a thumbnail of each; releasing Ctrl opens the selected tab.

While the list is open: Tab moves the selection, Shift+Tab moves it backwards, the mouse over a card selects it, a click opens it, Enter opens the selection and Escape cancels.

## Install

1. `pnpm install`, then `pnpm build`. The extension is built into `dist/`.
2. Open `chrome://extensions`, turn on Developer mode, choose **Load unpacked** and pick the `dist/` folder.
3. Bind the shortcuts. Chrome's shortcuts page does not accept Tab, so the binding goes through the console. Open `chrome://extensions/shortcuts`, open DevTools there (Cmd+Option+J on macOS, Ctrl+Shift+J elsewhere) and run:

   ```js
   for (const [commandName, keybinding] of [
   	["next", "Ctrl+Tab"],
   	["previous", "Ctrl+Shift+Tab"],
   ]) {
   	chrome.developerPrivate.updateExtensionCommand({
   		extensionId: "nledhmbfapnbdoigjilconkgblbadchk",
   		commandName,
   		keybinding,
   	});
   }
   ```

   If the console refuses to paste, type `allow pasting` first. On macOS `Ctrl` here is the Control key, not Command. The page should then list both shortcuts under Tab Switcher.

The id is fixed by the `key` in the manifest, so it is the same on every machine.

## Development

| | |
|---|---|
| `pnpm dev` | rebuilds `dist/` on every change to `src/`; then reload the extension in `chrome://extensions` |
| `pnpm test` · `pnpm typecheck` · `pnpm format` | Vitest, tsc, Prettier |
| `pnpm build` | a clean build into `dist/` |
| `pnpm icons` | after editing `assets/icon.svg`: renders the PNGs in `static/icons/` |

## Privacy

To list your tabs, the extension reads their titles and addresses; to show thumbnails, it takes a screenshot of the tab you are on. Both stay in the browser's memory (`chrome.storage.session`): they are never written to disk, never sent anywhere, and are gone when Chrome closes. Access to every site is what lets it draw the list inside the page and take those screenshots.

## Limits

- The list is drawn inside the page. Where an extension cannot run a script (`chrome://` pages, the New Tab page, the Chrome Web Store, the PDF viewer) and when the focus is in the address bar, Ctrl+Tab switches straight to the previous tab without the list.
- The order starts again at every browser restart, from the time each tab was last used. So do the thumbnails: a tab gets one the first time you look at it.
- A thumbnail shows the tab as it was shortly after you arrived on it.

Decisions and plans: `SPEC.md`. Changes: `CHANGELOG.md`.

## License

MIT
