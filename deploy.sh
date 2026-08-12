#!/bin/bash
# 마비노기 에린시계 배포 스크립트
# 사용법: ./deploy.sh "커밋 메시지"
set -e
cd "$(dirname "$0")"

MSG="${1:-앱 업데이트}"

echo "▶ 웹 파일 문법 검사..."
node --check renderer.js

echo "▶ 맥 앱용 Sources 동기화..."
cp index.html renderer.js style.css sw.js Sources/

echo "▶ 맥 앱 빌드..."
swift build 2>&1 | tail -2
cp -r .build/debug/ErinnClock_ErinnClock.bundle "마비노기에린시계.app/Contents/Resources/" 2>/dev/null || true
cp .build/debug/ErinnClock "마비노기에린시계.app/Contents/MacOS/ErinnClock" 2>/dev/null || true

echo "▶ GitHub 백업(소스 저장)..."
rm -f .git/index.lock
git add index.html renderer.js style.css sw.js Sources/ deploy.sh
git commit -m "$MSG" -q 2>/dev/null || echo "  (변경 없음)"
git push -q

echo "▶ Cloudflare Pages 배포 (mabi-erinn.pages.dev)..."
TMP=$(mktemp -d)
cp index.html renderer.js style.css sw.js "$TMP/"
npx --prefix ../mabinogi-push-server wrangler pages deploy "$TMP" \
  --project-name mabi-erinn --branch main --commit-dirty=true 2>&1 | tail -3
rm -rf "$TMP"

echo ""
echo "✅ 배포 완료 → https://mabi-erinn.pages.dev"
