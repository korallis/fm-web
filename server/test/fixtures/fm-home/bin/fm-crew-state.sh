#!/bin/sh
task_id="${1:-}"
home="${FM_HOME:-.}"
meta_file="$home/state/$task_id.meta"

if [ ! -f "$meta_file" ]; then
  printf 'state: unknown \302\267 source: none \302\267 no metadata for %s\n' "$task_id"
  exit 0
fi

worktree=$(awk -F= '$1 == "worktree" { print substr($0, index($0, "=") + 1); exit }' "$meta_file")
if [ -n "$worktree" ] && [ ! -d "$worktree" ]; then
  printf 'state: unknown \302\267 source: none \302\267 worktree gone: %s\n' "$worktree"
  exit 0
fi

status_file="$home/state/$task_id.status"
if [ ! -f "$status_file" ]; then
  printf 'state: unknown \302\267 source: none \302\267 no status log for %s\n' "$task_id"
  exit 0
fi

latest=$(sed '/^[[:space:]]*$/d' "$status_file" | tail -n 1)
case "$latest" in
  working:*) state=working ;;
  done:*) state=done ;;
  blocked:*|needs-decision:*) state=blocked ;;
  failed:*) state=failed ;;
  *) state=unknown ;;
esac

printf 'state: %s \302\267 source: status-log \302\267 %s\n' "$state" "$latest"
