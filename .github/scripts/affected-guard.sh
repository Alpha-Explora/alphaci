#!/usr/bin/env bash
# Prove that plan-affected.sh still sees what each kind of change touches.
# Each case makes a throwaway commit on top of HEAD, asks the plan, and
# compares. A detection bug then fails CI instead of skipping every job and
# reporting green. Leaves the checkout where it started.
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# The cases reset the checkout hard between probes; never do that to work in
# progress.
if [[ -n "$(git status --porcelain)" ]]; then
  echo "affected-guard: the working tree has uncommitted changes; commit or stash them first." >&2
  exit 2
fi
start="$(git rev-parse HEAD)"
failures=0

restore() { git reset -q --hard "$start"; }
trap restore EXIT

check() {
  local label="$1" file="$2" expected="$3"
  restore
  printf '\n// affected-guard probe\n' >>"$file"
  git -c user.name=affected-guard -c user.email=guard@ci.invalid \
    commit -q -am "probe: $label"
  local got
  got="$("$here/plan-affected.sh" "$start" | tr '\n' ' ' | sed 's/ $//')"
  if [[ "$got" == "$expected" ]]; then
    echo "ok    $label -> $got"
  else
    echo "FAIL  $label -> $got (expected $expected)"
    failures=$((failures + 1))
  fi
}

check "API source"          apps/api/src/main.ts                    "api=true web=false"
check "web source"          apps/web/src/app/layout.tsx             "api=false web=true"
check "shared package"      packages/capability-catalog/index.js    "api=true web=true"
check "contracts package"   packages/api-contracts/src/index.ts     "api=true web=true"
check "rules package"       packages/persona-rules/index.js         "api=true web=true"
check "config package"      packages/config/tsconfig.base.json      "api=true web=true"
check "self-hosted bundle"  deploy/selfhost/compose.yaml            "api=true web=true"
check "root workspace file" turbo.json                              "api=true web=true"
check "root docs only"      README.md                               "api=false web=false"
check "docs bundle only"    docs/index.md                           "api=false web=false"

if ((failures > 0)); then
  echo "::error::plan-affected.sh misjudged $failures change(s); CI would skip work it must run."
  exit 1
fi
