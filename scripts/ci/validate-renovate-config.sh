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

# Exercise the runner manager with workflow content, using the same named
# captures as Renovate. Keep fixture labels independent of the production
# runner default so extraction coverage survives future image bumps.
jq -e --rawfile workflow tests/fixtures/renovate/runner-images.yml '
  [.customManagers[]? | select(.datasourceTemplate == "github-runners")] as $managers
  | $managers[0] as $manager
  | ($managers | length) == 1
  and ($manager.customType == "regex")
  and ($manager.depNameTemplate == "ubuntu")
  and ($manager.description | length > 0)
  and ($manager.matchStrings | length == 2)
  and (
    [".github/workflows/ci.yml", ".github/workflows/ci.yaml"]
    | all(. as $path | any($manager.managerFilePatterns[];
        .[1:-1] as $pattern | $path | test($pattern)))
  )
  and (
    ["README.md", "renovate.json", "examples/ci.yml",
     "tests/fixtures/renovate/runner-images.yml", ".github/workflows/ci.yml.bak"]
    | all(. as $path | all($manager.managerFilePatterns[];
        .[1:-1] as $pattern | $path | test($pattern) | not))
  )
  and (
    [$manager.matchStrings[] as $pattern
     | $workflow | capture($pattern; "g")
     | [$manager.depNameTemplate, $manager.datasourceTemplate, .currentValue]]
    | sort == [
        ["ubuntu", "github-runners", "24.04"],
        ["ubuntu", "github-runners", "26.04"],
        ["ubuntu", "github-runners", "26.04"],
        ["ubuntu", "github-runners", "28.04"],
        ["ubuntu", "github-runners", "28.04"]
      ]
  )
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
