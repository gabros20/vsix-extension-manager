# Publishing Guide

This project uses a **package.json-first** publishing strategy where the version in `package.json` is the source of truth.

## How It Works

1. **Manual Version Control**: Update `package.json` version manually (by author or AI assistant)
2. **Automatic Publishing**: When code is pushed to `main` branch, the workflow checks if the package.json version exists on NPM
3. **Smart Publishing**: Only publishes if the version doesn't exist on NPM
4. **Complete Release**: Creates NPM package, Git tag, and GitHub release automatically

## Publishing Workflow

### 🎯 Normal Publishing (Recommended)

1. **Update version in package.json**:

   ```bash
   # Option 1: Use npm version command
   npm version patch  # 1.4.1 → 1.4.2
   npm version minor  # 1.4.1 → 1.5.0
   npm version major  # 1.4.1 → 2.0.0

   # Option 2: Edit package.json manually
   # Change: "version": "1.4.1"
   # To:     "version": "1.4.2"
   ```

2. **Commit and push to main**:

   ```bash
   git add package.json
   git commit -m "chore: bump version to 1.4.2"
   git push origin main
   ```

3. **Automatic publishing**: GitHub Actions will:
   - ✅ Check if version exists on NPM
   - 🏗️ Build the project
   - 📦 Publish to NPM
   - 🏷️ Create Git tag
   - 📋 Create GitHub release with changelog

### 🚀 Force Publishing (Emergency)

If you need to republish an existing version:

1. Go to **Actions** → **Publish to NPM**
2. Click **Run workflow**
3. Enable **"Force publish even if version exists"**
4. Click **Run workflow**

## Version Strategy

### Semantic Versioning

- **PATCH** (1.4.1 → 1.4.2): Bug fixes, documentation updates
- **MINOR** (1.4.1 → 1.5.0): New features, backward compatible
- **MAJOR** (1.4.1 → 2.0.0): Breaking changes

### Pre-release Versions

- **Alpha**: `1.5.0-alpha.1` - Early development
- **Beta**: `1.5.0-beta.1` - Feature complete, testing
- **RC**: `1.5.0-rc.1` - Release candidate

## Workflow Behavior

### ✅ Will Publish When:

- Package.json version doesn't exist on NPM
- Force publish is enabled (manual workflow dispatch)

### ⏭️ Will Skip When:

- Package.json version already exists on NPM
- Provides clear instructions on next steps

### 📋 Always Creates:

- NPM package publication
- Git tag (`v1.4.1`)
- GitHub release with changelog
- Detailed summary in workflow

## Troubleshooting

### "Version already exists on NPM"

This is normal! It means package.json version is already published.

**Solution**: Update version in package.json:

```json
{
  "version": "1.4.2" // Increment from current
}
```

### Publishing Failed

1. Check NPM token is valid in repository secrets
2. Verify package name isn't taken
3. Check build passes locally: `npm run build`
4. Review workflow logs for specific error

### Git Tag Already Exists

The workflow checks for existing tags and won't recreate them.

### Missing Changelog

Changelog is auto-generated from commits since the last tag.

## Best Practices

### 📝 Version Management

- **Keep package.json as source of truth**
- **Update version before merging PRs**
- **Use semantic versioning consistently**
- **Add version bump commits separately from feature commits**

### 🔄 Development Workflow

```bash
# 1. Work on feature branch
git checkout -b feature/my-feature
# ... make changes ...
git commit -m "feat: add new feature"

# 2. Before merging to main, update version
git checkout main
git pull origin main
npm version minor  # Updates package.json
git commit -m "chore: bump version to 1.5.0"
git push origin main

# 3. Merge feature branch
git merge feature/my-feature
git push origin main
# 4. Publishing happens automatically
```

### 🤖 AI Assistant Integration

When working with AI assistants:

1. **Ask AI to update package.json version** when implementing features
2. **Let AI choose appropriate version bump** (patch/minor/major)
3. **AI can commit version changes** along with feature code

## Monitoring

### 📊 Check Publishing Status

- **GitHub Actions**: Monitor workflow runs
- **NPM**: Check package page for new versions
- **Releases**: Review GitHub releases for changelogs

### 🔍 Verify Publication

```bash
# Check latest published version
npm view vsix-downloader version

# Check all published versions
npm view vsix-downloader versions --json

# Install specific version
npm install vsix-downloader@1.4.1
```

---

This system ensures **seamless, conflict-free publishing** where package.json version is always the authoritative source of truth.
