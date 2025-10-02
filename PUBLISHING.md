# Publishing Guide (semantic-release)

This project uses semantic-release for fully automated versioning and publishing.

## How it works

1. Development happens on `dev` branch with feature branches
2. When ready for release, create a release PR from `dev` to `main`
3. Merge the release PR to `main`
4. CI builds and runs `semantic-release`
5. semantic-release:
   - Determines next version (no manual bumping)
   - Updates/creates `CHANGELOG.md`
   - Publishes to npm
   - Creates git tag and GitHub Release
   - Commits changelog and package files back to `main` with [skip ci]

## Configuration

- Workflow: `.github/workflows/semantic-release.yml`
- Config: `package.json` → `release` section (plugins and branches)
- Secrets: set repository secret `NPM_TOKEN` (automation token). `GITHUB_TOKEN` is automatic.

## Usage

- Develop on feature branches off `dev`
- Merge feature branches to `dev`
- When ready to release, create a PR from `dev` to `main`
- Merge to `main` triggers the release
- To run locally (diagnostics):

  ```bash
  NPM_TOKEN=... GH_TOKEN=... npx semantic-release --no-ci
  ```

## Notes

- Do not manually edit `version` in `package.json`.
- Legacy workflows (manual publish, post-publish sync, auto-merge) were removed.

## Troubleshooting

- Missing `NPM_TOKEN` → set repo secret.
- No release generated → check commit messages comply with Conventional Commits.
- Build errors → fix `npm run build` locally, re-push.
