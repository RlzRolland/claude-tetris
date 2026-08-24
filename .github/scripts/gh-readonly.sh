#!/usr/bin/env bash
# Read-only gh wrapper for the Claude issue-triage workflow.
# Only allows: `issue view [<number>]`, `label list`, `search issues <query>`.
# The issue number, if given, must match $ISSUE_NUMBER set by the workflow.
set -euo pipefail

: "${GH_TOKEN:?GH_TOKEN must be set}"
: "${GITHUB_REPOSITORY:?GITHUB_REPOSITORY must be set}"
: "${ISSUE_NUMBER:?ISSUE_NUMBER must be set}"

case "${1:-}" in
  issue)
    case "${2:-}" in
      view)
        num="${3:-$ISSUE_NUMBER}"
        if [[ "$num" != "$ISSUE_NUMBER" ]]; then
          echo "gh-readonly.sh: only issue #$ISSUE_NUMBER may be viewed" >&2
          exit 1
        fi
        gh issue view "$ISSUE_NUMBER" --repo "$GITHUB_REPOSITORY"
        ;;
      *)
        echo "gh-readonly.sh: unsupported 'issue' subcommand: ${2:-}" >&2
        exit 1
        ;;
    esac
    ;;
  label)
    if [[ "${2:-}" != "list" ]]; then
      echo "gh-readonly.sh: unsupported 'label' subcommand: ${2:-}" >&2
      exit 1
    fi
    gh label list --repo "$GITHUB_REPOSITORY"
    ;;
  search)
    if [[ "${2:-}" != "issues" ]]; then
      echo "gh-readonly.sh: unsupported 'search' subcommand: ${2:-}" >&2
      exit 1
    fi
    shift 2
    gh search issues --repo "$GITHUB_REPOSITORY" "$@"
    ;;
  *)
    echo "gh-readonly.sh: unsupported command: ${1:-}" >&2
    echo "Usage: gh-readonly.sh {issue view [<number>] | label list | search issues <query>}" >&2
    exit 1
    ;;
esac
