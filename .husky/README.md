# Husky Git Hooks

This directory contains Git hooks managed by Husky.

## Pre-commit Hook

The pre-commit hook automatically bumps the package version before each commit:

- **main branch**: Bumps patch version (e.g., 1.0.6 → 1.0.7)
- **develop branch**: Creates snapshot version with timestamp (e.g., 1.0.6-snapshot.20251111043000)
- **other branches**: No version change

The updated `package.json` is automatically added to your commit.

## Setup

Husky is configured in `packages/base/package.json` with the `prepare` script. When you run `yarn install`, it automatically sets up the hooks.

If hooks aren't working, ensure git is configured to use them:
```bash
git config core.hooksPath .husky
```
