#!/bin/bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

chmod +x "$ROOT/scripts/build-libmindbase.sh"
"$ROOT/scripts/build-libmindbase.sh" "$ROOT/macos/lib"

APP_NAME="mindbase"
BUILD_DIR="$ROOT/macos/build"
APP="$BUILD_DIR/$APP_NAME.app"
CONTENTS="$APP/Contents"
MACOS_DIR="$CONTENTS/MacOS"
FRAMEWORKS="$CONTENTS/Frameworks"
RES="$CONTENTS/Resources"

rm -rf "$APP" "$BUILD_DIR/ubase.app"
mkdir -p "$MACOS_DIR" "$FRAMEWORKS" "$RES"

swiftc \
  -O \
  -sdk "$(xcrun --show-sdk-path --sdk macosx)" \
  -target "$(uname -m)-apple-macos14.0" \
  -import-objc-header "$ROOT/macos/Mindbase/mindbase-bridge.h" \
  -I "$ROOT/macos/Mindbase" \
  -L "$ROOT/macos/lib" \
  -lmindbase \
  -Xlinker -rpath -Xlinker @executable_path/../Frameworks \
  -framework SwiftUI \
  -framework AppKit \
  -framework WebKit \
  -framework CoreServices \
  -o "$MACOS_DIR/$APP_NAME" \
  "$ROOT/macos/Mindbase/"*.swift

cp "$ROOT/macos/lib/libmindbase.dylib" "$FRAMEWORKS/libmindbase.dylib"
install_name_tool -id "@rpath/libmindbase.dylib" "$FRAMEWORKS/libmindbase.dylib"
install_name_tool -change libmindbase.dylib @rpath/libmindbase.dylib "$MACOS_DIR/$APP_NAME" 2>/dev/null || true

cp "$ROOT/macos/Mindbase/AppIcon.icns" "$RES/AppIcon.icns"
cp "$ROOT/macos/Mindbase/Info.plist" "$CONTENTS/Info.plist"
/usr/libexec/PlistBuddy -c "Set :CFBundleExecutable $APP_NAME" "$CONTENTS/Info.plist"
chmod +x "$MACOS_DIR/$APP_NAME"

echo "Built $APP (libmindbase embedded in Frameworks/)"
