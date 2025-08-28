# Automated Publishing Setup Guide

## Prerequisites

1. **NPM Account**: You need an NPM account with publish access
2. **GitHub Repository**: Your code must be in a GitHub repository
3. **NPM Token**: You need an NPM access token

## Step 1: Create NPM Access Token

1. Go to [NPM Settings](https://www.npmjs.com/settings)
2. Click on "Access Tokens" in the left sidebar
3. Click "Generate New Token"
4. Select "Automation" token type
5. Copy the generated token (you won't see it again!)

## Step 2: Add NPM Token to GitHub Secrets

1. Go to your GitHub repository
2. Click "Settings" tab
3. Click "Secrets and variables" → "Actions"
4. Click "New repository secret"
5. Name: `NPM_TOKEN`
6. Value: Paste your NPM access token
7. Click "Add secret"

## Step 3: Test the Workflow

1. Make a small change to your code
2. Commit with conventional commit format:
   ```bash
   git commit -m "feat: add automated publishing workflow"
   ```
3. Push to main branch:
   ```bash
   git push origin main
   ```
4. Check the Actions tab in GitHub to see the workflow running

## Step 4: Verify Publishing

1. Check NPM: https://www.npmjs.com/package/vsix-downloader
2. Check GitHub Releases: Your repository's releases page
3. Verify version bump in package.json

## Troubleshooting

### Workflow Fails to Publish
- Check that `NPM_TOKEN` secret is set correctly
- Verify you have publish access to the NPM package
- Check workflow logs for specific error messages

### No Version Bump
- Ensure commits follow conventional commit format
- Check that commits are on the main branch
- Verify the workflow is triggered on push

### Permission Issues
- Make sure your NPM token has publish permissions
- Check that the package name is available on NPM
- Verify your GitHub account has write access to the repository

## Manual Override

If you need to manually trigger a release:

1. Go to your GitHub repository
2. Click "Actions" tab
3. Select "Publish to NPM" workflow
4. Click "Run workflow"
5. Select branch and click "Run workflow"

## Commit Message Examples

```bash
# New feature (bumps minor version)
git commit -m "feat: add support for custom output directories"

# Bug fix (bumps patch version)
git commit -m "fix: resolve URL parsing issue with special characters"

# Breaking change (bumps major version)
git commit -m "feat!: change default output directory to ./downloads"

# Documentation (bumps patch version)
git commit -m "docs: update README with new examples"

# Refactoring (bumps patch version)
git commit -m "refactor: improve error handling in downloader"

# Build changes (bumps patch version)
git commit -m "chore: update dependencies to latest versions"
```
