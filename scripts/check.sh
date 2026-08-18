#!/usr/bin/env sh
# Verify the skills tree is intact: submodules initialized, every skill resolves.
set -eu
cd "$(dirname "$0")/.."

fail=0
for sub in vendor/awesome-gamedev-agent-skills vendor/claude-ontology-skill; do
  [ -f "$sub/README.md" ] || { echo "FAIL: submodule not initialized: $sub (run: git submodule update --init)"; fail=1; }
done

count=0
for s in skills/*/; do
  if [ -f "$s/SKILL.md" ]; then count=$((count + 1)); else echo "FAIL: broken skill: $s"; fail=1; fi
done

[ "$count" -ge 70 ] || { echo "FAIL: expected >= 70 skills, found $count"; fail=1; }
[ "$fail" -eq 0 ] && echo "OK: $count skills resolve"
exit "$fail"
