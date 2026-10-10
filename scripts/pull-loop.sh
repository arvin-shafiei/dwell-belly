#!/bin/sh
# Pull main every ten minutes. Never stash edits or interrupt another git operation.
# Usage: sh scripts/pull-loop.sh start|stop|status|once
set -u
REPO=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
SCRIPT="$REPO/scripts/pull-loop.sh"
STATE="${TMPDIR:-/tmp}/rivet-pull-$(printf '%s' "$REPO" | cksum | awk '{print $1}')"
INTERVAL=${PULL_INTERVAL_SECONDS:-600}
mkdir -p "$STATE"

running() {
  [ -f "$STATE/pid" ] || return 1
  pid=$(cat "$STATE/pid")
  case "$pid" in ''|*[!0-9]*) return 1 ;; esac
  kill -0 "$pid" 2>/dev/null || return 1
  ps -p "$pid" -o command= | grep -F "$SCRIPT run" >/dev/null
}

pull_once() {
  cd "$REPO" || return 1
  stamp=$(date '+%Y-%m-%d %H:%M:%S %Z')
  branch=$(git symbolic-ref --short -q HEAD) || { echo "$stamp skipped: detached HEAD"; return 0; }
  for op in rebase-merge rebase-apply MERGE_HEAD CHERRY_PICK_HEAD REVERT_HEAD index.lock; do
    [ ! -e "$(git rev-parse --git-path "$op")" ] || { echo "$stamp skipped: git operation in progress"; return 0; }
  done
  if [ -n "$(git status --porcelain)" ]; then
    git fetch origin main || return 1
    echo "$stamp fetched main; pull deferred until local edits are committed"
    return 0
  fi
  if [ "$branch" = main ]; then
    git pull --ff-only origin main || return 1
  else
    # Merge instead of rewriting a branch that may already have a PR.
    if ! git -c pull.rebase=false pull --no-rebase --no-edit origin main; then
      # We started clean and checked for an existing merge above. Abort only our merge.
      if [ -f "$(git rev-parse --git-path MERGE_HEAD)" ]; then git merge --abort; fi
      echo "$stamp pull failed; local work preserved"
      return 1
    fi
  fi
  echo "$stamp updated $branch: $(git log --oneline -1)"
}

case "${1:-start}" in
  start)
    if running; then echo "Already running: PID $pid; log $STATE/pull.log"; exit 0; fi
    # A separate session survives the terminal/tool call that starts it.
    python3 - "$SCRIPT" "$STATE" "$INTERVAL" <<'PY'
import os, subprocess, sys
script, state, interval = sys.argv[1:]
with open(os.path.join(state, "pull.log"), "ab", buffering=0) as log:
    child = subprocess.Popen(["/bin/sh", script, "run"], stdin=subprocess.DEVNULL,
                             stdout=log, stderr=log, start_new_session=True,
                             env={**os.environ, "PULL_INTERVAL_SECONDS": interval})
with open(os.path.join(state, "pid"), "w") as pidfile:
    pidfile.write(str(child.pid))
print(f"Started pull loop: PID {child.pid}, every {interval}s; log {state}/pull.log")
PY
    ;;
  run)
    mkdir "$STATE/run.lock" 2>/dev/null || { echo "Another pull loop owns the lock"; exit 1; }
    sleeper=''
    cleanup() { [ -z "$sleeper" ] || kill "$sleeper" 2>/dev/null; rm -f "$STATE/pid"; rmdir "$STATE/run.lock" 2>/dev/null; }
    trap 'exit 0' TERM INT HUP
    trap cleanup EXIT
    while true; do
      pull_once || true
      sleep "$INTERVAL" & sleeper=$!
      wait "$sleeper" || true
      sleeper=''
    done
    ;;
  stop)
    if running; then kill "$pid"; echo "Stopped pull loop: PID $pid"; else echo "Pull loop is not running"; fi
    ;;
  status)
    if running; then echo "Running: PID $pid; every ${INTERVAL}s"; else echo "Pull loop is not running"; fi
    echo "Log: $STATE/pull.log"
    [ ! -f "$STATE/pull.log" ] || tail -5 "$STATE/pull.log"
    ;;
  once) pull_once ;;
  *) echo "Usage: sh scripts/pull-loop.sh start|stop|status|once" >&2; exit 2 ;;
esac
