# Timescreen 2 acceptance inventory

## Web welcome and project links
- Header middle shows subtle Github and MacOS links; each opens the official repository or latest release in a new tab.
- Fresh browser arrival opens a centered welcome explaining the README and the Mac app's ad-hoc signing / lack of Apple notarization.
- Close, Continue, Escape and backdrop dismiss it; reload and later visits do not repeat it in the same browser.
- Appearance → Display → About & installation can reopen the information without clearing clock settings.
- Native app launches do not show a download welcome over an unattended clock.
- Check desktop, 375px, 320px, light/dark and short-window layouts: no header overlap, modal content scrolls, close and continue remain reachable.
- Keyboard focus stays inside the modal while open; existing shortcuts do not change the clock behind it.
- Blocked browser storage must not crash the page; the limited embedded preview uses temporary memory.
- Replay existing browser interaction QA, then check welcome, both outbound links, dismissal and one clock flow on production.

## Existing display
- Open the live baseline at https://time.paulfleury.com before editing.
- Clock, seconds, date, UTC offset, sunrise/sunset, Earth and four world clocks render.
- Select a city through search, a world clock, or a globe label; local time and daylight follow it.
- Pause/resume rotation; drag, keyboard rotate, zoom and recenter the globe.
- Change light/dark mode, all palette families, textures, finishes and custom accent.
- Change picture sliders and each preset; reset picture without resetting the whole setup.
- Change 12/24-hour, seconds, labels, meridians, night lights, world clocks and layout.
- Enter and exit fullscreen; enter and exit quiet mode, including keyboard recovery.
- Copy and restore setup codes, including older time:v2 and solstice:v1 formats.
- Search with no matches, close dialogs by button/backdrop/Escape, traverse tabs by keyboard.
- Verify offline caching and the canvas fallback; console stays free of application errors.

## Requested style expansion
- Exactly 28 named scene designs, including the original Observatory.
- Matrix rain, Apple-inspired Cupertino, Google-inspired Spectrum, and 25 other treatments.
- Styles change composition, clock treatment or effects, not just the palette.
- Search and category filtering combine; clear filters restores all 28.
- Select each card, close the gallery and inspect the actual resulting clock.
- Choose a different palette without losing the selected scene.
- Shuffle selects a different scene; brackets move backward/forward.
- Reduced motion freezes ambient animation; hidden pages stop animation loops.
- Persist scene, effects and all legacy settings in portable setup codes.
- Inspect every scene at desktop and 375px, plus portrait, 10:3 and short-window samples.
- Verify contrast of secondary labels against the effective background.

## Native macOS
- Universal arm64 and x86_64 application, macOS 13+; signature verifies.
- Launch automatically requests https://time.paulfleury.com.
- A complete bundled copy works offline, without a server or a first online visit.
- Old/failed live versions fall back explicitly to the newer bundled copy.
- Native fullscreen is invoked by both the menu and website controls.
- Window geometry, selected setup and fullscreen preference survive relaunch.
- Menu-bar launcher reopens the window after close; Dock/Spotlight launch is supported.
- Always-on-top, prevent-display-sleep, start-fullscreen and login toggles are explicit.
- Sleep assertion releases when the window is hidden/closed or the app exits.
- Move to another display uses native screen bounds; disconnected displays recover.
- External HTTP(S) links open in the browser; arbitrary schemes and bridge origins are rejected.
- Setup messages are bounded; bundled paths reject traversal.
- Real WKWebView smoke checks validate content, bridge and native fullscreen.
- DMG mounts, contains the verified universal app and Applications link, and passes checksum checks.
- Document ad-hoc signing honestly; do not claim notarization or personal-device acceptance.

## Delivery
- Public source, README screenshots, topics, changelog, install guide and release stay in sync.
- Production uses FTPS only, never the hosting panel, and touches only the Time site.
- Verify live release marker and UI separately from local and private preview checks.
- Share DMG and installation note; list any remaining acceptance boundary.

## Version 2.1.0 additions
- Native Check for Updates opens Sparkle's window, not a browser release page.
- Settings exposes automatic checks and opt-in automatic download/install.
- The update feed and archive must authenticate with the pinned Ed25519 key.
- Invalid signed feeds fail closed; tampered archives cannot install.
- The test-only fixture completes a real download, replacement and relaunch without touching a user installation.
- Launch-at-login uses SMAppService, shows approval state, and remains off unless selected.
- Window position, size and physical display identity are saved after move/resize and before update/relaunch.
- Relaunch in a separate process restores the same placement; unplugged/rearranged monitor geometry remains reachable.
- Turning window memory off stops recording/restoring it; reset brings the window onto the current display.
- Scrollable Settings remains usable on a small screen and exposes the installed version.
- Existing v2.0.0 installations require a one-time 2.1.0 DMG replacement before future in-app updates.
- Update-signing authentication is not represented as Apple notarization.
