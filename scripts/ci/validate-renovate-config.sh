#!/usr/bin/env bash
# Validate shared Renovate preset JSON structure for org-wide consistency.
set -euo pipefail

jq empty renovate-config.json
jq -e '.extends | index("config:recommended") != null' renovate-config.json
jq -e '.packageRules | length > 0' renovate-config.json
