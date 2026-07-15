#!/usr/bin/env bash
# Pulls the canonical OpenAPI spec from the citycalls-docs repo and stores a local
# copy in openapi/citycalls.yaml. Per docs/manish/01-project-and-repository-setup.md §3.
#
# Placeholder: fill in once citycalls-docs/openapi/citycalls.yaml exists and this
# repo's relationship to it (sibling checkout path, git submodule, or published
# artifact URL) is decided. For local development, the two simplest options are:
#   1. Sibling checkout:  cp ../docs/openapi/citycalls.yaml ./openapi/citycalls.yaml
#   2. Raw URL fetch:     curl -o ./openapi/citycalls.yaml <raw-url-to-citycalls-docs>/openapi/citycalls.yaml
set -euo pipefail

DOCS_REPO_PATH="${CITYCALLS_DOCS_PATH:-../docs}"
SOURCE="$DOCS_REPO_PATH/openapi/citycalls.yaml"
DEST="openapi/citycalls.yaml"

mkdir -p openapi

if [ -f "$SOURCE" ]; then
  cp "$SOURCE" "$DEST"
  echo "[sync-contracts] copied $SOURCE -> $DEST"
else
  echo "[sync-contracts] $SOURCE not found — set CITYCALLS_DOCS_PATH or create the spec first" >&2
  exit 1
fi
