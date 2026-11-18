#!/usr/bin/env sh
# Update package pins only; never install or execute package code.
set -eu

usage() { echo "Usage: $0 [plugin [npm-version|git-tag]]"; }
die() { echo "ERROR: $*" >&2; exit 1; }
case "${1-}" in
  -h|--help) usage; exit 0 ;;
esac
[ "$#" -le 2 ] || { usage >&2; exit 1; }
plugin=${1-}
requested=${2-}
[ "$#" -eq 0 ] || [ -n "$plugin" ] || die "Plugin name must not be empty"
[ "$#" -ne 2 ] || [ -n "$requested" ] || die "Version must not be empty"

cd "$(dirname "$0")/.."
work=$(mktemp -d ./.update-plugins.XXXXXX)
trap 'rm -rf "$work"' 0
trap 'exit 130' INT
trap 'exit 143' TERM
cp -p settings.json "$work/original.json"
cp -p "$work/original.json" "$work/settings.json"
jq -e '.packages | type == "array" and all(.[];
  type == "string" or (type == "object" and (.source | type == "string")))' \
  "$work/original.json" >/dev/null || die "Invalid packages in settings.json"

indices=$(jq -r --arg plugin "$plugin" '
  .packages | to_entries[]
  | (.value | if type == "string" then . else .source end
     | sub("@[^@]+$"; "")) as $base
  | select($plugin == "" or $plugin == $base
      or $plugin == ($base | sub("^(npm|git):"; ""))
      or (($base | startswith("git:"))
          and $plugin == ($base | split("/")[-1] | sub("\\.git$"; ""))))
  | .key' "$work/original.json")
# jq emits only integer array indices, so intentional word splitting is safe.
set -- $indices
if [ -n "$plugin" ]; then
  [ "$#" -gt 0 ] || die "Plugin not found: $plugin"
  [ "$#" -eq 1 ] || die "Ambiguous plugin: $plugin (use its full source without the pin)"
fi

for index do
  source=$(jq -r --argjson index "$index" '
    .packages[$index] | if type == "string" then . else .source end' "$work/original.json")
  base=${source%@*}
  case "$base" in
    npm:*)
      name=${base#npm:}
      if [ -n "$requested" ]; then
        jq -en --arg v "$requested" '$v | test("^[0-9]+\\.[0-9]+\\.[0-9]+$")' \
          >/dev/null || die "Expected an exact npm version (X.Y.Z): $requested"
      fi
      reply=$(npm view "$name@${requested:-latest}" version --json) \
        || die "Cannot look up npm version: $name"
      version=$(printf '%s\n' "$reply" | jq -er '
        if type == "array" and length == 1 then .[0] else . end
        | select(type == "string")
        | select(test("^[0-9]+\\.[0-9]+\\.[0-9]+$"))') \
        || die "Invalid npm version returned for $name"
      [ -z "$requested" ] || [ "$version" = "$requested" ] \
        || die "Registry returned a different version for $name"
      ;;
    git:*)
      url=${base#git:}
      case "$url" in
        *://*|git@*) ;;
        *) url="https://$url" ;;
      esac
      ref=HEAD
      [ -z "$requested" ] || ref="refs/tags/$requested"
      refs=$(git ls-remote --exit-code "$url" "$ref" "$ref^{}") \
        || die "Cannot resolve Git ref $ref for $base"
      # Annotated tags point to tag objects; pin their peeled commit instead.
      version=$(printf '%s\n' "$refs" | awk -v ref="$ref" '
        $2 == ref { sha = $1 }
        $2 == ref "^{}" { peeled = $1 }
        END { print peeled ? peeled : sha }')
      jq -en --arg v "$version" '$v | test("^[0-9a-f]{40}$")' \
        >/dev/null || die "Invalid Git commit returned for $base"
      ;;
    *) die "Unsupported plugin source: $source" ;;
  esac
  updated="$base@$version"
  [ "$source" != "$updated" ] || continue
  jq --argjson index "$index" --arg source "$updated" '
    .packages[$index] |= (if type == "string" then $source else .source = $source end)
  ' "$work/settings.json" > "$work/next.json"
  cp "$work/next.json" "$work/settings.json"
  printf '%s -> %s\n' "$source" "$updated" >> "$work/changes"
done

if [ ! -f "$work/changes" ]; then
  echo "No plugin updates."
  exit 0
fi
cmp -s settings.json "$work/original.json" \
  || die "settings.json changed during lookup; retry without overwriting those edits"
mv "$work/settings.json" settings.json
cat "$work/changes"
echo "Pins updated. Review git diff, then commit settings.json."
