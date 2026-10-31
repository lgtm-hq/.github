const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
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

function runnerValue(expression, version) {
  return expression ? `\${{ vars.LGTM_CI_RUNNER || 'ubuntu-${version}' }}` : `ubuntu-${version}`;
}

// Keep parser-disputed YAML as text here: formatters must not normalize the
// six-space continuation into a supported shape. PyYAML 6.0.3 accepts it as
// scalar content; yaml 2.9.1 reports MISSING_CHAR / MULTILINE_IMPLICIT_KEY.
function quotedInput({ expression, quote, indent, actual, prefix = "" }) {
  const escape = (value) => (quote === "'" ? value.replaceAll("'", "''") : value);
  const fake = escape(runnerValue(expression, "24.04"));
  return [
    "jobs:",
    "  a:",
    "    with:",
    `      script: ${prefix}${quote}hello`,
    `${" ".repeat(indent)}runner-image: ${fake}`,
    `${" ".repeat(indent)}end${quote}`,
    ...(actual ? [`      runner-image: ${runnerValue(expression, "26.04")}`] : []),
    "",
  ].join("\n");
}

test("JS fallback bounds failed with-block searches without blocking the test runner", () => {
  // A timeout in node:test cannot interrupt a synchronous regex. Run the actual
  // configured intermediate patterns in a child that the parent can kill.
  const probe = `
    const { readFileSync } = require('node:fs');
    const patterns = JSON.parse(readFileSync(0, 'utf8'));
    const results = [];
    for (const pattern of patterns) {
      for (const ending of ['\\n', '\\r\\n']) {
        for (const count of [24, 48, 256]) {
          const lines = [
            'jobs:', '  a:', '    with:', '      script: |',
            ...Array(count).fill("        # runner-image: \${{ vars.LGTM_CI_RUNNER || 'ubuntu-24.04' }}"),
            ...Array(count).fill('        '),
            '      runner-image: ubuntu-24.04-custom',
            "      runner-image: \${{ vars.LGTM_CI_RUNNER || 'ubuntu-24.04' }}-custom",
            '',
          ];
          results.push(new RegExp(pattern, 'g').test(lines.join(ending)));
        }
      }
    }
    process.stdout.write(JSON.stringify(results));
  `;
  const child = spawnSync(process.execPath, ["-e", probe], {
    input: JSON.stringify(managers.map((manager) => manager.matchStrings[1])),
    encoding: "utf8",
    timeout: 3000,
    killSignal: "SIGKILL",
  });
  assert.ifError(child.error);
  assert.equal(child.status, 0, child.stderr);
  assert.deepEqual(JSON.parse(child.stdout), Array(12).fill(false));
});

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
  const lineEndings = (input) => {
    if (ending === "CRLF") return input.replaceAll("\n", "\r\n");
    return ending === "no final newline" ? input.trimEnd() : input;
  };

  test(`skip unsupported quoted continuations and preserve their text (${ending})`, () => {
    for (const expression of [false, true]) {
      for (const quote of ['"', "'"]) {
        for (const indent of [0, 4, 6]) {
          for (const actual of [false, true]) {
            const input = lineEndings(quotedInput({ expression, quote, indent, actual }));
            assert.deepEqual(
              managers.flatMap((manager) => extract(input, manager)),
              [],
              JSON.stringify({ expression, quote, indent, actual }),
            );
            // A column-zero continuation also ends the supported jobs region.
            if (indent === 0) continue;
            // Also exercise Renovate's replacement collision behavior: an
            // identical real selection in a later job may update, while every
            // byte of the unsupported block (including its override) survives.
            const target = `\n  target:\n    with:\n      runner-image: ${runnerValue(expression, "24.04")}\n`;
            const collision = `${input}${lineEndings(target)}`;
            const result = update(collision, managers[expression ? 0 : 1], 0, "30.04");
            assert.equal(
              result.content,
              `${input}${lineEndings(target.replaceAll("24.04", "30.04"))}`,
            );
          }
        }
      }
    }
    for (const prefix of ["&script ", "!!str ", "[", "{script: "]) {
      const input = lineEndings(
        quotedInput({ expression: false, quote: '"', indent: 6, actual: true, prefix }),
      );
      assert.deepEqual(
        managers.flatMap((manager) => extract(input, manager)),
        [],
        prefix,
      );
    }
  });

  test(`track real overrides after supported quoted scalars (${ending})`, () => {
    for (const expression of [false, true]) {
      for (const quote of ['"', "'"]) {
        for (const indent of [7, 8]) {
          const input = lineEndings(quotedInput({ expression, quote, indent, actual: true }));
          const manager = managers[expression ? 0 : 1];
          assert.deepEqual(extract(input, manager).map(identity), [
            ["ubuntu", "github-runners", "26.04"],
          ]);
          assert.equal(
            update(input, manager, 0, "30.04").content,
            input.replace("ubuntu-26.04", "ubuntu-30.04"),
          );
        }
      }
    }
  });

  test(`preserve deep comments and blank lines before real overrides (${ending})`, () => {
    for (const expression of [false, true]) {
      const input = lineEndings(
        [
          "jobs:",
          "  a:",
          "    with:",
          "# column-zero comment",
          "  # shallow comment",
          "      # input comment",
          "      script: |",
          "       # seven spaces",
          "        # deep comment",
          "        ",
          "       ",
          "",
          "      ",
          `      runner-image: ${runnerValue(expression, "26.04")}`,
          "",
        ].join("\n"),
      );
      const manager = managers[expression ? 0 : 1];
      assert.deepEqual(extract(input, manager).map(identity), [
        ["ubuntu", "github-runners", "26.04"],
      ]);
    }
  });

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
