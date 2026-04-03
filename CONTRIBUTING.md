# Contributing to LGTM HQ

Thank you for your interest in contributing! This guide covers the conventions shared
across all repositories in the **lgtm-hq** organization. Individual projects may have
additional requirements documented in their own `CONTRIBUTING.md`.

## Getting Started

1. **Fork** the repository you want to contribute to.
2. **Clone** your fork and create a feature branch from `main`:

   ```bash
   git checkout -b feat/my-feature
   ```

3. **Install dependencies** using the project's preferred package manager:
   - **Python** projects: use [uv](https://docs.astral.sh/uv/)
   - **JavaScript / TypeScript** projects: use [Bun](https://bun.sh/)
   - **Rust** projects: use `cargo`
   - **Ruby** projects: use `bundle`

4. Make your changes, add tests, and verify everything passes locally.
5. Push your branch and open a Pull Request.

## Commit Conventions

All repositories use [Conventional Commits](https://www.conventionalcommits.org/).
The PR title becomes the merge commit message (squash merge), so it must follow this
format:

```text
<type>(<optional-scope>): concise summary
```

### Types

| Type       | Description                          | Version Bump |
| ---------- | ------------------------------------ | ------------ |
| `feat`     | New feature                          | MINOR        |
| `fix`      | Bug fix                              | PATCH        |
| `perf`     | Performance improvement              | PATCH        |
| `docs`     | Documentation only                   | None         |
| `refactor` | Code change with no feature or fix   | None         |
| `test`     | Adding or updating tests             | None         |
| `chore`    | Build, CI, or tooling changes        | None         |
| `ci`       | CI configuration                     | None         |
| `style`    | Formatting or whitespace             | None         |

### Breaking Changes

Indicate a breaking change by adding `!` after the type:

```text
feat(api)!: remove deprecated endpoint
```

Or include `BREAKING CHANGE:` in the commit footer.

## Linting and Formatting

Where applicable, we use **[lintro](https://github.com/lgtm-hq/py-lintro)** as the
single entry point for linting and formatting:

```bash
# Check for issues
uv run lintro chk

# Auto-fix formatting
uv run lintro fmt
```

Do not invoke individual linters (ruff, black, prettier, etc.) directly -- use lintro
so that configuration stays consistent.

## Pull Request Process

1. **Title**: Must follow Conventional Commits (it drives the changelog).
2. **Description**: Use the PR template. Explain *what* changed and *why*.
3. **Tests**: Add or update tests to cover your changes.
4. **CI**: All checks must pass before merge.
5. **Review**: At least one maintainer approval is required.
6. **Merge**: We use **squash merge** so that the PR title becomes the single commit.

## Reporting Issues

- Use the issue templates provided in each repository.
- Search existing issues before opening a new one.
- For security vulnerabilities, **do not** open a public issue. See
  [SECURITY.md](SECURITY.md) instead.

## Code of Conduct

All participants are expected to follow our
[Code of Conduct](CODE_OF_CONDUCT.md). Be kind, be constructive, and assume good
intent.

## License

By contributing to any LGTM HQ project, you agree that your contributions will be
licensed under that project's license (typically MIT).
