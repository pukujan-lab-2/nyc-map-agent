#!/usr/bin/env bash
# Deploy origin/main to the VPS. Komodo's nyc-map-agent stack runs this as its
# pre-deploy (Pukujan-lab/server-management komodo/resources/stacks-vps.toml), and
# the nyc-map-agent-deploy-on-push action triggers that stack when main moves.
#
# Builds main as nyc-map-agent:<12-char sha>, swaps nyc-map-web to it, waits for
# its health check and puts the previous image back if that fails. Exits early
# when the running image is already main. Either way it writes deploy/.env, which
# compose reads by itself, so Komodo's `compose up` afterwards resolves the same image
# and changes nothing.
# A commit that failed is remembered in .deploy-failed and not retried every 5 minutes;
# delete that file to retry it.
set -euo pipefail

DEPLOY_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPO_DIR="$(cd "$DEPLOY_DIR/.." && pwd)"
OWNER="$(stat -c %U "$REPO_DIR")"
COMPOSE=(docker compose -f "$DEPLOY_DIR/docker-compose.vps.yml")

# Komodo's agent runs as root; the checkout belongs to its owner, so git runs as them.
git_() {
  if [ "$(id -un)" = "$OWNER" ]; then git -C "$REPO_DIR" "$@"
  else sudo -u "$OWNER" git -C "$REPO_DIR" "$@"; fi
}

# The station database's password (nyc-map-postgis). Made once, here on the host, so it is in no
# repository. Compose mounts the file into the container, so it must exist before any `compose up`,
# including the one Komodo runs after this script: this runs before every early exit below.
POSTGIS_ROOT="${POSTGIS_ROOT:-/home/ubuntu/apps/nyc-map-postgis}"
if [ ! -s "$POSTGIS_ROOT/password" ]; then
  mkdir -p "$POSTGIS_ROOT"
  (umask 077; head -c 32 /dev/urandom | base64 | tr -d '/+=\n' > "$POSTGIS_ROOT/password")
  echo "made the station database password at $POSTGIS_ROOT/password"
fi

write_image() { printf 'NYC_MAP_IMAGE=%s\n' "$1" > "$DEPLOY_DIR/.env"; }

git_ fetch --quiet origin main
SHA="$(git_ rev-parse origin/main)"
TAG="nyc-map-agent:${SHA:0:12}"
RUNNING="$(docker inspect nyc-map-web --format '{{.Config.Image}}' 2>/dev/null || true)"

if [ "$RUNNING" = "$TAG" ]; then
  echo "nyc-map-web already runs main ($TAG)"
  write_image "$TAG"
  exit 0
fi

if [ "$(cat "$DEPLOY_DIR/.deploy-failed" 2>/dev/null)" = "$SHA" ]; then
  echo "main ${SHA:0:12} failed to deploy before; keeping ${RUNNING:-nothing} (delete deploy/.deploy-failed to retry)"
  write_image "${RUNNING:-$TAG}"
  exit 0
fi

echo "main is ${SHA:0:12}, running ${RUNNING:-nothing}: deploying"
git_ checkout --quiet --detach "$SHA"
NYC_MAP_IMAGE="$TAG" "${COMPOSE[@]}" build web
NYC_MAP_IMAGE="$TAG" "${COMPOSE[@]}" up -d web

for _ in $(seq 1 30); do
  STATUS="$(docker inspect nyc-map-web --format '{{.State.Health.Status}}' 2>/dev/null || true)"
  if [ "$STATUS" = "healthy" ]; then
    write_image "$TAG"
    rm -f "$DEPLOY_DIR/.deploy-failed"
    echo "deployed $TAG"
    exit 0
  fi
  sleep 5
done

echo "$SHA" > "$DEPLOY_DIR/.deploy-failed"
echo "nyc-map-web did not become healthy on $TAG (last status: ${STATUS:-none})" >&2
if [ -n "$RUNNING" ]; then
  echo "rolling back to $RUNNING" >&2
  NYC_MAP_IMAGE="$RUNNING" "${COMPOSE[@]}" up -d web
  write_image "$RUNNING"
fi
exit 1
