#!/bin/bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"
mkdir -p bin
GOOS=darwin GOARCH="$(uname -m)" go build -o bin/mindbase ./cmd/mindbase
echo "Built $ROOT/bin/mindbase"
