#!/usr/bin/env bash
# Decide which apps a change affects. Prints `api=true|false` and
# `web=true|false`, one per line, for $GITHUB_OUTPUT.
#
#   plan-affected.sh full          every app (push to main, nightly, manual)
#   plan-affected.sh <base-ref>    apps changed between <base-ref> and HEAD
#
# Turborepo decides from package files and the lockfile. Files outside any
# package can still change an app's verdict, so they force a full run:
# deploy/ (API specs read the self-hosted bundle), workflows and these
# scripts, and the root workspace and toolchain files.
#
# .github/workflows/ci.yml calls this from the `plan` job; the `affected-guard`
# job runs it against synthetic commits so a broken skip fails CI instead of
# reporting green.
set -euo pipefail

all() {
  echo "api=$1"
  echo "web=$1"
}

if [[ "${1:-}" == "full" ]]; then
  all true
  exit 0
fi

base="${1:?usage: plan-affected.sh full|<base-ref>}"
changed="$(git diff --name-only "$base"...HEAD)"

if grep -qE '^(deploy/|\.github/|package\.json$|package-lock\.json$|turbo\.json$|\.gitattributes$|\.nvmrc$)' <<<"$changed"; then
  all true
  exit 0
fi

affected="$(TURBO_SCM_BASE="$base" TURBO_SCM_HEAD=HEAD npx --no-install turbo ls --affected --output=json \
  | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{for(const p of JSON.parse(s).packages.items)console.log(p.name)})')"

has() { grep -qx "$1" <<<"$affected" && echo true || echo false; }
echo "api=$(has @alphaci/api)"
echo "web=$(has @alphaci/web)"
