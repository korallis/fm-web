#!/bin/sh
# Fixture stub standing in for the real fm-lock.sh — only used to prove the guarded
# runner can execute "status" (read-only) end to end.
if [ "$1" = "status" ]; then
  echo "lock: held by live harness pid 15356"
else
  echo "refusing to simulate a mutating fm-lock.sh call in a fixture" >&2
  exit 1
fi
