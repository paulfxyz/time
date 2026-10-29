# Changelog

## Mobile navigation refinement · 2026-10-29

- Removed the GitHub/Mac link pill from narrow headers and restored readable Light and Appearance labels.
- Added a bottom-right More button that opens a compact, bottom-aligned sheet with large README and Mac download rows.
- Shortened the welcome, kept the signing warning visible, and placed detailed Mac instructions in an expandable section.
- Reopening the sheet resets expanded help and returns keyboard focus to its trigger on dismissal.
- Preserved desktop header links, remembered dismissal and the existing 2.1.0 Mac installer.

## Web refresh · 2026-10-29

- Added centered, floating Github and MacOS links without changing the clock layout.
- Added a dismissible first-visit welcome with README/release links and clear ad-hoc signing, Apple notarization and first-launch security guidance.
- Remembered dismissal per browser and added Appearance → Display → About & installation to reopen the welcome; native launches remain uninterrupted.
- Adapted the header and scrollable modal for narrow screens, retained quiet-mode behavior, and refreshed the offline cache.
- This is a website-only refresh. The published macOS installer remains version 2.1.0.

## 2.1.0 · 2026-10-28

- Replaced the browser-only update link with a native Sparkle update window, available in the application menu, menu-bar launcher and Settings.
- Added automatic checks and opt-in automatic downloading/installing, with installation on quit or explicit Install and Relaunch.
- Added mandatory Ed25519 signatures for update feeds and archives, pre-extraction validation, an encrypted release-signing secret, and a checksum-pinned Sparkle framework.
- Added explicit window-memory controls using physical display identity, position and size, monitor-disconnect recovery, and a reset action.
- Made launch-at-login approval/status visible and grouped native Settings into updates, startup/window and display/access.
- Added cross-process window restoration checks and updater verification fixtures; retained all 28 scenes and 60 palettes.
- Kept web compatibility separate from native versioning so a native-only update does not unnecessarily reject a compatible live clock.

## 2.0.0 · 2026-10-28

- Added a universal native Swift/AppKit macOS app with a WKWebView clock, native fullscreen, window restoration, menu-bar launcher and display selection.
- Added optional always-on-top, keep-display-awake, start-fullscreen and login-launch preferences; login registration remains off by default.
- Automatically loads the live Time website, with a complete bundled offline fallback and native setup persistence across both sources.
- Added 28 visual scene compositions, a searchable/category-filtered gallery, shuffle and previous/next style controls. Preserved all 60 paired colour palettes.
- Added 13 procedural ambient treatments plus no-effect scenes, with reduced-motion and hidden-page handling; capped globe rendering on high-refresh displays.
- Added SIL-licensed monospace/editorial clock faces, split-flap panels, Nixie glow, outlined neon, chrome and dot-matrix treatments.
- Added local web preference persistence and same-page setup-fragment navigation while preserving legacy setup codes.
- Versioned all first-party script and stylesheet URLs so returning visitors receive the new gallery even when old browser assets are still cached.
- Added native origin/path-policy tests, a real WKWebView/fullscreen smoke test, universal-build checks, DMG verification and reproducible browser interaction QA.
- Refreshed the public showcase, README, install/security notes, release packaging and repository topics.
- Updated the HTML5 deployment through the approved, hash-guarded FTPS path; unrelated hosted sites remain out of scope.

## 1.1.1 · 2026-10-02

- Published the project under its canonical repository name, **Timescreen**, preserving the existing history and release.
- Added the original motivation: an elegant fullscreen HTML5 clock for an otherwise-unused vertical monitor in a three-screen setup.
- Added portrait-monitor screenshots, refreshed badges and repository metadata, and expanded installation and contributor documentation.
- Preserved the existing clock interface, setup-code compatibility, features, and MIT license.

## 1.1.0 · 2026-10-02

- Expanded from 28 to 60 themes, each in light and dark mode, with theme search.
- Added brightness, contrast, colour, and colour-temperature controls.
- Added Standard, Cinema, Vivid, and Night picture presets.
- Removed the header brand and caption. The header now contains only Light, Appearance, and Enter / Exit full screen.
- Added native and WebKit fullscreen handling, clear restricted-browser recovery, and device-specific setup guidance.
- Added a fullscreen/standalone home-screen manifest, app icons, and network-first offline caching on supported standalone hosts.
- Extended portable setup codes with picture preferences; earlier MVP codes remain compatible.
- Prepared public MIT source, third-party asset bootstrap/attribution, CI, and a manually triggered verified-FTPS deployment workflow.

## 1.0.0 · 2026-10-02

- Initial Solstice MVP: live clock, calculated sunlight, a rotating textured globe, 28 paired themes, eight patterns, and six Earth finishes.
- Added city selection, sunrise/sunset estimates, world clocks, keyboard controls, quiet mode, and a 2D rendering fallback.
