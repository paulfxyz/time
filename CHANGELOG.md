# Changelog

## 2.0.0 · 2026-10-28

- Added a universal native Swift/AppKit macOS app with a WKWebView clock, native fullscreen, window restoration, menu-bar launcher and display selection.
- Added optional always-on-top, keep-display-awake, start-fullscreen and login-launch preferences; login registration remains off by default.
- Automatically loads the live Time website, with a complete bundled offline fallback and native setup persistence across both sources.
- Added 28 visual scene compositions, a searchable/category-filtered gallery, shuffle and previous/next style controls. Preserved all 60 paired colour palettes.
- Added 13 procedural ambient treatments plus no-effect scenes, with reduced-motion and hidden-page handling; capped globe rendering on high-refresh displays.
- Added SIL-licensed monospace/editorial clock faces, split-flap panels, Nixie glow, outlined neon, chrome and dot-matrix treatments.
- Added local web preference persistence and same-page setup-fragment navigation while preserving legacy setup codes.
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
