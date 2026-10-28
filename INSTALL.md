# Install Timescreen

Timescreen is available as a native Swift macOS application and a standalone HTML5 clock. Both share the same styles and display controls; it is not a macOS `.saver` plugin.

## Install the Mac app

1. Download `Timescreen-2.1.0-macOS-universal.dmg` from the [official releases](https://github.com/paulfxyz/timescreen/releases/latest).
2. Open the DMG and drag **Timescreen** to **Applications**.
3. Eject the installer, then open Timescreen from Applications or Spotlight.
4. Choose a style in Appearance and use `Control` + `Command` + `F` for native fullscreen.

The universal app requires macOS 13 or newer and runs on Apple silicon and Intel. No Node.js, separate browser or runtime installation is needed.

### First-launch security

This build is ad-hoc signed, not Apple-notarized. macOS can block the first launch because it is not signed with a Developer ID certificate.

If you trust the official release, attempt to open it, then visit **System Settings → Privacy & Security → Open Anyway**, and confirm Open. [Apple documents this exception process](https://support.apple.com/en-us/102445); managed Macs can restrict it, and you should never disable Gatekeeper globally.

`SHA256SUMS.txt` accompanies the release. To check an installer in Downloads, compare its digest with that file:

```sh
shasum -a 256 ~/Downloads/Timescreen-2.1.0-macOS-universal.dmg
```

### Make it easy to open

- **Dock or Spotlight:** keep the application in your Dock, or search for Timescreen.
- **Menu bar:** the clock icon stays available when the window is closed; Command-Q quits the app.
- **Login:** enable Settings → Launch Timescreen when I log in only if wanted, after moving it to Applications. A status line reports whether macOS needs your approval.
- **Fullscreen at launch:** enable it in Settings; the website and native menu fullscreen controls both use native Mac fullscreen.
- **Another monitor:** choose Window → Move to Display.
- **Always on top / keep awake:** optional View-menu controls; the display sleep assertion releases when the clock is hidden, minimised, closed or quit.

The native app automatically opens `https://time.paulfleury.com`. If the site is unavailable or older than the app, it opens its complete built-in copy; the View menu shows the active source and provides **Reload Live Site** and **Use Built-in Offline Version**.

Your setup is saved locally. **Remember window position, size and display** is on by default, preserves the same monitor after rearrangement, and safely falls back to an available display when the original is disconnected; Settings also offers a reset action.

### Check for updates and enable automatic updates

Choose **Timescreen → Check for Updates**, the same item in the menu-bar launcher, or the button in Settings. The native Sparkle window checks the signed release feed, offers a newer version when available and can download, install and relaunch it.

Automatic checks are enabled by default and run every six hours. In Settings → Updates, enable **Automatically download and install updates** to download verified updates in the background and finish installation when the app quits; you can instead install and relaunch immediately from the update window.

Both the feed and the update archive must pass Ed25519 signature verification against the key embedded in the app. Automatic installation remains off until you opt in, and no system profile is sent.

### Upgrade from 2.0.0

Install the 2.1.0 DMG once, replacing the old app after quitting it. The 2.0.0 release only opened a download page and cannot install this first updater-enabled version by itself; settings are retained when the app is replaced.

### Build the native app

After the source/web setup below, on a Mac with Xcode Command Line Tools:

```sh
npm run build:mac
npm run build:dmg
```

The scripts compile arm64 and x86_64, combine them with `lipo`, bundle the offline clock, ad-hoc sign the app and create a verified drag-to-install DMG. Build products appear in `build/`.

## From source

Use Node.js 22 or newer and npm:

```sh
git clone https://github.com/paulfxyz/timescreen.git
cd timescreen
npm ci
npm run build
npm start
```

Open `http://localhost:3000`. On first build, the asset script downloads the separately licensed fonts and Earth textures from their original hosts, checks their hashes, and prepares the static site.

An Internet connection is needed for the first installation and asset setup. Once the site is built, no Node.js process or backend is needed on a production host.

## On your vertical monitor

1. Move the browser window to the display you are not using.
2. Choose a theme in **Appearance**.
3. If needed, set Appearance → Display → Layout to **Vertical**.
4. Adjust the page brightness and colour in **Light**.
5. Click **Enter full screen**, or press **F**.
6. Press **H** for quiet mode; use **Escape** or the restore control to bring the interface back.

Fullscreen and screen wake lock depend on your browser and device. On a browser that does not allow native fullscreen, follow the device guidance shown by the app.

## Static hosting

After `npm run build`, upload the contents of `public/` to an HTTPS host:

- Put `index.html` directly in the site's document root.
- Keep the `assets/` folder and relative filenames intact.
- Include `.htaccess` on Apache-compatible hosts; configure equivalent headers and MIME types on other servers.
- Do not upload the entire source repository or any credential files.
- Refresh the page and check `release.json` if you need to confirm the deployed build.

The optional GitHub Actions FTPS workflow is documented in [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md). It is not required to run or host Timescreen.

## A phone or tablet

Timescreen includes a home-screen app manifest and offline support. On iPhone, follow [Apple's Add to Home Screen / Open as Web App instructions](https://support.apple.com/guide/iphone/open-as-web-app-iphea86e5236/ios); on supported Android browsers, use Install app or Add to Home screen.

Load the complete app online once before relying on it offline. The clock uses the device's time, so keep the operating-system clock correct.

## Common questions

- **The page looks wrong when opened as a local file:** use `npm start` or another HTTP server. Browser security restrictions can block JavaScript modules and textures under `file://`.
- **The asset build reports a hash mismatch:** the upstream file changed. Review the change before updating its pinned digest; do not bypass the check blindly.
- **Native fullscreen does not open:** use the browser's fullscreen command or the app's home-screen installation guidance. A website cannot override operating-system restrictions.
- **The globe uses the simpler renderer:** this is the Canvas fallback for a browser without usable WebGL. The clock and sunlight calculation continue to work.
- **A very dim preset is hard to see:** the Light panel stays outside the display filter. Open it and choose Reset picture.
- **I want my setup on another screen:** use Copy setup, then Restore setup on the other device. Current `time:v2:` codes and earlier `solstice:v1:` codes are supported.

## Licensing

The original application code is MIT-licensed. Fonts, textures, and bundled icons retain their own terms; read [docs/ASSETS.md](docs/ASSETS.md) before redistributing a build.
