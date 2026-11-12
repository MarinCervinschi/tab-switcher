# tab-switcher

A Chrome extension (Manifest V3) that makes Ctrl+Tab switch tabs in most-recently-used order, like Cmd+Tab on macOS or the switcher of an IDE. A quick Ctrl+Tab goes back to the last tab used. Holding Ctrl and pressing Tab again shows the tabs of every window in a row, and each further Tab moves the selection; releasing Ctrl opens the selected tab.

Status (2026-11-12): decisions 1 to 17 taken. Milestone 1 checked by Marin in Chrome on macOS with the real Ctrl+Tab binding. Milestone 2 (thumbnails, mouse) checked by Marin. Decisions 16 and 17 (fast presses) built and smoke-tested in Chrome for Testing, not yet checked by hand.

## Decisions

Taken on 2026-11-12, after reading the Chrome extension docs and the source of QuicKey (`fwextensions/QuicKey`), the open-source extension that first bound Ctrl+Tab this way.

| # | Decision | Why | Date |
|---|---|---|---|
| 1 | Ctrl+Tab goes through the tabs of every window in most-recently-used order, with no limit on how many | Chrome's own Ctrl+Tab goes by position in the tab strip | 2026-11-12 |
| 2 | Ctrl+Tab and Ctrl+Shift+Tab are bound with `chrome.developerPrivate.updateExtensionCommand`, run in the DevTools console of `chrome://extensions/shortcuts`. The key string is `Ctrl+Tab` on macOS too | The shortcuts page and `suggested_key` reject Tab. In that call `Ctrl` is the physical Control key on every platform (Chromium's `Command::StringToAccelerator`); the Ctrl to Command conversion and `MacCtrl` apply only to `suggested_key`. QuicKey documents the same call | 2026-11-12 |
| 3 | The manifest carries a `key`, so the extension id is always `nledhmbfapnbdoigjilconkgblbadchk` | The binding is stored per extension id, and the snippet in the README can name it | 2026-11-12 |
| 4 | The list is drawn inside the page by a content script, in a closed shadow root shown as a popover (top layer). No popup window | It looks like the reference screenshot, with no window frame. The page keeps the focus, so the content script sees Control's keydown and keyup itself. A popup window misses the keyup when Ctrl is released before it gets the focus, which happens on most quick taps | 2026-11-12 |
| 5 | Host permission on every site (`<all_urls>`) | The content script has to run on every page, and the thumbnails need it (decision 11). Accepted by Marin | 2026-11-12 |
| 6 | Quick tap and hold are told apart by the state of Control that the content script tracks. If Control is already up when the command arrives, the extension switches at once and shows nothing. If it is held, the list appears on the next Tab or after 200 ms | No flash on a quick tap, and no timer guessing whether Ctrl was released. Cmd+Tab also shows its list after a short hold | 2026-11-12 |
| 7 | The list starts with the current tab, and the selection starts on the second item. Ctrl+Shift+Tab moves backwards | Like Cmd+Tab and the reference screenshot | 2026-11-12 |
| 8 | Every frame runs the content script. A frame other than the top one sends its Control state through the service worker to the top frame, which owns the gesture and draws the list | When the focus is inside an iframe (Google Docs, embedded players) the keys reach that frame only | 2026-11-12 |
| 9 | Where no content script answers (`chrome://` pages, the New Tab page, the Web Store, the PDF viewer, a tab whose script is not loaded), Ctrl+Tab switches straight to the previous tab. A popup-window switcher for these pages is milestone 3 | The quick toggle, the most common use, works everywhere from milestone 1 | 2026-11-12 |
| 10 | The service worker keeps the order from `tabs.onActivated`, `windows.onFocusChanged` (ignoring `WINDOW_ID_NONE`), `tabs.onRemoved` and `tabs.onReplaced`. The order lives in memory and is written whole to `storage.session` on every change. When that storage is empty it is seeded from `tab.lastAccessed` | Chrome stops the worker after 30 s idle; session storage outlives it and is cleared at browser restart, when tab ids change anyway. `lastAccessed` is approximate (QuicKey finds it unreliable after discards and moves), good enough as a seed | 2026-11-12 |
| 11 | Thumbnails come from `tabs.captureVisibleTab` 400 ms after a tab becomes active, its window gets the focus or its page finishes loading, queued (Chrome allows 2 captures a second), downscaled to 320 px JPEG and kept in `storage.session` under `thumb:<tabId>`. No capture while the list is open in that page or the window is not focused. A tab without one shows its favicon and title | An extension cannot capture a tab that is not visible, and a window behind another app may not be painted. The list must never end up in a picture | 2026-11-12 |
| 12 | Cycling does not activate tabs, so the order does not change during a gesture. The picked tab is recorded the moment it is activated | The list keeps its order while you move through it | 2026-11-12 |
| 13 | TypeScript, bundled by esbuild into classic scripts, Vitest, pnpm. The order and the gesture are pure modules with no Chrome or DOM calls, tested on their own | Content scripts cannot be ES modules. The parts with the logic can be tested without a browser | 2026-11-12 |
| 14 | The top frame asks the worker for the thumbnails once per gesture, when Control turns out to be held, instead of receiving them with every press | A quick tap costs no thumbnail traffic, and the further presses of a gesture stay light | 2026-11-12 |
| 15 | While the list is open, as in Cmd+Tab: moving the mouse over a card selects it, a click opens it, Enter opens the selection, Escape cancels. Only a real mouse movement selects. No arrow keys: Tab, Shift+Tab and the mouse move the selection | Marin asked for Cmd+Tab's behaviour. Chrome also sends pointer moves of zero when the page changes under a still mouse, which would steal the selection. *Revised the same day:* arrows were built, then dropped by Marin, because macOS takes Control with the arrows (Spaces, Mission Control) | 2026-11-12 |
| 16 | Revises 6. A press that reaches the page after Control's release, within 1 s of it, belongs to that hold: the page collects such presses for 80 ms, without showing the list, then opens the tab they lead to. Only a press with no release seen at all switches at once | Marin found that a fast Ctrl+Tab+Tab looped between the last two tabs. A stopped worker takes long enough to wake that both presses arrived after the release, and each counted as a quick tap. Late presses of one hold reach the page together, so 80 ms collects them | 2026-11-12 |
| 17 | The focused page pings the worker every 20 s, when its window gets the focus, and when Control goes down | Keeps the worker awake while Chrome is in use, so presses arrive in milliseconds. Control goes down before Tab, so a worker that did stop starts waking before the first press | 2026-11-12 |

## How it works

```
chrome.commands ──▶ service worker ──cycle──▶ content script, top frame ──▶ list in the page
                       ▲   │                        ▲
       tab events ─────┘   └─ activate ◀────────────┘ (on Control's release)
                                                     ▲
                    content script, other frames ────┘ Control's state, relayed by the worker
```

- `src/background.ts`: the order of the tabs, the commands, the switch to a tab, the relay between frames, the script injected into open tabs at install.
- `src/content.ts`: Control's state in every frame; in the top frame, the gesture and the list.
- `src/mru.ts`: the order as pure functions.
- `src/gesture.ts`: the gesture as a pure state machine (idle, holding, shown).
- `src/overlay.ts`: the list in a closed shadow root.
- `src/thumbnails.ts`: the captures, their queue and their storage.

## Milestones

1. **The switcher.** The order, both commands, the gesture, the list with favicon and title, the fallback toggle. Checked by hand in Chrome on macOS. Done 2026-11-12.
2. **Thumbnails and the mouse** (decisions 11, 14, 15). Checked by Marin. Done 2026-11-12.
3. **A popup-window switcher** where the content script cannot run (decision 9). Only if it is missed in use.
4. **Settings**, together with Marin: the delay, the size and look of the list, which tabs it shows, a minimum dwell time, search by typing.
5. **The Chrome Web Store**, if the developer mode is to go. A one-time 5 dollar registration. A privacy policy is required even though nothing leaves the browser, each permission needs a justification, and browsing data may be used only for the feature the listing describes. The store gives the extension a new id, so the binding snippet is run once more.

## Open questions

- ~~Does Control's keyup reach the page when Ctrl+Tab is bound to the extension?~~ Yes, checked by Marin on 2026-11-12.
- ~~macOS takes Control with the arrows before Chrome sees them. Turn those shortcuts off, or pick other keys?~~ No arrows (decision 15).
- ~~Ctrl+Tab or Option+Tab?~~ Ctrl+Tab, chosen by Marin on 2026-11-12: it matches Rider, and without arrows Option+Tab would only leave Chrome's own Ctrl+Tab free.
- A thumbnail shows the tab shortly after you arrived on it, not when you left it. Capturing at the start of a gesture would make it fresher, at the cost of a delay before a quick switch.
- Does the binding survive an update of Chrome? It survived the reloads of the extension on 2026-11-12.
- Does the popover show over a video in fullscreen, and how does it behave with a window in macOS fullscreen?
- Should a tab count as used only after a minimum time on it? QuicKey waits 1.25 s, so tabs passed through do not move up.
- Incognito windows: the extension does not see them unless allowed. Keep it that way?
- ~~Public or private repo?~~ Public, decided by Marin on 2026-11-12: MIT licence, a changelog, and the public scan of claude-kit on every push.
