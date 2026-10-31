const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { test } = require("node:test");

const config = JSON.parse(readFileSync("renovate-config.json", "utf8"));
const workflow = readFileSync("tests/fixtures/renovate/runner-images.yml", "utf8");
const managers = config.customManagers.filter((manager) => {
  const isRunner = manager.datasourceTemplate === "github-runners";
  return isRunner && manager.depNameTemplate === "ubuntu";
});
const expected = [
  ["ubuntu", "github-runners", "26.04"],
  ["ubuntu", "github-runners", "28.04"],
  ["ubuntu", "github-runners", "24.04"],
  ["ubuntu", "github-runners", "26.04"],
  ["ubuntu", "github-runners", "28.04"],
];

// Use JavaScript global matching, including Renovate's recursive narrowing.
// This fixture test does not perform Renovate schema validation or lookups.
function extract(content, manager, index = 0) {
  const dependencies = [];
  const pattern = new RegExp(manager.matchStrings[index], "g");
  for (const match of content.matchAll(pattern)) {
    if (index + 1 < manager.matchStrings.length) {
      dependencies.push(...extract(match[0], manager, index + 1));
    } else {
      dependencies.push({
        depName: manager.depNameTemplate,
        datasource: manager.datasourceTemplate,
        currentValue: match.groups.currentValue,
        replaceString: match[0],
      });
    }
  }
  return dependencies;
}

function identity(dependency) {
  return [dependency.depName, dependency.datasource, dependency.currentValue];
}

test("Ubuntu expression and recursive override managers are configured", () => {
  assert.equal(managers.length, 2, "Expected two Ubuntu runner custom managers");
  const strategies = managers.map((manager) => manager.matchStringsStrategy ?? "any");
  assert.deepEqual(strategies.sort(), ["any", "recursive"]);
  for (const manager of managers) {
    assert.equal(manager.customType, "regex");
    assert.ok(manager.description.length > 0);
    const count = manager.matchStringsStrategy === "recursive" ? 2 : 1;
    assert.equal(manager.matchStrings.length, count);
  }
});

test("runner managers select only workflow YAML paths", () => {
  for (const manager of managers) {
    const patterns = manager.managerFilePatterns.map((pattern) => {
      assert.match(pattern, /^\/.*\/$/, "Fixture checks require /regex/ patterns");
      return new RegExp(pattern.slice(1, -1));
    });
    for (const path of [".github/workflows/ci.yml", ".github/workflows/ci.yaml"]) {
      assert.ok(
        patterns.some((pattern) => pattern.test(path)),
        path,
      );
    }
    for (const path of [
      "README.md",
      "renovate.json",
      "examples/ci.yml",
      "tests/fixtures/renovate/runner-images.yml",
      ".github/workflows/ci.yml.bak",
    ]) {
      assert.ok(
        patterns.every((pattern) => !pattern.test(path)),
        path,
      );
    }
  }
});

for (const [ending, content] of [
  ["LF", workflow],
  ["CRLF", workflow.replaceAll("\n", "\r\n")],
  ["no final newline", workflow.trimEnd()],
]) {
  test(`extract only complete Ubuntu inputs and fallbacks (${ending})`, () => {
    const dependencies = managers.flatMap((manager) => extract(content, manager));
    assert.deepEqual(dependencies.map(identity), expected);

    const override = dependencies.find((dep) => dep.currentValue === "24.04");
    const updated = content.replace(
      override.replaceString,
      override.replaceString.replaceAll(override.currentValue, "30.04"),
    );
    assert.equal(
      updated,
      content.replace(
        "runner-image: ubuntu-24.04 # Keep 24.04 in this comment.",
        "runner-image: ubuntu-30.04 # Keep 24.04 in this comment.",
      ),
      "Updating the input must preserve sibling values, comments and script content",
    );
  });
}
