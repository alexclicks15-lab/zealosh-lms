---
name: git-workflow-and-releases
description: >-
  Git version control, Conventional Commits, branch management, pull requests, and automated changelogs.
  Use this skill when preparing git commits, structuring branches, writing PR descriptions,
  generating release changelogs, managing merge conflicts, or conducting code reviews.
---

# Git Workflow & Release Engineering Runbook

This skill establishes structured version control practices, commit standards, pull request workflows, and release automation.

---

## 1. The 7-Step Development Lifecycle

```
[ UNDERSTAND ] ──> [ PLAN ] ──> [ IMPLEMENT ] ──> [ TEST & QA ] ──> [ REVIEW ] ──> [ COMMIT ] ──> [ PR / RELEASE ]
```

---

## 2. Conventional Commits Standard

Format all commit messages as:

```
<type>(<optional scope>): <description>

[optional body]

[optional footer(s)]
```

### Allowed Types:
- `feat`: A new feature for the user or system.
- `fix`: A bug fix.
- `refactor`: Code change that neither fixes a bug nor adds a feature.
- `perf`: A code change that improves performance.
- `test`: Adding missing tests or correcting existing tests.
- `docs`: Documentation only changes.
- `chore`: Changes to build process, tooling, or dependencies.
- `ci`: Changes to CI configuration files and scripts.

### Examples:
- `feat(cart): implement server action for atomic item addition`
- `fix(auth): prevent session token expiration on tab switch`
- `perf(db): add compound index on orders(customer_id, status)`

---

## 3. Pull Request (PR) Preparation

Before opening a PR, ensure:
1. **Self-Review**: Run `git diff` to inspect every added or modified line. Remove any debug `console.log` statements or commented-out code.
2. **Typecheck & Tests**: Verify all tests pass locally.
3. **PR Description**: Include:
   - **Summary**: Concise description of changes and business motivation.
   - **Related Issues / Tasks**: Reference issue IDs.
   - **Evidence & Screenshots**: Include before/after screenshots or terminal test output.
   - **Rollback Plan**: Strategy to revert safely if issues arise in production.

---

## 4. Safe Git Guardrails

- **Never Force Push (`--force`)** to `main` or `production` branches.
- **Never Commit Secrets**: Check `git status` to ensure `.env*` or credentials are not staged.
- **Atomic Commits**: Keep commits focused on a single logical change to enable clean cherry-picks and bisecting.
