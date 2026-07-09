#!/bin/sh
# Fixture stub standing in for the real fm-send.sh — only used to prove the guarded
# runner can execute an allowlisted mutating script end to end.
TARGET="$1"
shift
if [ "$1" = "--key" ]; then
  echo "stub sent key $2 to $TARGET"
else
  echo "stub sent to $TARGET: $*"
fi
