const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { test } = require("node:test");

const config = JSON.parse(readFileSync("renovate-config.json", "utf8"));
const workflow = readFileSync("tests/fixtures/renovate/runner-images.yml", "utf8");
const managers = config.customManagers.filter((manager) => {
  const isRunner = manager.datasourceTemplate === "github-runners";
  return isRunner && manager.depNameTemplate === "ubuntu";
});
const expectedValues = {
  expression: "26.04",
  "compact-expression": "28.04",
  "unquoted-override": "24.04",
  "single-quoted-override": "26.04",
  "multiline-before-override": "24.04",
  "quoted-siblings-before-override": "24.04",
  "continued-before-override": "24.04",
  "expression-input": "26.04",
  "collision-target": "24.04",
  "double-quoted-override": "28.04",
};
const expected = [
  // Expression manager: runs-on and reusable workflow inputs.
  "26.04",
  "28.04",
  "26.04",
  // Literal runner-image manager.
  "24.04",
  "26.04",
  "24.04",
  "24.04",
  "24.04",
  "24.04",
  "28.04",
].map((value) => ["ubuntu", "github-runners", value]);

// Renovate 44.198.3 custom/regex/strategies: global matching at each level;
// recursive extraction uses the final match, not its parent, as replaceString.
// This test uses JS regexes and does not perform schema validation or lookups.
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

// Value-only path from Renovate 44.198.3 update/branch/auto-replace:
// autoReplaceGlobalMatch defaults to true WITHIN replaceString. File occurrences
// are tried individually, re-extracting at depIndex and rolling back failures
// before continuing. It does not replaceAll(replaceString) across the file.
function update(content, manager, depIndex, newValue) {
  const dependency = extract(content, manager)[depIndex];
  const { replaceString, currentValue, depName } = dependency;
  const escapedValue = currentValue.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const newString = replaceString.replace(new RegExp(escapedValue, "g"), newValue);
  const attempts = [];
  const start = content.indexOf(replaceString);
  if (start === -1) return { content, attempts };
  for (let index = start; index < content.length; index += 1) {
    if (!content.startsWith(replaceString, index)) continue;
    const candidate =
      content.slice(0, index) + newString + content.slice(index + replaceString.length);
    const extracted = extract(candidate, manager)[depIndex];
    const accepted = extracted?.depName === depName && extracted.currentValue === newValue;
    attempts.push({ index, accepted });
    if (accepted) return { content: candidate, attempts };
  }
  throw new Error("No candidate updated the extracted runner dependency");
}

function identity(dependency) {
  return [dependency.depName, dependency.datasource, dependency.currentValue];
}

// Split only the fixture's job keys, preserving the header and all job text.
function fixtureParts(content) {
  return content.split(/(?=^ {2}[a-z][a-z0-9-]*:\r?$)/m);
}

function jobName(part) {
  return /^ {2}([a-z][a-z0-9-]*):/.exec(part)?.[1];
}

test("runner managers retain recursive scoping and the built-in runner group", () => {
  assert.equal(managers.length, 2, "Expected two Ubuntu runner custom managers");
  for (const manager of managers) {
    assert.equal(manager.customType, "regex");
    assert.ok(manager.description.length > 0);
    assert.equal(manager.matchStringsStrategy, "recursive");
    assert.equal(manager.matchStrings.length, 3);
    assert.equal(manager.autoReplaceStringTemplate, undefined);
    assert.equal(manager.versioningTemplate, undefined);
  }
  const groups = config.packageRules.filter((rule) =>
    rule.matchDatasources?.includes("github-runners"),
  );
  assert.equal(groups.length, 1);
  assert.equal(groups[0].groupName, "github runner images");
  assert.equal(groups[0].groupSlug, "github-runner-images");
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
  test(`extract only complete Ubuntu selections (${ending})`, () => {
    const dependencies = managers.flatMap((manager) => extract(content, manager));
    assert.deepEqual(dependencies.map(identity), expected);
  });

  test(`check each positive and negative fixture independently (${ending})`, () => {
    let positiveCount = 0;
    for (const part of fixtureParts(content)) {
      const name = jobName(part);
      const input = name ? `jobs:\n${part}` : part;
      const dependencies = managers.flatMap((manager) => extract(input, manager));
      const value = expectedValues[name];
      const wanted = value ? [["ubuntu", "github-runners", value]] : [];
      assert.deepEqual(dependencies.map(identity), wanted, name ?? "header");
      if (value) positiveCount += 1;
    }
    assert.equal(positiveCount, Object.keys(expectedValues).length);
  });

  test(`update all selections while preserving unrelated same-value text (${ending})`, () => {
    let updated = content;
    for (const manager of managers) {
      const dependencies = extract(content, manager);
      for (let depIndex = 0; depIndex < dependencies.length; depIndex += 1) {
        updated = update(updated, manager, depIndex, "30.04").content;
      }
    }
    const wanted = fixtureParts(content)
      .map((part) => {
        if (!expectedValues[jobName(part)]) return part;
        return part.replace(
          /^( {4}runs-on| {6}runner-image):([^\r\n]*?)ubuntu-\d+\.\d+/gm,
          "$1:$2ubuntu-30.04",
        );
      })
      .join("");
    assert.equal(
      updated,
      wanted,
      "Only actual selections may change; preserve siblings, comments, env and scripts",
    );
    assert.ok(
      managers
        .flatMap((manager) => extract(updated, manager))
        .every((dep) => dep.currentValue === "30.04"),
    );
  });

  test(`reject an env collision, continue to the override and leave later env alone (${ending})`, () => {
    const parts = fixtureParts(content).filter((part) =>
      ["collision-before", "collision-target", "collision-after"].includes(jobName(part)),
    );
    const collision = `jobs:\n${parts.join("")}`;
    const manager = managers[1];
    const [override] = extract(collision, manager);
    // All three lines have byte-for-byte identical replaceString text.
    assert.equal(collision.split(override.replaceString).length - 1, 3);
    const result = update(collision, manager, 0, "30.04");
    assert.deepEqual(
      result.attempts.map((attempt) => attempt.accepted),
      [false, true],
    );
    assert.equal(
      result.content,
      collision.replace(
        "runner-image: ubuntu-24.04 # Keep 24.04 in this comment.",
        "runner-image: ubuntu-30.04 # Keep 24.04 in this comment.",
      ),
    );
  });
}
