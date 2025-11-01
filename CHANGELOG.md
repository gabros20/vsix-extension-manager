# [2.0.0](https://github.com/gabros20/vsix-extension-manager/compare/v1.16.0...v2.0.0) (2025-11-01)

### Bug Fixes

- comprehensive code review fixes + interactive mode bugs (5 handlers) ([20474c4](https://github.com/gabros20/vsix-extension-manager/commit/20474c4d8c660789a4847cdc347d8b39cd980b4d))
- disable background update check in interactive mode ([59203ba](https://github.com/gabros20/vsix-extension-manager/commit/59203ba8ad3cbcd76603cddd6301e712c2ae7ca6))
- duplicate format prompt + reduce lint errors (60→52) ([cdfc65b](https://github.com/gabros20/vsix-extension-manager/commit/cdfc65b19cf020d683b437a522b339da4717a6e3))
- eliminate final 'as any' type casts (remove.ts, update.ts) ([e9442ca](https://github.com/gabros20/vsix-extension-manager/commit/e9442ca689718ebc24fd010fc87cb6ab13a4ac5a))
- eliminate final 3 'any' types with proper TypeScript ([7588728](https://github.com/gabros20/vsix-extension-manager/commit/7588728d453e338bb2057da6a83621a18e6aafa7))
- move default action registration after commands to prevent duplication ([edd6ad1](https://github.com/gabros20/vsix-extension-manager/commit/edd6ad11a3c0639b72c89e89bbb1130a43fce4f6))
- properly fix unused parameters (60→18 errors, 70% improvement) ([b67611c](https://github.com/gabros20/vsix-extension-manager/commit/b67611c41fe954ece4b2afe11cc49760d3069173))
- reduce lint errors from 52 to 40 (23% improvement) ([0578103](https://github.com/gabros20/vsix-extension-manager/commit/0578103800959af66260c2ad57dfc768df576af8))
- reduce lint errors from 60 to 27 (55% improvement) ([10eff4c](https://github.com/gabros20/vsix-extension-manager/commit/10eff4c3e06a63de9908cf0664e6616d903180a5))
- remove duplicate command registration causing UI duplication ([db69fe2](https://github.com/gabros20/vsix-extension-manager/commit/db69fe2777f4514f8e6c859977008a36c30b4388))
- replace all 'any' types with proper TypeScript (18→0 errors, 100% complete!) ([52bc852](https://github.com/gabros20/vsix-extension-manager/commit/52bc852edc5dc57329abc46768772824b84263c0))
- resolve additional type errors in v2.0 commands ([b2e4366](https://github.com/gabros20/vsix-extension-manager/commit/b2e43664387c88bfd131786bce20610bc2a08287))
- resolve all TypeScript type errors in v2.0 commands ([8321920](https://github.com/gabros20/vsix-extension-manager/commit/83219205574176274d4e63d4e0c8774d12df9ad1))
- resolve critical bugs and add YAML support with UX improvements ([c6bbb80](https://github.com/gabros20/vsix-extension-manager/commit/c6bbb803315bfa2a8f1ffcc97a54c221b4aaba61))
- resolve majority of TypeScript type errors in v2.0 commands ([97f49af](https://github.com/gabros20/vsix-extension-manager/commit/97f49af664b89fae453d54581e4a39fca53526ef))
- skip first-run wizard in non-TTY environments ([4928917](https://github.com/gabros20/vsix-extension-manager/commit/4928917bbb5ebb9f756add2f67eea6b821e7b8c8))
- update command registry to use default exports correctly ([9ea2482](https://github.com/gabros20/vsix-extension-manager/commit/9ea24827a2575c425b5bf95daf445d8cbac097b2))

### Features

- add comprehensive v2.0 implementation plan ([08e1d59](https://github.com/gabros20/vsix-extension-manager/commit/08e1d59873fbf2560c46b633cf807d118bdde172))
- add Docker-based isolated testing infrastructure ([8416e9d](https://github.com/gabros20/vsix-extension-manager/commit/8416e9d7237b3f674171bcf38f3adacfb683eaf3))
- add draft v2.0 UX improvement proposals and update workflows ([5284bf0](https://github.com/gabros20/vsix-extension-manager/commit/5284bf0058abdac5f67a9a1e37597cb54ec5fcad))
- add multi-select UX for update extensions ([eee39bb](https://github.com/gabros20/vsix-extension-manager/commit/eee39bb8e0cbd7e18e176c9ace396dd071956d56))
- complete v2.0 clean slate - all legacy removed ([9f15a71](https://github.com/gabros20/vsix-extension-manager/commit/9f15a71429ac1d4c84f631fbb29990a3811f2e98))
- convert rollback command to BaseCommand pattern ([d23cc72](https://github.com/gabros20/vsix-extension-manager/commit/d23cc72e400d756560afc91dd7da069466fb2985))
- create base command framework for v2.0 ([7b08eaf](https://github.com/gabros20/vsix-extension-manager/commit/7b08eaf6edf361def0ff01f3188be9de241b2851))
- create Clack-based UI component system ([8d9f7dd](https://github.com/gabros20/vsix-extension-manager/commit/8d9f7dd4b85f97a940fa04401e5c500f0b09c801))
- create unified add command entry point ([b72057f](https://github.com/gabros20/vsix-extension-manager/commit/b72057fddbf78ed9ff7d36dbfb0bd0d5012016e5))
- enhance extension removal with pagination, search, and selection persistence ([3724d49](https://github.com/gabros20/vsix-extension-manager/commit/3724d497381d1dcb489df436673186f639d9208a))
- enhance install flow with detailed failure reporting and graceful error handling ([8fa6ef6](https://github.com/gabros20/vsix-extension-manager/commit/8fa6ef6391dcb8c95dd7e6fba6f7b0f0f2b76e4c))
- implement config preference in interactive mode (Approach 1) ([4df4b24](https://github.com/gabros20/vsix-extension-manager/commit/4df4b24d318788543edd0d8bb708232078ac2675))
- implement full interactive mode with Clack menus ([5b89568](https://github.com/gabros20/vsix-extension-manager/commit/5b89568bdd9c3eb85e159ad647c2552b151ddbd7))
- implement info command with rich extension details ([c170d57](https://github.com/gabros20/vsix-extension-manager/commit/c170d574539a3f21c4c7ecea8d2e6ceec3d47846))
- implement list command with enhanced formats ([57793d1](https://github.com/gabros20/vsix-extension-manager/commit/57793d1971250f34f8f1af88b75996822e392d36))
- implement plan generation system ([940f59c](https://github.com/gabros20/vsix-extension-manager/commit/940f59c5351753d2d26075c57684e62c934c9f1e))
- implement plan preview UI with Clack ([ac986dc](https://github.com/gabros20/vsix-extension-manager/commit/ac986dcf4f467a136da67ff2b9f891b27c37f0d6))
- implement remove command with enhanced UX ([de43ea1](https://github.com/gabros20/vsix-extension-manager/commit/de43ea1e2e9a7ad348e122036d9e394f7791eeff))
- implement smart input detection and add command executor ([e302963](https://github.com/gabros20/vsix-extension-manager/commit/e302963fc7802400025b3ece028d8fd7dbd52982))
- implement update command with smart rollback ([3901f9c](https://github.com/gabros20/vsix-extension-manager/commit/3901f9ca9fc528172c54eb279eb0f4c7935898e8))
- implement Week 4 - Enhanced Error Handling & Doctor Command ([b2c001e](https://github.com/gabros20/vsix-extension-manager/commit/b2c001ef0006fbadc67db097cd148310f8427c14))
- implement Week 5 Task 5.1 - Unified Configuration System v2 ([2328790](https://github.com/gabros20/vsix-extension-manager/commit/2328790dc178e53c2812a2e791de4c4c236dc392))
- implement Week 5 Task 5.2 - First-Run Setup Wizard ([bb809f2](https://github.com/gabros20/vsix-extension-manager/commit/bb809f2b59541f64545bdcb7e9b70eebaab192e2))
- implement Week 6 Task 6.1 - Intelligent Retry System ([ad0a1ff](https://github.com/gabros20/vsix-extension-manager/commit/ad0a1fffc06a021aa9c5cbdc829288474ba04567))
- implement Week 6 Task 6.2 - Standardized JSON Output ([3d3ac24](https://github.com/gabros20/vsix-extension-manager/commit/3d3ac24a69ec60689233f35832d67b4a11d2de87))
- implement Week 7 - Update Notifications & Messaging Polish ([20d86f1](https://github.com/gabros20/vsix-extension-manager/commit/20d86f10960e0632969f43126b375d0a027a2451))
- implement Week 8 - Integration Testing & Documentation ([6f96606](https://github.com/gabros20/vsix-extension-manager/commit/6f966068c305a310d8eae5b28844ce8daaffbf9d))
- integrate background update checker at startup ([b4ca414](https://github.com/gabros20/vsix-extension-manager/commit/b4ca414672888247bd765f9f9f1d77c836eac1f7))
- integrate config v2 and first-run detection at startup ([4fb04da](https://github.com/gabros20/vsix-extension-manager/commit/4fb04da0f5cfa1c221849396a42bf660293b4699))
- integrate Phase 2 systems into add command ([2c17bbf](https://github.com/gabros20/vsix-extension-manager/commit/2c17bbf376d697c08254a0930098027141bc2bfe))
- migrate doctor & setup to CommandResultBuilder ([37c26ac](https://github.com/gabros20/vsix-extension-manager/commit/37c26ac0ec72af4323c47c80001de46e604f041d))
- migrate remove/update/list/info to CommandResultBuilder ([8415ed5](https://github.com/gabros20/vsix-extension-manager/commit/8415ed5566716405e291436645a5285d04af3a74))
- remove all migration code - clean slate v2.0 ([f849f6d](https://github.com/gabros20/vsix-extension-manager/commit/f849f6dcf9309cf20e6dfddae49e8487d7cac544))
- wire add command into CLI with output formatter ([bf7b5a2](https://github.com/gabros20/vsix-extension-manager/commit/bf7b5a2830d2ec505f9d11a14c7fe470a299b01b))
- wire v2 commands into CLI + fix argument parsing ([ab9fc21](https://github.com/gabros20/vsix-extension-manager/commit/ab9fc21074d4569d0314a0ce6899cb2b5b2e9e8c))
- wire v2.0 commands into main CLI index ([3d1929e](https://github.com/gabros20/vsix-extension-manager/commit/3d1929e3464edea7ad6a8a0eb6ee442562c1f072))

### BREAKING CHANGES

- No v1.x compatibility - fresh start for v2.0
  User requested: Clean slate without v1.x migration support

Co-authored-by: factory-droid[bot] <138933559+factory-droid[bot]@users.noreply.github.com>

# Changelog

## [Unreleased]

### Fixed

- **Boolean flag handling:** Fixed critical bug where boolean flags with `defaultValue: "false"` were incorrectly evaluated as `true` due to `Boolean("false")` coercion. Removed all string boolean defaults from command options (add, remove, update, list, info)
- **Disk space check:** Fixed health check to show actual disk space instead of free RAM. Now uses platform-specific commands (`df` on macOS/Linux, `wmic` on Windows) for accurate reporting
- **Network connectivity:** Improved marketplace/OpenVSX connectivity checks to use GET requests with redirect support and proper User-Agent headers instead of HEAD requests that often failed
- **Local VSIX installation:** Fixed path resolution for local VSIX files to use absolute paths, preventing installation failures
- **EventEmitter warning:** Increased max listeners limit to 20 to prevent warnings during parallel operations (remove, update)
- **Remove flow UX:** Removed redundant confirmation prompt - now only asks once when removing extensions

### Added

- **YAML import/export support:** Full support for YAML format in extension lists alongside JSON and TXT
  - Import: Accepts `.yaml` and `.yml` files with auto-detection
  - Export: `list --format yaml` outputs human-readable YAML
  - Supports both simple array format and VS Code-compatible object with `recommendations` key
- **Interactive mode improvements:**
  - Reorganized Extension Info menu with two options: "Single extension details" and "All installed extensions" (table view)
  - Moved table viewing from Export to Extension Info menu for better logical organization
  - Updated help text to be more relevant to interactive mode with menu navigation tips
  - Improved menu labels for clarity ("Export extensions list" instead of "List installed extensions")

### Changed

- **JSON export format:** `list` command now exports proper VS Code `extensions.json` format with `recommendations` key instead of plain arrays for better compatibility
- **Extension list parsing:** Added YAML format auto-detection based on content patterns (starts with `-` or contains `: `)
- **Input detection:** Updated to accept `.yaml` and `.yml` files as valid extension list formats
- **Interactive help:** Tailored help screen for interactive mode showing menu options and keyboard shortcuts instead of CLI commands

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
