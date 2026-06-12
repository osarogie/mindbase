#!/bin/bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

"$ROOT/macos/scripts/build-go.sh"

APP_NAME="mindbase"
BUILD_DIR="$ROOT/macos/build"
APP="$BUILD_DIR/$APP_NAME.app"
CONTENTS="$APP/Contents"
MACOS_DIR="$CONTENTS/MacOS"
RES="$CONTENTS/Resources"

rm -rf "$APP" "$BUILD_DIR/ubase.app"
mkdir -p "$MACOS_DIR" "$RES"

swiftc \
  -O \
  -sdk "$(xcrun --show-sdk-path --sdk macosx)" \
  -target "$(uname -m)-apple-macos14.0" \
  -framework SwiftUI \
  -framework AppKit \
  -framework WebKit \
  -o "$MACOS_DIR/$APP_NAME" \
  "$ROOT/macos/Mindbase/"*.swift

cp "$ROOT/macos/Mindbase/AppIcon.icns" "$RES/AppIcon.icns"
cp "$ROOT/macos/Mindbase/Info.plist" "$CONTENTS/Info.plist"
/usr/libexec/PlistBuddy -c "Set :CFBundleExecutable $APP_NAME" "$CONTENTS/Info.plist"
cp "$ROOT/bin/mindbase" "$RES/mindbase"
cp "$ROOT/internal/ui/static/rich-editor-frame.html" "$RES/rich-editor-frame.html"
chmod +x "$RES/mindbase" "$MACOS_DIR/$APP_NAME"

echo "Built $APP"
