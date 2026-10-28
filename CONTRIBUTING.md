# Contributing

Small, focused improvements are welcome. Keep the interface quiet, preserve both the portrait-monitor and panoramic layouts, and do not add runtime trackers or unnecessary services.

1. Fork and clone the repository.
2. Run `npm ci && npm run build`.
3. Make the change and run `npm test`.
4. Check a 1080×1920 portrait monitor, 1920×576 panoramic view, a normal desktop viewport, and a phone.
5. Check light and dark modes, keyboard focus, reduced motion, and the relevant fallback behavior.

Use issues for a concise bug report or feature proposal. Include the device/browser, viewport, chosen theme/picture settings, reproduction steps, and a screenshot if useful.

Do not commit acquired Satoshi/texture binaries, FTP credentials, `.env` files, or local deployment state. The explicitly distributed SIL fonts must retain their license files. Follow [asset licensing](docs/ASSETS.md), and keep `CHANGELOG.md`, screenshots, and tests synchronized with visible changes.

## Adding a scene

Add its metadata to `public/scenes.js`, a distinct composition or clock treatment in `public/scenes.css`, and a bounded procedural effect only if needed in `public/ambient.js`. Keep the underlying clock text accessible, preserve independent palette selection, respect reduced motion, and inspect desktop, 375px, portrait and panoramic layouts.

Do not add vendor logos, unlicensed proprietary fonts, flashing effects or remote image dependencies. Update the scene counts, screenshots and tests when changing the collection.

## Native changes

Keep the bridge small and origin-checked. Test with `macos/Tests/NativeTests.swift`, build both architectures, run the real WKWebView smoke test and verify the DMG using the same scripts as CI.

Release version strings in `package.json`, the native policy, Info.plist, app metadata, cache name and package filenames must stay synchronized. The test suite checks the core version markers; do not ship a mismatched website and bundle.
