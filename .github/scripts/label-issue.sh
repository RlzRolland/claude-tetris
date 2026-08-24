#!/usr/bin/env bash
# Scoped label-editing wrapper for the Claude issue-triage workflow.
# Only edits the issue identified by $ISSUE_NUMBER (set by the workflow from
# the triggering event) — the target issue cannot be overridden by args.
set -euo pipefail

: "${GH_TOKEN:?GH_TOKEN must be set}"
: "${GITHUB_REPOSITORY:?GITHUB_REPOSITORY must be set}"
: "${ISSUE_NUMBER:?ISSUE_NUMBER must be set}"

args=()
while [[ $# -gt 0 ]]; do
  case "$1" in
    --add-label|--remove-label)
      if [[ $# -lt 2 ]]; then
        echo "label-issue.sh: $1 requires a value" >&2
        exit 1
      fi
      args+=("$1" "$2")
      shift 2
      ;;
    *)
      echo "label-issue.sh: unsupported argument: $1" >&2
      echo "Usage: label-issue.sh [--add-label <name> | --remove-label <name>]..." >&2
      exit 1
      ;;
  esac
done

if [[ ${#args[@]} -eq 0 ]]; then
  echo "label-issue.sh: at least one --add-label or --remove-label is required" >&2
  exit 1
fi

gh issue edit "$ISSUE_NUMBER" --repo "$GITHUB_REPOSITORY" "${args[@]}"
