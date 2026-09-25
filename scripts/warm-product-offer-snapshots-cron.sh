#!/bin/sh
set -eu

REPO_DIR="${BROCAR_DIR:-/var/www/brocar}"
IMAGE="${BROCAR_WARM_NODE_IMAGE:-node:20-alpine}"

run_warm() {
  /usr/bin/docker run --rm \
    --network container:brocar-app \
    --env-file "$REPO_DIR/.env" \
    -v "$REPO_DIR:/work:ro" \
    -w /work \
    "$IMAGE" \
    node scripts/warm-product-offer-snapshots.mjs \
    --base-url=http://127.0.0.1:3000 \
    --concurrency=1 \
    --delay-ms=1000 \
    --max-age-hours=168 \
    "$@"
}

# Сначала новый sitemap: 20 карточек за проход. Старые четыре волны получают
# отдельную квоту и продолжают прогреваться, даже если часть новой волны без офферов.
run_warm --wave=5 --limit=20
run_warm --wave=1,2,3,4 --limit=10
