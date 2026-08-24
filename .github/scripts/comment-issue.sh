#!/usr/bin/env bash
# Scoped comment wrapper for the Claude issue-triage workflow.
# Only comments on the issue identified by $ISSUE_NUMBER (set by the workflow
# from the triggering event). Comment body is read from stdin to avoid any
# shell-escaping surprises with untrusted/multi-line text.
set -euo pipefail

: "${GH_TOKEN:?GH_TOKEN must be set}"
: "${GITHUB_REPOSITORY:?GITHUB_REPOSITORY must be set}"
: "${ISSUE_NUMBER:?ISSUE_NUMBER must be set}"

if [[ $# -ne 0 ]]; then
  echo "comment-issue.sh: no arguments expected, pass the comment body via stdin" >&2
  exit 1
fi

gh issue comment "$ISSUE_NUMBER" --repo "$GITHUB_REPOSITORY" --body-file -
