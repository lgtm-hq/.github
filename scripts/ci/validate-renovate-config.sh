#!/usr/bin/env bash
# Validate shared Renovate preset JSON structure for org-wide consistency.
set -euo pipefail

jq empty renovate-config.json
jq -e '.extends | index("config:best-practices") != null' renovate-config.json
jq -e '.osvVulnerabilityAlerts == true' renovate-config.json
jq -e '.dependencyDashboardOSVVulnerabilitySummary == "unresolved"' renovate-config.json
jq -e '
  (.vulnerabilityAlerts.addLabels | index("security") != null)
  and (.vulnerabilityAlerts.commitMessageSuffix == "[SECURITY]")
  and (.vulnerabilityAlerts.automerge == false)
' renovate-config.json
jq -e '.packageRules | type == "array" and length > 0' renovate-config.json
jq -e '
  .packageRules as $rules
  | ($rules | to_entries | map(select(.value.groupName == "all major dependencies")) | first) as $majors
  | ($rules | to_entries | map(select(
      ((.value.matchDatasources // []) | index("github-runners") != null)
      and (.value.groupName == "github runner images")
    )) | first) as $runners
  | $majors != null
  and $runners != null
  and ($runners.key > $majors.key)
  and ($runners.value.groupSlug == "github-runner-images")
  and ($runners.value.groupSlug != $majors.value.groupSlug)
  and ($runners.value.matchUpdateTypes == ["major"])
  and ($runners.value.enabled != false)
  and ($runners.value | has("automerge") | not)
  and ($majors.value.groupSlug == "all-major")
' renovate-config.json
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
    | all(
        .autoReplaceStringTemplate
        | test("[^[:space:]] # \\{\\{newVersion\\}\\}$")
      )
  )
' renovate-config.json
jq -e '
  .customManagers as $all
  | ($all | map(select(.datasourceTemplate == "github-runners"))) as $managers
  | ($all | map(select(.depNameTemplate == "lgtm-hq/lgtm-ci"))[0].managerFilePatterns)
    as $workflow_files
  | ($managers | length) == 1
  and ($managers[0].customType == "regex")
  and ($managers[0].matchStringsStrategy == "recursive")
  and ($managers[0].versioningTemplate == "docker")
  and ($managers[0].depTypeTemplate == "github-runner")
  and ($managers[0].packageNameTemplate == "{{depName}}")
  and ($managers[0].autoReplaceStringTemplate == "{{depName}}-{{newValue}}")
  and ($managers[0].managerFilePatterns == $workflow_files)
  and ($managers[0].matchStrings | length) == 2
  and ($managers[0].matchStrings[0] | test("os\\|runner"))
  and ($managers[0].matchStrings[0] | test("runs-on"))
  and ($managers[0].matchStrings[0] | contains("{8,}"))
  and ($managers[0].matchStrings[1] | test("[(][?]<(depName)>ubuntu"))
  and ($managers[0].matchStrings[1] | contains("(?<currentValue>"))
  and ($managers[0].matchStrings[1] | contains("latest") | not)
' renovate-config.json

bash scripts/ci/validate-matrix-runner-regex.sh
