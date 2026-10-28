# Timescreen 2.1.0

This release makes Timescreen easier to keep current and brings the clock back where you left it. The 28 styles and 60 colour palettes remain unchanged.

## New in 2.1.0

- **Check for Updates:** a real native update window replaces the browser link. Find it in the Timescreen menu, menu-bar launcher or Settings.
- **Automatic updates:** enable “Automatically download and install updates” in Settings. Sparkle downloads verified updates in the background and completes installation when the app quits, or you can choose Install and Relaunch.
- **Signed distribution:** both the update feed and update archives are Ed25519-signed and checked against the app's pinned key. Invalid feeds are not allowed to fail open, and archives are checked before extraction.
- **Launch at login:** the dedicated setting uses macOS Login Items and shows whether it is enabled or waiting for system approval.
- **Remember position, size and display:** enabled by default, with explicit controls and a reset action. Moving the window, resizing it, changing monitor arrangement or disconnecting a monitor no longer leaves it inaccessible.
- **Clearer settings:** a native, scrollable Settings window groups updates, startup and display controls and shows the installed version.

Automatic checks are enabled by default, with a six-hour interval. Automatic download/install and launch at login remain opt-in; no system profile is sent.

## Install once to enable future in-app updates

Users of 2.0.0 need to download **Timescreen-2.1.0-macOS-universal.dmg**, quit the old app and replace it in Applications. Version 2.0.0 did not include an installer/updater, so it cannot install this first updater-enabled release by itself.

The universal app supports Apple silicon and Intel on macOS 13 or newer. Existing settings are retained, and the old window-position preference is migrated when possible.

This app is **ad-hoc signed, not Apple-notarized**. Signed update files do not turn the app into an Apple-notarized application; if macOS blocks first launch, follow [Apple's per-app Open Anyway instructions](https://support.apple.com/en-us/102445) only if you trust the official download.

## Settings to use

Open Timescreen → Settings, or press Command-comma. Enable automatic updates and launch at login if desired; “Remember window position, size and display” is already on.

Native fullscreen and all clock controls remain available. Closing the clock window leaves the menu-bar launcher running, while Command-Q quits and allows a downloaded automatic update to install.

See [installation instructions](https://github.com/paulfxyz/timescreen/blob/main/INSTALL.md), [security details](https://github.com/paulfxyz/timescreen/blob/main/SECURITY.md), and the [verification scope](https://github.com/paulfxyz/timescreen/blob/main/QA.md).
