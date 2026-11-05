#!/usr/bin/env bash
# Renders the enterprise VM's settings from the GitHub environment into the
# bundle rollout.sh reads on stdin. Runs on the Actions runner.
#
#   VARS_JSON='{...}' SECRETS_JSON='{...}' render.sh <out-file>
#
# VARS_JSON and SECRETS_JSON are toJSON(vars) and toJSON(secrets). Only the
# keys alphaci.env.template and secret-files name are read. Output lines:
#
#   env <base64 of the rendered alphaci.env>
#   secret <file name> <base64 of its contents>
#
# GitHub reserves names that start with GITHUB_, so KEY=GITHUB_X is read from
# GH_X. Fails, naming every missing variable or secret, before anything is
# written. Never prints a value.
set -euo pipefail

here=$(cd "$(dirname "$0")" && pwd)
template=${TEMPLATE:-$here/alphaci.env.template}
secret_list=${SECRET_FILES:-$here/secret-files}
out=${1:?usage: render.sh <out-file>}

: "${VARS_JSON:?VARS_JSON must hold toJSON(vars)}"
: "${SECRETS_JSON:?SECRETS_JSON must hold toJSON(secrets)}"

# The environment's name for KEY.
stored() { if [[ $1 == GITHUB_* ]]; then echo "GH_${1#GITHUB_}"; else echo "$1"; fi; }
var() { jq -r --arg k "$1" '.[$k] // empty' <<< "$VARS_JSON"; }
secret() { jq -r --arg k "$1" '.[$k] // empty' <<< "$SECRETS_JSON"; }

missing=()
env_file=''
while IFS= read -r line || [[ -n $line ]]; do
  line=${line%$'\r'}
  [[ -z $line || $line == \#* ]] && continue
  if [[ $line =~ ^([A-Z][A-Z0-9_]*)=(.*)$ ]]; then
    env_file+="$line"$'\n'
  elif [[ $line =~ ^([A-Z][A-Z0-9_]*)(\?)?$ ]]; then
    key=${BASH_REMATCH[1]} optional=${BASH_REMATCH[2]}
    value=$(var "$(stored "$key")")
    if [[ -z $value && -z $optional ]]; then
      missing+=("variable $(stored "$key")")
      continue
    fi
    if [[ $value == *$'\n'* ]]; then
      echo "render: variable $key has a line break; alphaci.env holds one line per key (write \\n instead)" >&2
      exit 1
    fi
    env_file+="$key=$value"$'\n'
  else
    echo "render: $template: cannot read the line '$line'" >&2
    exit 1
  fi
done < "$template"

secret_lines=''
while IFS= read -r name || [[ -n $name ]]; do
  name=${name%$'\r'}
  [[ -z $name || $name == \#* ]] && continue
  [[ $name =~ ^[a-z][a-z0-9_]*$ ]] || { echo "render: $secret_list: bad file name '$name'" >&2; exit 1; }
  key=$(stored "${name^^}")
  value=$(secret "$key")
  if [[ -z $value ]]; then
    missing+=("secret $key")
    continue
  fi
  secret_lines+="secret $name $(printf '%s' "$value" | base64 -w0)"$'\n'
done < "$secret_list"

if (( ${#missing[@]} )); then
  echo "render: set these in the enterprise-gce environment:" >&2
  printf '  %s\n' "${missing[@]}" >&2
  exit 1
fi

umask 077
{
  echo "env $(printf '%s' "$env_file" | base64 -w0)"
  printf '%s' "$secret_lines"
} > "$out"
