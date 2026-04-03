# .github

Organization-wide GitHub configs and shared presets for the
[LGTM HQ](https://github.com/lgtm-hq) organization.

## What's Here

| Path | Purpose |
| --- | --- |
| `profile/README.md` | Organization profile displayed on the [LGTM HQ GitHub page](https://github.com/lgtm-hq) |
| `CODE_OF_CONDUCT.md` | Contributor Covenant v2.1 -- applies to all repos without their own |
| `CONTRIBUTING.md` | Org-wide contributing guide (commit conventions, PR process, linting) |
| `SECURITY.md` | Security policy and vulnerability reporting instructions |
| `SUPPORT.md` | Where and how to get help |
| `.github/ISSUE_TEMPLATE/` | Default issue templates (bug report, feature request, chooser config) |
| `.github/PULL_REQUEST_TEMPLATE.md` | Default PR template with Conventional Commits guidance |
| `.github/FUNDING.yml` | GitHub Sponsors configuration |
| `renovate-config.json` | Shared Renovate configuration preset for dependency management |

## How It Works

GitHub automatically uses files in this repository as defaults for any repository in the
`lgtm-hq` organization that does not have its own version of that file. See
[GitHub's documentation on default community health files][docs] for details.

[docs]: https://docs.github.com/en/communities/setting-up-your-project-for-healthy-contributions/creating-a-default-community-health-file
