#!/bin/bash
# 클라우드 세션 시작 시 Dart SDK와 엔진 의존성을 설치한다(로컬 터미널 없이 개발하기 위함).
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

DART_VERSION="3.13.7"
DART_HOME="$HOME/.dart-sdk-$DART_VERSION"

if [ ! -x "$DART_HOME/bin/dart" ]; then
  tmp="$(mktemp -d)"
  curl -sSfL -o "$tmp/dart.zip" \
    "https://storage.googleapis.com/dart-archive/channels/stable/release/$DART_VERSION/sdk/dartsdk-linux-x64-release.zip"
  unzip -q "$tmp/dart.zip" -d "$tmp"
  mv "$tmp/dart-sdk" "$DART_HOME"
  rm -rf "$tmp"
fi
export PATH="$DART_HOME/bin:$PATH"
if [ -n "${CLAUDE_ENV_FILE:-}" ]; then
  echo "export PATH=\"$DART_HOME/bin:\$PATH\"" >> "$CLAUDE_ENV_FILE"
fi

(cd "$CLAUDE_PROJECT_DIR/packages/kakao_ingest" && dart pub get)
(cd "$CLAUDE_PROJECT_DIR/engine" && npm install --no-audit --no-fund)
