#!/usr/bin/env bash
set -u

repo="${1:?owner/repo requerido}"
sha="${2:?sha requerido}"
timeout="${CI_LOCAL_WAIT_TIMEOUT:-0}"
interval="${CI_LOCAL_WAIT_INTERVAL:-10}"
gh_bin="${GH_BIN:-gh}"

status_ok() {
  local state
  state=$("$gh_bin" api "repos/${repo}/commits/$1/status" \
    --jq '[.statuses[] | select(.context == "ci-local")][0].state // ""' 2>/dev/null) || state=""
  [ "$state" = "success" ]
}

tree_of() {
  "$gh_bin" api "repos/${repo}/git/commits/$1" --jq '.tree.sha' 2>/dev/null || true
}

elapsed=0
while :; do
  if status_ok "$sha"; then
    echo "ci-local en success sobre $sha" >&2
    echo "verified=true"
    exit 0
  fi
  [ "$elapsed" -ge "$timeout" ] && break
  sleep "$interval"
  elapsed=$((elapsed + interval))
done

merge_tree="$(tree_of "$sha")"
if [ -n "$merge_tree" ]; then
  heads=$("$gh_bin" api "repos/${repo}/commits/${sha}/pulls" --jq '.[].head.sha' 2>/dev/null) || heads=""
  for head in $heads; do
    [ "$head" = "$sha" ] && continue
    if [ "$(tree_of "$head")" = "$merge_tree" ] && status_ok "$head"; then
      echo "ci-local en success sobre $head (PR mergeado) con el mismo árbol que $sha" >&2
      echo "verified=true"
      exit 0
    fi
  done
fi

echo "sin ci-local válido para $sha: corre el CI completo" >&2
echo "verified=false"
