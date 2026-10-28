#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/../.."
[[ "$(uname -s)" == Darwin ]] || { echo "A Mac with Xcode Command Line Tools is required."; exit 1; }
OUT="$PWD/build"
VERSION="$(node -p 'require("./package.json").version')"
APP="$OUT/Timescreen.app"
rm -rf "$APP"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources" "$APP/Contents/Frameworks" "$OUT/AppIcon.iconset"
test -s public/release.json || { echo "Run npm ci && npm run build first."; exit 1; }
node macos/scripts/setup-sparkle.mjs
SPARKLE="$OUT/vendor/sparkle"
SDK="$(xcrun --sdk macosx --show-sdk-path)"
for ARCH in arm64 x86_64; do
  xcrun swiftc -swift-version 5 -O -sdk "$SDK" -target "$ARCH-apple-macos13.0" \
    -framework AppKit -framework WebKit -framework ServiceManagement -framework IOKit \
    -F "$SPARKLE" -framework Sparkle -Xlinker -rpath -Xlinker @executable_path/../Frameworks \
    macos/Sources/NativePolicy.swift macos/Sources/BundleScheme.swift macos/Sources/WindowPlacement.swift \
    macos/Sources/UpdateManager.swift macos/Sources/Settings.swift macos/Sources/main.swift \
    -o "$OUT/Timescreen-$ARCH"
done
lipo -create "$OUT/Timescreen-arm64" "$OUT/Timescreen-x86_64" -output "$APP/Contents/MacOS/Timescreen"
cp macos/Resources/Info.plist "$APP/Contents/Info.plist"
test "$(/usr/libexec/PlistBuddy -c 'Print :CFBundleShortVersionString' "$APP/Contents/Info.plist")" = "$VERSION"
ditto "$SPARKLE/Sparkle.framework" "$APP/Contents/Frameworks/Sparkle.framework"
cp "$SPARKLE/LICENSE" "$APP/Contents/Resources/Sparkle-LICENSE.txt"
# Resources are inert, local application data, served only through the bounded
# WKURLSchemeHandler. There is no local HTTP server or Node/Electron runtime.
ditto public "$APP/Contents/Resources/Web"
cp LICENSE "$APP/Contents/Resources/LICENSE.txt"
cp docs/ASSETS.md "$APP/Contents/Resources/Third-Party-Notices.md"
for SIZE in 16 32 128 256 512; do
  sips -z "$SIZE" "$SIZE" public/assets/app-icon-1024.png --out "$OUT/AppIcon.iconset/icon_${SIZE}x${SIZE}.png" >/dev/null
  DOUBLE=$((SIZE * 2))
  sips -z "$DOUBLE" "$DOUBLE" public/assets/app-icon-1024.png --out "$OUT/AppIcon.iconset/icon_${SIZE}x${SIZE}@2x.png" >/dev/null
done
iconutil -c icns "$OUT/AppIcon.iconset" -o "$APP/Contents/Resources/AppIcon.icns"
plutil -lint "$APP/Contents/Info.plist"
codesign --force --sign - --timestamp=none "$APP"
codesign --verify --deep --strict --verbose=2 "$APP"
lipo "$APP/Contents/MacOS/Timescreen" -verify_arch arm64 x86_64
ditto -c -k --sequesterRsrc --keepParent "$APP" "$OUT/Timescreen-$VERSION-macOS-universal.zip"
echo "Universal Timescreen application built and ad-hoc signature verified."
