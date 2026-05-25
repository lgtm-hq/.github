<!-- markdownlint-disable MD033 MD013 MD041 -->

<div align="center">

# .github

**Organization-wide GitHub configs and shared presets for [LGTM HQ](https://github.com/lgtm-hq).**

</div>

<!-- markdownlint-enable MD033 MD013 -->

## 📂 What's Here

- `profile/README.md`: Organization profile shown on the
  [LGTM HQ GitHub page](https://github.com/lgtm-hq).
- `CODE_OF_CONDUCT.md`: Contributor Covenant v2.1 for repos without their own.
- `CONTRIBUTING.md`: Org-wide contributing guide.
- `SECURITY.md`: Security policy and vulnerability reporting instructions.
- `SUPPORT.md`: Where and how to get help.
- `renovate-config.json`: Shared
  [Renovate](https://docs.renovatebot.com/) preset.
- `.github/ISSUE_TEMPLATE/`: Default issue templates.
- `.github/PULL_REQUEST_TEMPLATE.md`: Default PR template.
- `.github/FUNDING.yml`: GitHub Sponsors configuration.

## ⚙️ How It Works

GitHub automatically uses files in this repository as **defaults** for any
repository in the `lgtm-hq` organization that does not have its own version of
that file.

Shared configs like `renovate-config.json` are extended by individual repos:

```json
{
  "$schema": "https://docs.renovatebot.com/renovate-schema.json",
  "extends": ["local>lgtm-hq/.github:renovate-config"]
}
```

See [GitHub's documentation on default community health files][docs] for details.

<!-- Reference URL is intentionally unwrapped for readability. -->
<!-- markdownlint-disable MD013 -->
[docs]: https://docs.github.com/en/communities/setting-up-your-project-for-healthy-contributions/creating-a-default-community-health-file
<!-- markdownlint-enable MD013 -->

## GitHub Actions SHA Pinning + Renovate

LGTM HQ policy: pin GitHub Actions to **full commit SHAs only** — not
movable version tags (`@v4`, `@v1.2.3`). Each SHA pin must include a trailing
version comment so Renovate can discover and update it.

### Required format

```yaml
uses: org/action@abc123def4567890abcdef1234567890abcdef12 # v1.2.3
```

The same rule applies to lgtm-ci reusable workflows and tooling pins:

```yaml
uses: lgtm-hq/lgtm-ci/.github/workflows/reusable-quality.yml@abc123... # v0.18.4
with:
  tooling-ref: "abc123..." # v0.18.4
```

Manual checkouts of `lgtm-hq/lgtm-ci` must annotate the `ref:` field the same
way:

```yaml
- uses: actions/checkout@b4ffde65f46336ab88eb53be808477a3936bae11 # v4.1.1
  with:
    repository: lgtm-hq/lgtm-ci
    ref: "abc123..." # v0.18.4
```

Use the **release commit SHA**, not the annotated tag object SHA.

### Why version comments matter

The org Renovate preset sets `pinDigests: true` for the `github-actions`
manager, which keeps SHA-pinned `uses:` lines up to date — but only when
Renovate can read the dependency. [Bare SHA pins without a version comment are
disabled by Renovate][renovate-digest] and require manual repins.

Fields outside `uses:` — such as `tooling-ref:` and checkout `ref:` — are not
scanned by the github-actions manager. The org preset adds regex
`customManagers` for annotated lgtm-ci pins in those fields.

### Enforcement

CI enforcement lives in
[lgtm-ci action pinning policy](https://github.com/lgtm-hq/lgtm-ci/blob/main/docs/workflow-contract.md#action-pinning-policy)
(`validate-action-pinning`).
Workflow changes that use bare SHAs or tag refs fail that check.

[renovate-digest]: https://docs.renovatebot.com/modules/manager/github-actions/#digest-pinning-and-updating

## 📜 License

MIT License — see [LICENSE](LICENSE) for details.
