# [2.0.0](https://github.com/gabros20/vsix-extension-manager/compare/v1.16.0...v2.0.0) (2024-12-19)

## 🚀 BREAKING CHANGES

This is a **complete refactor** of the CLI interface. While all functionality is preserved, the command structure and flag names have changed significantly.

### Command Structure Changes

**Old (v1.x) → New (v2.0):**
- `download`, `quick-install`, `from-list`, `install`, `install-direct` → **`add`** (universal entry point)
- `uninstall` → **`remove`**
- `update-installed` → **`update`**
- `export-installed` → **`list`**
- `versions` → **`info`**
- New: **`doctor`** (health check and diagnostics)
- New: **`setup`** (first-run configuration wizard)

### Flag Changes

**Simplified and standardized:**
- `--verbose` → `--debug`
- `--reinstall` → `--force`
- `--check-compatibility` → `--check-compat`
- `--allow-mismatched-binary` → `--allow-mismatch`
- `--install-parallel` → `--parallel`
- `--no-install` → `--download-only`
- `--out-dir` → `--output`

**Removed (use positional arguments):**
- `--url`, `--vsix`, `--file`, `--dir`, `--id` → Use: `vsix add <input>`

### Configuration Changes

- **New:** YAML-based configuration (`.vsix/config.yml`)
- **New:** Profile support for different environments
- **Automatic migration** from v1.x config files
- Enhanced configuration with more options and better organization

### Features

#### Universal `add` Command
- **Smart input detection** - automatically determines input type (URL, file, directory, list, extension ID)
- **Unified workflow** - one command for all installation scenarios
- **Plan preview** - shows what will happen before executing
- **Automatic retry** - intelligent retry with escalating strategies
- **Enhanced error handling** - contextual suggestions and recovery options

#### Configuration System v2.0
- **YAML configuration** - human-readable, easy to edit
- **Profile support** - switch between different configurations (production, development, CI)
- **Automatic migration** - seamlessly upgrades v1.x configs to v2.0
- **Enhanced precedence** - CLI > ENV > File > Defaults (clearly documented)
- **First-run wizard** - interactive setup on first use

#### Background Update Checker
- **Non-blocking checks** - doesn't interrupt workflow
- **Smart caching** - respects configured frequency (never, daily, weekly, always)
- **Minimal notifications** - subtle hints about available updates
- **Zero telemetry** - completely local checking

#### Health Check & Diagnostics
- **`doctor` command** - comprehensive health checks
- **Auto-fix** - automatically repair common issues
- **Proactive detection** - find problems before they cause failures
- **Clear reports** - easy-to-understand diagnostic output

#### Standardized Output
- **Consistent JSON API** - machine-readable across all commands
- **Multiple formats** - table, JSON, YAML, CSV, plain text
- **Proper exit codes** - reliable for CI/CD integration
- **Rich details** - comprehensive information in all modes

#### Intelligent Retry System
- **Automatic retry** - handles transient failures
- **Escalating strategies** - timeout increase, direct install, download-only fallback
- **User intervention** - prompts for decisions when automated recovery fails
- **Batch context** - shared retry state across multiple operations

### Improvements

- **Code quality:** ~777 lines of boilerplate removed
- **Build:** 0 TypeScript errors
- **Architecture:** Clean separation of command layer and business logic
- **Error handling:** Contextual suggestions and automated recovery
- **User experience:** Progressive disclosure, smart defaults, fail-forward design
- **Performance:** Optimized startup, efficient caching, parallel operations
- **Testing:** 61 integration tests covering core workflows

### Deprecated/Removed

**Removed commands** (functionality moved to unified commands):
- `download` - Use `add <input> --download-only`
- `quick-install` - Use `add <url>`
- `from-list` - Use `add <list-file>`
- `install` - Use `add <file|directory>`
- `install-direct` - Use `add` (auto-detects method)
- `export-installed` - Use `list --output <file>`
- `update-installed` - Use `update`
- `uninstall` - Use `remove <id>`

**Interactive mode temporarily disabled:**
- Will be redesigned with v2.0 command structure
- Use direct commands: `vsix add`, `vsix remove`, `vsix update`, `vsix list`, `vsix info`

### Migration Guide

See [MIGRATION.md](./MIGRATION.md) for complete migration documentation.

**Quick Reference:**
```bash
# v1.x → v2.0 command mapping
vsix-extension-manager download --url <url>           → vsix-extension-manager add <url>
vsix-extension-manager quick-install --url <url>      → vsix-extension-manager add <url>
vsix-extension-manager install --vsix <file>          → vsix-extension-manager add <file>
vsix-extension-manager from-list --file <list>        → vsix-extension-manager add <list>
vsix-extension-manager export-installed -o list.txt   → vsix-extension-manager list --output list.txt
vsix-extension-manager update-installed               → vsix-extension-manager update
vsix-extension-manager uninstall <id>                 → vsix-extension-manager remove <id>
vsix-extension-manager versions <id>                  → vsix-extension-manager info <id>
```

---

# [1.16.0](https://github.com/gabros20/vsix-extension-manager/compare/v1.15.0...v1.16.0) (2025-10-01)

### Bug Fixes

- add VS Code bug workarounds to uninstall process ([c419c76](https://github.com/gabros20/vsix-extension-manager/commit/c419c763dbff9613963cff2f8fb3b02b17e8fbb7))
- add VS Code bug workarounds with delays ([b7dd79f](https://github.com/gabros20/vsix-extension-manager/commit/b7dd79f69b04af54f74ad4cc7c2c0ca1cee872bb))
- enhance preflight checks for installation issues ([08c16fe](https://github.com/gabros20/vsix-extension-manager/commit/08c16fed13ebfda6ae627bc81f26304d015c216e))
- enhance VS Code bug workarounds with retry logic ([f93866b](https://github.com/gabros20/vsix-extension-manager/commit/f93866bb1dfec1bee22a3ca9cbfa55231054bc20))
- ensure file state before each installation ([1a2013f](https://github.com/gabros20/vsix-extension-manager/commit/1a2013f0deff9c0e04efecaa992f68c9dc93e4de))
- handle missing extensions.json during uninstall ([e94f052](https://github.com/gabros20/vsix-extension-manager/commit/e94f052a34ca4a8cf653fb728fc73130d7525275))
- improve installation error handling and cleanup ([046afa1](https://github.com/gabros20/vsix-extension-manager/commit/046afa1ff21d0f4f719bead9644d6a3e58265fa9))
- robust uninstall with pre-cleanup ([3467337](https://github.com/gabros20/vsix-extension-manager/commit/3467337c3917d08e2efe3013bcc4b2db5597451c))

### Features

- enhance extension compatibility checking with manual version support ([1f75cd6](https://github.com/gabros20/vsix-extension-manager/commit/1f75cd68ba8ae06c8383979818493a30e92906ce))
- implement bulletproof extensions folder cleanup ([a976a55](https://github.com/gabros20/vsix-extension-manager/commit/a976a551aaa9a79ffa0361d871d30eb3218c3292))

# [1.15.0](https://github.com/gabros20/vsix-extension-manager/compare/v1.14.0...v1.15.0) (2025-09-30)

### Features

- add extension compatibility checking with VS Code/Cursor versions ([f02e3a4](https://github.com/gabros20/vsix-extension-manager/commit/f02e3a44ed17ed67e53297ba7dc2c833e50406cc))

# [1.14.0](https://github.com/gabros20/vsix-extension-manager/compare/v1.13.1...v1.14.0) (2025-09-30)

### Features

- add uninstall functionality and improve extension management ([d7eb482](https://github.com/gabros20/vsix-extension-manager/commit/d7eb482fdaaa897f44855d49c497c9c278551986))

## [1.13.1](https://github.com/gabros20/vsix-extension-manager/compare/v1.13.0...v1.13.1) (2025-09-24)

### Bug Fixes

- resolve NODE_ENV production issue preventing devDependencies installation ([eb96454](https://github.com/gabros20/vsix-extension-manager/commit/eb9645417c00fec810f773709566ad07fd30e9df))
- resolve TypeScript process and Node.js type errors ([a4c1766](https://github.com/gabros20/vsix-extension-manager/commit/a4c176614d4afa9b2dfd3846a088eda863bd63cb))

# [1.13.0](https://github.com/gabros20/vsix-extension-manager/compare/v1.12.0...v1.13.0) (2025-09-24)

### Bug Fixes

- update axios to 1.12.2 to address DoS vulnerability ([5a4cf83](https://github.com/gabros20/vsix-extension-manager/commit/5a4cf832c750df85ad969d5a242d144678841738))

### Features

- add update-installed command with selective update workflow ([5d53fe8](https://github.com/gabros20/vsix-extension-manager/commit/5d53fe8eebe449cd34a2e9977b2049900c3f1e11))

# [1.12.0](https://github.com/gabros20/vsix-extension-manager/compare/v1.11.0...v1.12.0) (2025-09-02)

### Features

- add quick-install command (temp download → install → cleanup) ([3e5bb9d](https://github.com/gabros20/vsix-extension-manager/commit/3e5bb9d4ae5464066e06f5e9a0c86260baaa7c56))

# [1.11.0](https://github.com/gabros20/vsix-extension-manager/compare/v1.10.0...v1.11.0) (2025-09-02)

### Features

- allow single install to accept directory and pick VSIX inside ([adbdbb2](https://github.com/gabros20/vsix-extension-manager/commit/adbdbb287dd13a97768953de8bd4ecd767fa2abf))

# [1.10.0](https://github.com/gabros20/vsix-extension-manager/compare/v1.9.1...v1.10.0) (2025-09-01)

### Features

- add bulk VSIX install flow, mismatch safeguards, and docs ([3e8c4a0](https://github.com/gabros20/vsix-extension-manager/commit/3e8c4a07364563de8f2f21153d5ea54de9ea0c70))

# [1.9.0](https://github.com/gabros20/vsix-extension-manager/compare/v1.8.0...v1.9.0) (2025-09-01)

### Features

- improve interactive labels and remove JSON export format ([fb7bdcf](https://github.com/gabros20/vsix-extension-manager/commit/fb7bdcfea6c40abe0855057dd7bfe0bd2beceb34))

# [1.8.0](https://github.com/gabros20/vsix-extension-manager/compare/v1.7.0...v1.8.0) (2025-08-29)

### Features

- add minimal interactive launcher; unify outputs; improve import/export UX ([08f3446](https://github.com/gabros20/vsix-extension-manager/commit/08f34468132a3c066a9392e0e7cb63b33b497ba8))

# [1.7.0](https://github.com/gabros20/vsix-extension-manager/compare/v1.6.0...v1.7.0) (2025-08-29)

### Bug Fixes

- clean up unused validation context and update architecture for parallel bulk ([c8940de](https://github.com/gabros20/vsix-extension-manager/commit/c8940de5ce262a127d9bf144cba62893e60a9198))

### Features

- **download:** add parallelism for non-interactive bulk; keep interactive sequential ([f3f43d9](https://github.com/gabros20/vsix-extension-manager/commit/f3f43d99acaf6b1cffecfb50af2076d41c9f4873))

# [1.6.0](https://github.com/gabros20/vsix-extension-manager/compare/v1.5.1...v1.6.0) (2025-08-29)

### Bug Fixes

- resolve merge conflicts with main branch ([7e9e9db](https://github.com/gabros20/vsix-extension-manager/commit/7e9e9dbdf2365d080d9e38edba4991cf052ff870))

### Features

- complete rebrand to VSIX Extension Manager with architectural refactor ([6f9424d](https://github.com/gabros20/vsix-extension-manager/commit/6f9424d258161889c31d423034c33b61df162825))

## [1.5.1](https://github.com/gabros20/vsix-downloader/compare/v1.5.0...v1.5.1) (2025-08-29)

### Bug Fixes

- **ci:** add @semantic-release/github to publish GitHub Releases ([4972e60](https://github.com/gabros20/vsix-downloader/commit/4972e60c7e0586534125ec833fbf5f04e5f4158f))

# [1.5.0](https://github.com/gabros20/vsix-downloader/compare/v1.4.1...v1.5.0) (2025-08-29)

### Features

- add OSS files and semantic-release CI/CD ([fda8320](https://github.com/gabros20/vsix-downloader/commit/fda8320c1d8335b85868e9a8eb2ea2ca0c4447ec))
