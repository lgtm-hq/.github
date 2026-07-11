#!/usr/bin/env bash
# Validate shared Renovate preset JSON structure for org-wide consistency.
set -euo pipefail

jq empty renovate-config.json
jq -e '.extends | index("config:recommended") != null' renovate-config.json
jq -e '.osvVulnerabilityAlerts == true' renovate-config.json
jq -e '.dependencyDashboardOSVVulnerabilitySummary == "unresolved"' renovate-config.json
jq -e '
  (.vulnerabilityAlerts.addLabels | index("security") != null)
  and (.vulnerabilityAlerts.commitMessageSuffix == "[SECURITY]")
  and (.vulnerabilityAlerts.automerge == false)
' renovate-config.json
jq -e '.packageRules | type == "array" and length > 0' renovate-config.json
jq -e '
  [.packageRules[]?
   | select(.groupName == "lgtm-ci")
   | select(.automerge == false)
   | select((.matchManagers // []) | index("github-actions") != null)
   | select((.matchManagers // []) | index("custom.regex") != null)
   | select(
       any((.matchPackageNames // [])[]; test("lgtm-hq"))
     )
  ] | length >= 1
' renovate-config.json
jq -e '
  (.customManagers // [])
  | map(select(.depNameTemplate == "lgtm-hq/lgtm-ci"))
  | . as $managers
  | ($managers | length) == 4
  and ($managers | all(has("autoReplaceStringTemplate")))
  and ($managers | map(select(.description | test("tooling-ref.*single-quoted"))) | length) == 1
  and ($managers | map(select(.description | test("tooling-ref.*double-quoted"))) | length) == 1
  and (
    $managers
    | map(select(.description | test("checkout ref pins \\(single-quoted\\)")))
    | length
  ) == 1
  and (
    $managers
    | map(select(.description | test("checkout ref pins \\(double-quoted\\)")))
    | length
  ) == 1
  and (
    $managers
    | map(select(.matchStrings[]? | test("replaceString")))
    | length
  ) == 2
  and ($managers | all(has("extractVersionTemplate") | not))
  and (
    $managers
    | all(any(.matchStrings[]?; test("\\(\\?<currentValue>v\\[0-9]")))
  )
  and (
    $managers
    | all(any(.matchStrings[]?; test("\\(\\?<currentDigest>\\[a-f0-9]")))
  )
  and (
    $managers
    | all(.autoReplaceStringTemplate | test("\\{\\{newDigest\\}\\}"))
  )
  and (
    $managers
    | all(.autoReplaceStringTemplate | test("# \\{\\{newVersion\\}\\}"))
  )
' renovate-config.json
