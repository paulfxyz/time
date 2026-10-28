# Timescreen QA inventory

## Version 2.1.0

The update/startup/window release adds native verification without changing the 28 clock styles. It was checked on 28 October 2026 with the following results.

- **Automated checks:** 26 Node tests and 34 native policy/geometry assertions pass, plus the existing 47 browser interaction checks.
- **True window relaunch:** the actual app saves a moved/resized window, quits, and launches in a separate process with the same isolated preferences. Its position and size are compared against the saved record before the remaining clock/fullscreen smoke checks run.
- **Display geometry:** tests cover the exact original position, rearranging the same physical monitor, disconnecting a monitor, shrinking the available resolution, missing displays and corrupt saved bounds.
- **Native Settings:** the real window exposes update checks, automatic download/install, launch at login, window memory/reset and the existing display options. A native screenshot was inspected, including scrolling on a short display.
- **Real update installation:** a disposable macOS fixture uses the actual Sparkle framework to fetch a signed ZIP, extract it, replace version 1 with version 2 and relaunch. Its installed bundle version and code signature are checked after replacement.
- **Tamper rejection:** the same fixture rejects a modified signed feed before extraction and a modified archive before installation. The fixture uses a fresh test key; the production signing secret is not used for these tests.
- **Production signatures:** the release ZIP and mandatory-signed feed are generated with the repository's encrypted signing secret and verified by Sparkle's signing tool. The ZIP signature is also independently checked with Node's Ed25519 verifier.
- **Privacy and boundaries:** automatic installation and login launch are opt-in, profile reporting is off, the native updater has no web-message command, and web setup codes cannot alter updater preferences.

The framework installation test does not claim that a real future Timescreen release has already been installed on the user's Mac. macOS Login Items approval, first-open Gatekeeper policy and physical monitor arrangements still need acceptance on that destination device.

To run the real updater fixture after the native build:

```sh
node macos/scripts/test-updater.mjs
```

The fixture touches only its generated `build/updater-verification/Fixture.app`. It never overwrites `/Applications/Timescreen.app` and never uses the production private key.

## Version 2.0.0

Verified on 28 October 2026. The HTML5 clock is tested independently of the native host; native checks run in a real macOS WKWebView, not an Electron mock.

- **Model/configuration tests:** 22 passing Node tests covering time zones, solar calculations, scene metadata, version alignment, picture controls and offline assets.
- **Interactive browser checks:** 47 passing assertions in `tools/qa-web.mjs`, covering style search, combined filters, shuffle, independent colours, display toggles, all six Earth finishes, city search, picture presets, keyboard input, persistence, legacy setup restoration and fullscreen.
- **Scene render review:** all 28 scenes captured and visually inspected at 1440×900 and 375×812, with no detected document overflow, clipped clock digits or page exceptions.
- **Additional layouts:** 48 sampled layouts across 1920×576, 1080×1920, 540×1800, 1024×480, 420×438 and 320×568. A cramped centred-clock layout was corrected and 10 small-window cases were rechecked; very narrow world clocks use a separate metadata row.
- **Offline web:** a previously cached clock reloads without network access, including its textured WebGL Earth and selected style.
- **Returning visitors:** first-party JavaScript and CSS URLs carry the release version, and the service worker caches those same versioned URLs; this prevents a fresh HTML document from being paired with a previously cached script.
- **Reduced motion:** both the ambient canvas and Earth viewpoint remain still even when a saved setup requests an orbit.
- **Failure recovery:** forced WebGL unavailability uses the geographic Canvas renderer; denied clipboard access exposes a selectable setup code; denied fullscreen shows guidance and exits cleanly.
- **Native trust tests:** 25 passing Swift assertions for allowed origins, external links, size-limited setup data, resource paths, traversal rejection and safe JSON dispatch.
- **Native application:** both arm64 and x86_64 compile successfully. The macOS runner renders Matrix, Cupertino and Spectrum in the bundled WKWebView, validates saved setup messages, and enters/exits actual native fullscreen.
- **Installer:** the application signature passes `codesign --verify --deep --strict`; `lipo` verifies both slices. The DMG is created, checksum-verified, mounted read-only, and checked for the app, intact binary and Applications link.
- **Dependency audit:** no known vulnerabilities reported by the checked lockfile's `npm audit`.

The native fullscreen test originally exposed an asynchronous entry/exit race. The application now gates overlapping transitions and the test waits for native completion rather than only checking the early window style flag.

### Reproduce the checks

```sh
npm ci
npm run build
npm test
npm start
# In another terminal:
npx playwright install chromium
node tools/qa-web.mjs
```

On macOS, build the app and run its actual native smoke mode:

```sh
npm run build:mac
build/Timescreen.app/Contents/MacOS/Timescreen --smoke-test "$PWD/build/verification"
npm run build:dmg
```

The smoke run uses isolated preferences and non-persistent WebKit storage. Adding `--live-site` tests the live-first startup path and records whether it used the live site or a declared fallback.

### Acceptance boundaries

The universal binary is built for both processor families, but that is not a claim of hands-on execution on every Intel and Apple silicon Mac. Physical multi-monitor transitions, user-specific login-item approval, managed-Mac policy, Gatekeeper first-open and long-running display behaviour still need acceptance on the destination Mac.

The release is ad-hoc signed and deliberately documented as not notarized. Native smoke checks do not waive the user's first-launch security approval.

## Required experience

- Real local time advances, uses the device clock, supports city selection and DST-aware IANA zones.
- Animated Earth is recognizably geographic, rotates smoothly, and shows clock-driven sunlight rather than an artificial accelerated solar cycle.
- Layout fits 10:3 ultrawide, ordinary desktop, mobile, and vertical displays without clipping essential regions.
- Light and dark modes, 60 working theme presets, eight background patterns, and six Earth finishes.
- Fullscreen control uses native fullscreen when permitted, with quiet-mode fallback when embedded.

## Controls and states

- Appearance open/close, backdrop dismissal, Escape dismissal, tab navigation and theme selection.
- Every theme in both modes, custom accent, pattern selection, Earth finish selection.
- Pause/resume, rotation speed, drag, wheel zoom, keyboard arrows, recenter.
- City search, no-results state, country/accent search, city selection, device time zone, globe labels, world clock selection.
- Time format, seconds, city labels, night lights, meridians, world clocks, automatic/panoramic/vertical layout.
- Quiet mode with always-recoverable controls, fullscreen entry/exit, blocked fullscreen fallback.
- Wake lock request and unavailable-permission state.
- Reset, setup-code clipboard success or manual-copy fallback, restore valid/invalid codes, reload from setup hash.

## Functional checks

- Node tests: theme count, time zones, solar declination, day/night geography, leap years, date rollover, DST, polar day/night.
- Browser inputs exercise all controls and complete reversible cycles.
- At least one stable animation interval, clock rollover, pause interval and restart.
- Textures, scripts, and fonts load from the site's own bundled assets.

## Visual checks

- 1920 × 576, 1600 × 900, 375 × 812, and 540 × 1800.
- Dark and light initial states.
- Theme drawer, city drawer, blueprint/pattern state, mobile drawer and quiet mode.
- Check document AND clock, globe, world-clock region bounds.
- No console exceptions, clipped digits, overlapping controls, invisible globe, unreadable theme labels, or broken imagery.

## Off-happy-path checks

- WebGL unavailable: actual geographic 2D fallback remains usable.
- Invalid setup hash uses safe defaults.
- Unknown system time zone city: clock remains accurate; unlocated solar estimates are hidden.
- Wake lock, fullscreen or clipboard denied: inline recovery without crashing.
- Reduced motion starts with orbit paused.

## Initial MVP verification

Completed on 2 October 2026 in Chromium.

- All 11 Node model/configuration tests pass.
- All 28 theme buttons exercised in both light and dark mode.
- All eight patterns and six finishes exercised through the visible controls.
- Clock advancement, continuous rotation, pause/resume, drag, zoom, keyboard movement, and recenter verified.
- City search, empty results, accent-insensitive results, world-clock selection, UTC, and device-zone reset verified.
- Format and visibility switches, URL restoration, custom accent, reset, and wake-lock feedback verified.
- Native fullscreen and blocked-fullscreen fallback exercised; the fallback exits using F, H, or Escape.
- Clipboard-denied recovery presents a selectable portable setup code rather than an expiring preview URL.
- WebGL-disabled route renders a geographic canvas globe. Unknown device-city coordinates hide solar estimates instead of inventing them.
- Reduced-motion preference starts with automatic rotation off; invalid setup parameters fall back safely.
- Layout bounds checked after resize settlement at 1920 × 576, 1600 × 900, 375 × 812, 540 × 1800, and 1280 × 384. No document overflow or out-of-bounds essential regions.
- Dark/light desktop, mobile, tall layout, theme drawer, blueprint finish, and 2D fallback screenshots inspected.
- Exploratory checks caught and fixed a mirrored longitude projection, a mobile grid-row collapse, and wheel events intercepted by city labels.
- No uncaught browser errors in the final local checks.

The globe's viewing animation is intentionally faster than Earth’s physical rotation. The solar calculation always follows the device clock; the app does not accelerate the day/night cycle. Browsers may still deny native fullscreen or screen wake lock in an embedded preview.

Publication preparation: the external Fontshare stylesheet was replaced with unmodified self-hosted WOFF2 files, under the official ITF license's express own-site self-hosting permission. No automatic third-party font request remains.

## Version 1.1.0

- All 16 model/configuration tests pass, including the expanded 60 paired themes, picture ranges/presets, header controls, and fullscreen manifest.
- Brightness, contrast, colour, and temperature were exercised at both slider endpoints using keyboard input. All four picture presets and reset were exercised.
- The Light dialog and top toolbar remain outside the display filter and readable at minimum brightness.
- Theme search and no-results behavior pass. New OLED, Whiteout, Olive, Cobalt, Orchid, Terminal, and Blue marble selections were exercised.
- Native fullscreen entry/exit updates the top-right caption correctly. Denied fullscreen opens device guidance, and display-mode exit remains usable.
- New `time:v2:` codes restore picture controls. Old `solstice:v1:` codes remain compatible.
- The service worker activated successfully. Reloading with the browser offline rendered the clock and textured WebGL globe, with no missing-texture notice.
- Bounds checked at 1920×576, 1600×900, 1024×768, 390×844, 320×568, and 540×1800. No document overflow or clipped essential regions.
- At 320×568, 12-hour world-clock labels and values do not overlap.
- Desktop dark/light, theme drawer, picture panel, mobile main view, and mobile picture controls were inspected and captured.
- Browser automation used Chromium, including responsive layouts and permission-denial simulations. These are not claims of hands-on tests on physical iPhones, Android phones, or TV hardware.
- The repository excludes separately licensed font/texture binaries and original source assets. The bootstrap verifies pinned upstream hashes instead.

## Version 1.1.1

- The public repository is now named Timescreen; the application interface and existing setup codes are unchanged.
- All 16 model/configuration tests pass. The static build completes and the dependency audit reports no known vulnerabilities.
- New 1080×1920 portrait screenshots were captured and visually inspected in light and dark modes, using Chromium with the Europe/Lisbon time zone.
- The portrait page loaded the textured globe without uncaught browser errors or document overflow.
- Installation instructions, screenshot paths, repository links, and release metadata were checked for the Timescreen name.
