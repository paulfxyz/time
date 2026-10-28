#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/../.."
OUT="$PWD/build"
APP="$OUT/Timescreen.app"
STAGE="$OUT/dmg-stage"
IMAGE="$OUT/Timescreen-2.0.0-macOS-universal.dmg"
test -d "$APP" || { echo "Build the app first."; exit 1; }
mkdir -p "$STAGE/.background"
ditto "$APP" "$STAGE/Timescreen.app"
ln -sfn /Applications "$STAGE/Applications"
cp "$APP/Contents/Resources/AppIcon.icns" "$STAGE/.VolumeIcon.icns"
cp macos/INSTALL.txt "$STAGE/Start here.txt"
node macos/scripts/installer-art.mjs
cp "$OUT/installer-background.png" "$STAGE/.background/installer.png"
hdiutil create -ov -volname "Timescreen" -srcfolder "$STAGE" -format UDRW -fs HFS+ "$OUT/Timescreen-writable.dmg"
MOUNT="$OUT/dmg-mount"
mkdir -p "$MOUNT"
hdiutil attach "$OUT/Timescreen-writable.dmg" -mountpoint "$MOUNT" -nobrowse -noautoopen -readwrite
trap 'hdiutil detach "$MOUNT" -quiet || true' EXIT
# Finder layout is cosmetic; installation and verification do not depend on it.
osascript - "$MOUNT" <<'APPLESCRIPT' || echo "Finder customization unavailable; standard drag-to-install view retained."
on run argv
  set mountPath to item 1 of argv
  tell application "Finder"
    set theFolder to POSIX file mountPath as alias
    open theFolder
    set theWindow to container window of theFolder
    set current view of theWindow to icon view
    set toolbar visible of theWindow to false
    set statusbar visible of theWindow to false
    set bounds of theWindow to {100, 100, 760, 560}
    set opts to icon view options of theWindow
    set arrangement of opts to not arranged
    set icon size of opts to 96
    set text size of opts to 13
    set background picture of opts to file ".background:installer.png" of theFolder
    set position of item "Timescreen.app" of theFolder to {170, 220}
    set position of item "Applications" of theFolder to {490, 220}
    set position of item "Start here.txt" of theFolder to {330, 365}
    close theWindow
    update theFolder without registering applications
  end tell
end run
APPLESCRIPT
xcrun SetFile -a C "$MOUNT" || true
sync
hdiutil detach "$MOUNT"
trap - EXIT
hdiutil convert "$OUT/Timescreen-writable.dmg" -format UDZO -imagekey zlib-level=9 -o "$IMAGE"
hdiutil verify "$IMAGE"
hdiutil attach "$IMAGE" -mountpoint "$MOUNT" -nobrowse -noautoopen -readonly
trap 'hdiutil detach "$MOUNT" -quiet || true' EXIT
codesign --verify --deep --strict "$MOUNT/Timescreen.app"
lipo "$MOUNT/Timescreen.app/Contents/MacOS/Timescreen" -verify_arch arm64 x86_64
test "$(readlink "$MOUNT/Applications")" = /Applications
cmp "$APP/Contents/MacOS/Timescreen" "$MOUNT/Timescreen.app/Contents/MacOS/Timescreen"
hdiutil detach "$MOUNT"
trap - EXIT
(cd "$OUT" && shasum -a 256 Timescreen-2.0.0-macOS-universal.dmg Timescreen-2.0.0-macOS-universal.zip > SHA256SUMS.txt)
echo "DMG created, mounted, signature checked, and checksummed."
