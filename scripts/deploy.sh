#!/usr/bin/env bash
# Deploy the Focus On It landing page and/or web app to the Caddy box.
#
#   ./scripts/deploy.sh landing   # landing/index.html + og.png -> unfry.dev
#   ./scripts/deploy.sh app       # npm run build, then dist/   -> app.unfry.dev (not live yet)
#   ./scripts/deploy.sh all
#
# Override the target with DEPLOY_HOST, e.g. while DNS is still propagating:
#   DEPLOY_HOST=deploy@203.0.113.10 ./scripts/deploy.sh all
#
# Content changes need no restart — Caddy serves the files live. Only edits to
# Caddyfile or docker-compose.yml require `docker compose up -d` on the server.
set -euo pipefail

DEPLOY_HOST="${DEPLOY_HOST:-deploy@unfry.dev}"
REMOTE_ROOT="${REMOTE_ROOT:-/opt/focusonit/site}"

cd "$(dirname "$0")/.."

deploy_landing() {
  echo "==> landing -> $DEPLOY_HOST:$REMOTE_ROOT/landing/"
  if grep -q 'G-XXXXXXXXXX' landing/index.html; then
    echo "    warning: GA4 measurement ID is still the placeholder G-XXXXXXXXXX" >&2
  fi
  if grep -q "formspree.io/f/FORM_ID" landing/index.html; then
    echo "    warning: Formspree FORM_ID is still the placeholder — the form will not deliver leads" >&2
  fi
  # No --delete: the landing dir is hand-curated, not a build output.
  rsync -avz landing/index.html landing/og.png "$DEPLOY_HOST:$REMOTE_ROOT/landing/"
}

deploy_app() {
  echo "==> building app (tsc + vite build)"
  npm run build
  echo "==> app -> $DEPLOY_HOST:$REMOTE_ROOT/app/"
  # --delete here: dist/ is generated, and stale content-hashed assets would
  # otherwise accumulate on the server forever.
  rsync -avz --delete dist/ "$DEPLOY_HOST:$REMOTE_ROOT/app/"
}

case "${1:-}" in
  landing) deploy_landing ;;
  app)     deploy_app ;;
  all)     deploy_landing; deploy_app ;;
  *)       echo "usage: $0 {landing|app|all}" >&2; exit 2 ;;
esac

echo
echo "Done.  https://unfry.dev"
