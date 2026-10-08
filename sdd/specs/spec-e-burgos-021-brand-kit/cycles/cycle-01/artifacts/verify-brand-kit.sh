#!/usr/bin/env bash
set -euo pipefail

# usage: verify-brand-kit.sh <inputs-dir> <out-dir> [reference-dir|-] [brands-root brand-id]
# inputs-dir: work projects ia-promo/ and easy-pro/ (storyboard.json, timeline.json, words.json, voice assets)
# reference-dir: output of a previous run (old code) to compare tpl/html/script and snapshots against
# CODE_ROOT: checkout whose motion-studio CLI re-composes the projects (default: this repo)
REPO="$(cd "$(dirname "$0")/../../../../../.." && pwd)"
CODE_ROOT="${CODE_ROOT:-$REPO}"
INPUTS="${1:?inputs dir}"
OUT="${2:?output dir}"
REFERENCE="${3:--}"
BRANDS_ROOT_OVERRIDE="${4:-}"
BRAND_ID_OVERRIDE="${5:-}"
HYPERFRAMES="$REPO/node_modules/hyperframes/dist/cli.js"
STUDIO=(node -r "$CODE_ROOT/tools/motion-studio/src/cli-register.cjs" "$CODE_ROOT/tools/motion-studio/src/main.ts")

declare -A TIMES=( [ia-promo]="3,16.5,24,32,47,57" [easy-pro]="3,9,30,57" )

mkdir -p "$OUT"
export SWC_NODE_PROJECT="$CODE_ROOT/tsconfig.base.json"
if [ -n "$BRANDS_ROOT_OVERRIDE" ]; then export BRANDS_ROOT="$BRANDS_ROOT_OVERRIDE"; fi

for project in ia-promo easy-pro; do
  target="$OUT/$project"
  rm -rf "$target" "$OUT/$project-snap"
  cp -R "$INPUTS/$project" "$target"
  if [ -n "$BRAND_ID_OVERRIDE" ]; then
    node -e "const fs=require('fs');const p=process.argv[1];const s=JSON.parse(fs.readFileSync(p,'utf8'));s.brand=process.argv[2];fs.writeFileSync(p,JSON.stringify(s,null,2)+'\n')" "$target/storyboard.json" "$BRAND_ID_OVERRIDE"
  fi
  (cd "$CODE_ROOT" && "${STUDIO[@]}" storyboard "$target/storyboard.json" "$target")
  (cd "$CODE_ROOT" && "${STUDIO[@]}" compose "$target")
  node "$HYPERFRAMES" snapshot "$target" --at "${TIMES[$project]}" --no-end --describe false -o "$OUT/$project-snap" >/dev/null 2>&1
  if [ "$REFERENCE" != "-" ]; then
    for file in index.html.tpl index.html script.json; do
      if cmp -s "$REFERENCE/$project/$file" "$target/$file"; then echo "$project/$file: byte-identical to reference"; else echo "$project/$file: DIFFERS from reference"; fi
    done
    for frame in "$REFERENCE/$project-snap"/frame-*.png; do
      name="$(basename "$frame")"
      psnr="$(ffmpeg -hide_banner -i "$frame" -i "$OUT/$project-snap/$name" -lavfi psnr -f null - 2>&1 | grep -o 'average:[^ ]*' | tail -1)"
      echo "$project/$name psnr $psnr"
    done
  fi
done
