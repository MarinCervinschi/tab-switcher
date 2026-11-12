# Changelog

What changes for whoever uses the extension: what it does, its shortcuts, its permissions and what it needs to run. Versions follow semver.

## Unreleased

The first version.

- Ctrl+Tab switches tabs in most-recently-used order, across every window. A quick Ctrl+Tab goes back to the last tab used; holding Ctrl and pressing Tab again shows the tabs in a row, and releasing Ctrl opens the selected one.
- Ctrl+Shift+Tab moves backwards. While the list is open, the mouse over a tab selects it, a click opens it, Enter opens the selection and Escape cancels.
- Each tab in the list shows a thumbnail of its page, taken while you were on it and kept in memory only.
- Where an extension cannot run (`chrome://` pages, the New Tab page, the Web Store, the PDF viewer), Ctrl+Tab switches straight to the previous tab.
- The shortcuts are bound once from the console of `chrome://extensions/shortcuts`, as the README shows.
- Permissions: `tabs`, `storage`, `scripting`, `favicon` and access to every site. Needs Chrome 121 or later.
