#!/usr/bin/env bash
# Picks which end-to-end specs a change needs. The full set (296 tests) took 39 minutes on the
# shared VPS on 2026-11-28, and the owner chose not to run it in CI (2026-11-28): specs are run
# locally before pushing, and CI runs a fast set.
# Prints one line: "all", "none", or the spec files to run.
#
#   none  only writing changed (Markdown, docs/, checkpoints/, tasks/).
#   some  one or more feature folders listed in e2e/slices.txt changed: their specs,
#         any spec the change edits, and the smoke spec.
#   core  anything else: the specs in e2e/core.txt plus any spec the change edits.
#   all   only when a pull request carries the "full-e2e" label.
#
# Unless it prints "all", it also sets E2E_SIZES for the later steps (through $GITHUB_ENV),
# so screen specs check the smallest phone and desktop instead of all four sizes.
#
# It compares HEAD with its first parent: the base branch on a pull request's
# merge commit, the previous commit on a squash merge to main. The checkout
# therefore needs fetch-depth 2.
# Used by .github/workflows/ci.yml (e2e job).
set -uo pipefail

git() { command git -c safe.directory='*' "$@"; }
here=$(dirname "$0")/../..
two_sizes() { [ -n "${GITHUB_ENV:-}" ] && echo "E2E_SIZES=small phone,desktop" >> "$GITHUB_ENV"; return 0; }

# Asked for on purpose: a pull request labelled full-e2e runs everything at all four sizes.
if [ -n "${GITHUB_EVENT_PATH:-}" ] && grep -q '"name": *"full-e2e"' "$GITHUB_EVENT_PATH" 2> /dev/null; then
  echo all; exit 0
fi

specs=" e2e/smoke.spec.ts "
add() { case "$specs" in *" $1 "*) ;; *) [ -f "$here/$1" ] && specs+="$1 " ;; esac; }
core() { while IFS= read -r s; do case "$s" in "" | "#"*) ;; *) add "e2e/$s" ;; esac; done < "$here/e2e/core.txt"; }

parent=$(git rev-parse -q --verify 'HEAD^1' 2> /dev/null) || parent=""
files=""
[ -n "$parent" ] && files=$(git diff --name-only "$parent" HEAD 2> /dev/null)

code=0; wide=0
[ -n "$files" ] || wide=1
slices=$here/e2e/slices.txt

while IFS= read -r f; do
  [ -n "$f" ] || continue
  case "$f" in
    *.md | docs/* | checkpoints/* | tasks/*) ;;
    e2e/*.spec.ts) code=1; add "$f" ;;
    # What every new feature has to touch: its loader, its flag, its size budget, its own public files, the script that bakes its data.
    src/features/index.ts | src/lib/flags/registry.ts | .size-limit.json | public/walks/* | public/replay/* | scripts/derive-*) code=1 ;;
    src/features/*/*)
      code=1
      name=${f#src/features/}
      name=${name%%/*}
      if line=$(grep -E "^$name:" "$slices" 2> /dev/null); then
        for s in ${line#*:}; do add "e2e/$s"; done
      else
        wide=1
      fi
      ;;
    *) code=1; wide=1 ;;
  esac
done <<< "$files"

if [ "$code" = 0 ] && [ "$wide" = 0 ]; then echo none; exit 0; fi
[ "$wide" = 1 ] && core
two_sizes
echo "${specs# }" | sed 's/ $//'
