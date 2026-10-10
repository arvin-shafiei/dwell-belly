#!/bin/sh
# Keeps local main current while several people push to it. Run from the repo root.
# A pull that cannot rebase cleanly is aborted and logged, never left half done.
while true; do
  if out=$(git pull --rebase --autostash origin main 2>&1); then
    echo "$(date +%H:%M) ok: $(git log --oneline -1)"
  else
    git rebase --abort 2>/dev/null
    echo "$(date +%H:%M) FAILED: $out"
  fi
  sleep 300
done
