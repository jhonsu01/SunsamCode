#!/usr/bin/env bash
# Sunsam Code: fusiona upstream (zai-org/ZCode) en una rama sync/upstream-<fecha> conservando la
# capa Sunsam. Se usa desde .github/workflows/sunsam-upstream-sync.yml y también en local:
#
#   UPSTREAM_REF=main bash scripts/sunsam/sync-upstream.sh
#
# Salidas (GITHUB_OUTPUT si existe): changed, branch, conflicts, upstream_sha.
set -euo pipefail

UPSTREAM_REPO="${UPSTREAM_REPO:-https://github.com/zai-org/ZCode.git}"
UPSTREAM_REF="${UPSTREAM_REF:-main}"
BASE_BRANCH="${BASE_BRANCH:-main}"
OUT="${GITHUB_OUTPUT:-/dev/null}"

git config user.name >/dev/null || git config user.name "sunsam-sync[bot]"
git config user.email >/dev/null || git config user.email "sunsam-sync@users.noreply.github.com"
# Driver "ours": los ficheros marcados con merge=ours en .gitattributes (iconos y capa Sunsam)
# conservan siempre la versión del fork cuando upstream también los cambia.
git config merge.ours.driver true

if ! git remote get-url upstream >/dev/null 2>&1; then
  git remote add upstream "$UPSTREAM_REPO"
fi
git fetch --no-tags upstream "$UPSTREAM_REF"
upstream_sha="$(git rev-parse FETCH_HEAD)"
echo "upstream_sha=$upstream_sha" >>"$OUT"

if git merge-base --is-ancestor "$upstream_sha" "HEAD"; then
  echo "[sunsam-sync] $BASE_BRANCH ya contiene upstream $upstream_sha"
  echo "changed=false" >>"$OUT"
  exit 0
fi

branch="sync/upstream-$(date -u +%Y%m%d)-${upstream_sha:0:7}"
git checkout -B "$branch"

conflicts=""
if ! git merge --no-ff --no-edit -m "chore(sync): merge upstream ZCode ${upstream_sha:0:7}" "$upstream_sha"; then
  conflicts="$(git diff --name-only --diff-filter=U | tr '\n' ' ')"
  echo "[sunsam-sync] conflictos: $conflicts"
  # Se confirma el merge con los marcadores de conflicto para que el PR muestre exactamente qué
  # revisar; el build del PR fallará hasta que se resuelvan, así nunca llega a main roto.
  git add -A
  git commit --no-edit -m "chore(sync): merge upstream ZCode ${upstream_sha:0:7} (conflicts: $conflicts)"
fi

# Re-aplica iconos por si upstream añadió tamaños nuevos que no están cubiertos por merge=ours.
if command -v python3 >/dev/null && python3 -c "import PIL" 2>/dev/null; then
  python3 branding/sunsam/generate-icons.py
  if ! git diff --quiet; then
    git commit -am "chore(sync): re-apply Sunsam icons"
  fi
fi

git push --force-with-lease origin "$branch"
{
  echo "changed=true"
  echo "branch=$branch"
  echo "conflicts=$conflicts"
} >>"$OUT"
