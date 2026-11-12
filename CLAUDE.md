# tab-switcher

A Chrome MV3 extension that makes Ctrl+Tab an MRU tab switcher with a list drawn in the page. Product, decisions, milestones and open questions: `SPEC.md`. Install and the shortcut binding: `README.md`.

Status (2026-11-12): milestone 1 checked by Marin in Chrome on macOS. Milestone 2 (thumbnails, mouse) checked by Marin. The fix for fast presses (SPEC decisions 16, 17) passes the unit and smoke tests, not yet checked by hand.

## Layout

```
SPEC.md               decisions, milestones, open questions
CHANGELOG.md          what changes for whoever uses the extension
static/manifest.json  copied into dist/ as is; its `key` fixes the extension id
static/icons/         the icon's PNGs, rendered from assets/icon.svg by `pnpm icons` and committed
assets/icon.svg       the icon's source: the switcher in miniature, in the list's colours
assets/demo.gif       the README's demo, recorded in Chrome for Testing with public sites only
scripts/build.mjs     esbuild: src/background.ts and src/content.ts into dist/ as classic scripts
src/background.ts     the service worker: the MRU order, the commands, the switch, the frame relay
src/content.ts        every frame tracks Control; the top frame runs the gesture and the list
src/overlay.ts        the list: a popover host with a closed shadow root
src/thumbnails.ts     captures of the visible tab, their queue and storage.session
src/gesture.ts        the gesture as a pure state machine
src/mru.ts            the order as pure functions
src/messages.ts       the messages between worker and frames
scripts/check-public.sh  the public scan, a copy of the one in MarinCervinschi/claude-kit (edit it there)
.githooks/pre-push    runs the scan on every push
```

## Commands

First time in a clone: `git config core.hooksPath .githooks`, so the scan runs on every push.

| | |
|---|---|
| `pnpm install` | dependencies |
| `pnpm test` · `pnpm typecheck` · `pnpm format` | Vitest, tsc, Prettier |
| `pnpm build` · `pnpm dev` | a clean build into `dist/`, or a rebuild on every change |
| `pnpm icons` | renders `assets/icon.svg` into `static/icons/` at 16, 32, 48 and 128 px |
| `scripts/check-public.sh` | the scan the pre-push hook runs, on every file a commit would carry |

## Rules

- **Logic stays pure.** What decides (the order, the gesture) lives in `mru.ts` and `gesture.ts`, with no Chrome or DOM calls, and has tests. The other files wire events to it.
- **Listeners on the top level of the worker, synchronously.** An event that wakes the worker reaches only the listeners added in its first turn.
- **The worker keeps no state only in memory.** Anything it needs after being stopped goes to `storage.session`.
- **The page is hostile.** The content script listens in the capture phase, ignores untrusted events, never takes the focus, and styles its host inline with `!important`. Sizes in px, not rem.
- **A new permission or a change to the gesture needs a decision in `SPEC.md` first.**
- **`CHANGELOG.md` says what changes for whoever uses the extension**: a change to what it does, its shortcuts, its permissions or its requirements adds a line under `## Unreleased` in the same commit. Internal changes stay out.
- **Public repo.** No secrets, tokens, IPs, machine paths, emails or private names. Nothing about the author's employer, its clients or its products, screenshots included: take them with neutral tabs.
- **No em-dash** in anything written: docs, comments, commit messages.
- **Commits only when Marin asks**, each one confirmed. No pushes, PRs or releases without his explicit OK.

## Skills

From the `method` plugin of claude-kit, enabled in `.claude/settings.json`.

- Adding a file, a module or an abstraction → `method:design-principles`
- Writing or changing a comment → `method:code-comments`
- Text someone else reads (README, UI text, commit messages) → `method:plain-writing`
- Deciding a milestone → `method:spec-interview`; a decision with open points → `method:grill-me`
- A finished change about to be committed → `method:pre-pr-checklist`
