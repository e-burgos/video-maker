#!/usr/bin/env bash
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

push=true
for arg in "$@"; do
  case "$arg" in
    --no-push) push=false ;;
    *) echo "Opción desconocida: $arg (válida: --no-push)" >&2; exit 2 ;;
  esac
done

fail() { echo "ci:local ERROR: $*" >&2; exit 1; }
step() { echo; echo "==> $*"; }

unset NX_WORKSPACE_ROOT_PATH
export NX_NO_CLOUD=true NX_DAEMON=false

step "Árbol limpio"
if [ -n "$(git status --porcelain --untracked-files=normal)" ]; then
  git status --short >&2
  fail "hay cambios sin commitear o archivos sin trackear: el status se publica sobre el SHA de HEAD."
fi

step "Versiones de Node y pnpm"
node_major="$(node -p 'process.versions.node.split(".")[0]')"
[ "$node_major" = "22" ] || fail "Node $(node -v), pero el CI corre Node 22."
expected_pnpm="$(node -p "require('./package.json').packageManager.split('@')[1]")"
actual_pnpm="$(pnpm -v)"
[ "$actual_pnpm" = "$expected_pnpm" ] || fail "pnpm $actual_pnpm, pero packageManager exige $expected_pnpm."

step "Repositorio y rama"
remote_url="$(git remote get-url origin)"
repo_slug="$(echo "$remote_url" | sed -E 's#^(git@github\.com:|https://github\.com/)##; s#\.git$##')"
case "$repo_slug" in */*) ;; *) fail "no pude derivar owner/repo de origin ($remote_url)." ;; esac
sha="$(git rev-parse HEAD)"
branch="$(git rev-parse --abbrev-ref HEAD)"
[ "$branch" != "HEAD" ] || fail "HEAD está detached; parate en una rama."
echo "repo=$repo_slug rama=$branch sha=$sha"

if [ "$push" = false ]; then
  remote_sha="$(git ls-remote origin "refs/heads/$branch" | awk '{print $1}')"
  [ "$remote_sha" = "$sha" ] || fail "origin/$branch está en '${remote_sha:-<no existe>}', no en $sha. Pusheá o corré sin --no-push."
fi

step "git fetch origin main + pnpm install --frozen-lockfile"
git fetch origin main
pnpm install --frozen-lockfile
base="$(git merge-base origin/main HEAD)"
echo "base=$base head=$sha"

step "sdd:validate"
pnpm sdd:validate

step "nx affected: lint test build"
pnpm exec nx affected -t lint test build --parallel=3 --base="$base" --head="$sha"

if [ "$push" = true ]; then
  step "git push origin $branch"
  git push origin "HEAD:refs/heads/$branch" || fail "el push falló; no se publica el status."
fi

step "Publicando commit status ci-local"
if ! gh api -X POST "repos/${repo_slug}/statuses/${sha}" \
  -f state=success -f context=ci-local -f description="Node $(node -v), verificado en local" >/dev/null; then
  fail "no pude publicar el status. Con un 404 es la cuenta activa: GH_TOKEN=\$(gh auth token -u e-burgos) pnpm ci:local --no-push"
fi

echo
echo "OK: ci-local=success publicado sobre $sha ($repo_slug)."
