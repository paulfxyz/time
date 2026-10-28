# Timescreen 2.0.0

Your spare screen now has a native home on macOS. Timescreen opens the live website automatically and includes a complete offline copy, with 28 distinct scene designs and the existing 60 light/dark colour palettes.

## Get the Mac app

Download **Timescreen-2.0.0-macOS-universal.dmg**, open it, and drag Timescreen into Applications. The same app runs on Apple silicon and Intel Macs with macOS 13 or newer.

This build is **ad-hoc signed, not Apple-notarized**. If macOS blocks the first launch, use System Settings → Privacy & Security → Open Anyway after attempting to open it. Only proceed if you trust the official download; do not disable Gatekeeper globally.

## New in this release

- **A native Mac window:** AppKit, WKWebView, native fullscreen, menu-bar launcher and remembered window position.
- **Made for multiple monitors:** move to another display, always-on-top, optional start-in-fullscreen and optional display wake lock.
- **Offline from the first launch:** bundled application resources, with no Node, Electron runtime or local web server.
- **28 scene designs:** Matrix, Cupertino, Spectrum, Split-flap, Terminal, Swiss, Bauhaus, Tokyo neon, Outrun, Nixie, Blueprint, Sonar, Mission control, Eclipse, Aurora, Liquid chrome, Candy, Memphis, Mondrian, Noir, Sunday paper, Zen, Deep ocean, Forest, Desert, Solar flare, Pixel arcade and the original Observatory.
- **Independent colour control:** each scene works with all 60 paired palettes, picture controls and portable setup codes.
- **A searchable gallery:** category filters, illustrated previews, shuffle, and previous/next style shortcuts.
- **Considerate motion:** bounded ambient animation, reduced-motion support and hidden-page suspension.
- **Preserved essentials:** accurate IANA clocks, calculated sunlight, Earth navigation, city search and portrait/panoramic layouts.

## Important details

Cupertino and Spectrum are independent visual tributes, not Apple or Google products. Sunrise/sunset values are estimates, and Earth imagery is a static composite rather than a live camera feed.

View shows whether the live website or built-in copy is active. If the site is unavailable or older than the app, the newer built-in version opens automatically; Reload Live Site retries it.

Check for Updates opens the official releases page. There is no silent binary updater, telemetry, account requirement, or automatic login registration.

See [the installation guide](https://github.com/paulfxyz/timescreen/blob/main/INSTALL.md) and [verification notes](https://github.com/paulfxyz/timescreen/blob/main/QA.md) for the tested scope and remaining personal-device checks.
