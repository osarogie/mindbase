#!/bin/bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

OUT="${1:-$ROOT/macos/lib}"
mkdir -p "$OUT"

build_shared() {
  local goos=$1 goarch=$2 out=$3
  echo "Building libmindbase for ${goos}/${goarch} → ${out}"
  CGO_ENABLED=1 GOOS="$goos" GOARCH="$goarch" \
    go build -buildmode=c-shared -o "$out" ./cmd/libmindbase
}

ARCH="$(uname -m)"
build_shared darwin "$ARCH" "$OUT/libmindbase.dylib"
cp "$OUT/libmindbase.h" "$ROOT/macos/Mindbase/libmindbase.h"

# iOS device + simulator static archives (for Expo module)
IOS_OUT="$ROOT/mobile/native/ios"
MODULE_IOS_LIB="$ROOT/mobile/modules/mindbase/ios/lib"
mkdir -p "$IOS_OUT" "$MODULE_IOS_LIB"

build_ios_archive() {
  local sdk=$1 out=$2
  if ! xcrun --sdk "$sdk" --show-sdk-path &>/dev/null; then
    echo "Skip iOS ${sdk} lib (SDK not available)"
    return 0
  fi
  local sdk_path clang min_flag
  sdk_path="$(xcrun --sdk "$sdk" --show-sdk-path)"
  clang="$(xcrun --sdk "$sdk" --find clang)"
  if [[ "$sdk" == "iphonesimulator" ]]; then
    min_flag="-mios-simulator-version-min=16.4"
  else
    min_flag="-miphoneos-version-min=16.4"
  fi
  echo "Building libmindbase for ${sdk} → ${out}"
  CGO_ENABLED=1 GOOS=ios GOARCH=arm64 \
    CC="${clang} -arch arm64 -isysroot ${sdk_path} ${min_flag}" \
    go build -tags ios -buildmode=c-archive -o "$out" ./cmd/libmindbase
}

if build_ios_archive iphoneos "$IOS_OUT/libmindbase-device.a"; then
  cp "$IOS_OUT/libmindbase-device.a" "$MODULE_IOS_LIB/"
fi
if build_ios_archive iphonesimulator "$IOS_OUT/libmindbase-sim.a"; then
  cp "$IOS_OUT/libmindbase-sim.a" "$MODULE_IOS_LIB/"
fi

XCFRAMEWORK="$ROOT/mobile/modules/mindbase/ios/MindbaseLib.xcframework"
if [[ -f "$MODULE_IOS_LIB/libmindbase-device.a" && -f "$MODULE_IOS_LIB/libmindbase-sim.a" ]]; then
  IOS_XCF_WORK="$ROOT/mobile/native/ios/xcf-work"
  rm -rf "$IOS_XCF_WORK" "$XCFRAMEWORK"
  mkdir -p "$IOS_XCF_WORK/device" "$IOS_XCF_WORK/simulator"
  cp "$MODULE_IOS_LIB/libmindbase-device.a" "$IOS_XCF_WORK/device/libmindbase.a"
  cp "$MODULE_IOS_LIB/libmindbase-sim.a" "$IOS_XCF_WORK/simulator/libmindbase.a"
  xcodebuild -create-xcframework \
    -library "$IOS_XCF_WORK/device/libmindbase.a" -headers "$ROOT/mobile/modules/mindbase/ios/include" \
    -library "$IOS_XCF_WORK/simulator/libmindbase.a" -headers "$ROOT/mobile/modules/mindbase/ios/include" \
    -output "$XCFRAMEWORK"
fi

# Android arm64 (requires NDK)
if [[ -n "${ANDROID_NDK_HOME:-}" && -x "${ANDROID_NDK_HOME}/toolchains/llvm/prebuilt/$(uname -s | tr '[:upper:]' '[:lower:]')-$(uname -m)/bin/aarch64-linux-android21-clang" ]]; then
  ANDROID_OUT="$ROOT/mobile/native/android/arm64-v8a"
  MODULE_ANDROID_LIB="$ROOT/mobile/modules/mindbase/android/src/main/jniLibs/arm64-v8a"
  mkdir -p "$ANDROID_OUT" "$MODULE_ANDROID_LIB"
  CC="${ANDROID_NDK_HOME}/toolchains/llvm/prebuilt/$(uname -s | tr '[:upper:]' '[:lower:]')-$(uname -m)/bin/aarch64-linux-android21-clang"
  CGO_ENABLED=1 GOOS=android GOARCH=arm64 CC="$CC" \
    go build -buildmode=c-shared -o "$ANDROID_OUT/libmindbase.so" ./cmd/libmindbase
  cp "$ANDROID_OUT/libmindbase.so" "$MODULE_ANDROID_LIB/"
  cp "$ANDROID_OUT/libmindbase.h" "$ROOT/mobile/native/android/libmindbase.h" 2>/dev/null || true
else
  echo "Skip Android lib (set ANDROID_NDK_HOME to build)"
fi

cp "$ROOT/macos/Mindbase/libmindbase.h" "$ROOT/mobile/modules/mindbase/ios/include/libmindbase.h" 2>/dev/null || \
  cp "$IOS_OUT/libmindbase-device.h" "$ROOT/mobile/modules/mindbase/ios/include/libmindbase.h" 2>/dev/null || true
cp "$ROOT/mobile/modules/mindbase/ios/include/libmindbase.h" "$ROOT/mobile/modules/mindbase/android/src/main/cpp/include/libmindbase.h" 2>/dev/null || true

echo "libmindbase build complete"
