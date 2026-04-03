# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in any LGTM HQ project, please report it
responsibly. **Do not open a public GitHub issue.**

### How to Report

1. Use [GitHub's private vulnerability reporting][advisory] for the affected repository.
2. Provide detailed steps to reproduce the vulnerability.
3. Include the affected version(s) and any relevant environment details.
4. Allow reasonable time for the issue to be addressed before any public disclosure.

If private vulnerability reporting is not available for a specific repository, email
**security@lgtm-hq.com** with the details.

[advisory]: https://docs.github.com/en/code-security/security-advisories/guidance-on-reporting-and-writing-information-about-vulnerabilities/privately-reporting-a-security-vulnerability

### What to Expect

- **Acknowledgment** within 3 business days.
- **Status updates** at least every 7 days until resolution.
- **Credit** in the advisory and release notes (unless you prefer anonymity).

## Supported Versions

Each project documents its supported versions in its own `SECURITY.md` (if present). As
a general rule, only the **latest minor release** of each project receives security
patches.

## Disclosure Policy

We follow [coordinated disclosure][disclosure]:

1. Reporter submits the vulnerability privately.
2. Maintainers confirm, triage, and develop a fix.
3. A new release is published with the fix.
4. A public advisory is issued, crediting the reporter.

We aim to release fixes within **14 days** of confirmation for critical issues and
**30 days** for lower-severity issues.

[disclosure]: https://en.wikipedia.org/wiki/Coordinated_vulnerability_disclosure

## Security Best Practices in Our Projects

### Action Pinning

All GitHub Actions in our workflows are pinned to full commit SHAs, not version tags.
The `validate-action-pinning` workflow enforces this policy.

### Dependency Management

- [Renovate](https://www.mend.io/renovate/) monitors dependencies across the org.
- Security updates are prioritized and reviewed promptly.
- GitHub secret scanning is enabled on all repositories.

### Workflow Permissions

Workflows follow the principle of least privilege -- default `contents: read` with
escalation only where required.
