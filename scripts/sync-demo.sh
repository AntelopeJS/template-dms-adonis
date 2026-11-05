#!/usr/bin/env bash
set -euo pipefail

if [ $# -ne 1 ]; then
  echo "usage: scripts/sync-demo.sh <template-dms-demo checkout>" >&2
  exit 2
fi

source_root=$(cd "$1" && pwd)
target_root="$(cd "$(dirname "$0")/.." && pwd)/demo"

mkdir -p "$target_root"
rsync -a --delete \
  --exclude '/capture-*' \
  --exclude '/process-group*' \
  --exclude '/package-manager.test.ts' \
  --exclude '/dms-frontend-pin.test.ts' \
  "$source_root/src/" "$target_root/src/"
rsync -a --delete "$source_root/content/" "$target_root/content/"
rsync -a --delete \
  --exclude node_modules \
  --exclude .nuxt \
  --exclude .output \
  --exclude pnpm-lock.yaml \
  "$source_root/frontend-vue/" "$target_root/frontend-vue/"

node -e '
const fs = require("node:fs");
const file = process.argv[1];
const manifest = JSON.parse(fs.readFileSync(file, "utf8"));
manifest.scripts.dev = "pnpm --dir ../.. frontend:dev";
manifest.scripts.build = "pnpm --dir ../.. frontend:build";
fs.writeFileSync(file, `${JSON.stringify(manifest, null, "\t")}\n`);
' "$target_root/frontend-vue/package.json"
