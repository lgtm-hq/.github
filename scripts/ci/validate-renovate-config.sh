#!/usr/bin/env bash
# Validate shared Renovate preset JSON structure for org-wide consistency.
set -euo pipefail

jq empty renovate-config.json
jq -e '.extends | index("config:recommended") != null' renovate-config.json
jq -e '.packageRules | type == "array" and length > 0' renovate-config.json
jq -e '
  [.packageRules[]?
   | select(.groupName == "lgtm-ci")
   | select(.automerge == false)
   | select((.matchManagers // []) | index("github-actions") != null)
   | select((.matchManagers // []) | index("regex") != null)
   | select(
       any((.matchPackageNames // [])[]; test("lgtm-hq"))
     )
  ] | length >= 1
' renovate-config.json
jq -e '
  (.customManagers // [])
  | map(select(.depNameTemplate == "lgtm-hq/lgtm-ci"))
  | length >= 4
' renovate-config.json
