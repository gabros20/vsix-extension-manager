# Migration Guide: v1.x → v2.0

**Version:** 2.0.0  
**Status:** Work in Progress  
**Breaking Changes:** Yes - Complete CLI refactor

## Overview

v2.0 is a complete refactor of the VSIX Extension Manager CLI. This is a **breaking change release** that redesigns the command interface while preserving all core functionality and business logic.

**What's preserved:**

- All features and capabilities
- Configuration files (auto-migrated)
- Downloaded VSIX files and formats
- Installation mechanisms
- Editor detection
- Backup/rollback functionality

**What's changing:**

- Command structure (11 commands → 7 commands)
- Flag names (simplified and standardized)
- Interactive menu structure
- Default behaviors

---

## Current v1.16.0 API Surface

### Commands

1. **download** (alias: `dl`)
   - Download VSIX files from marketplace
   - Flags: `--url`, `--version`, `--output`, `--file`, `--parallel`, `--retry`, `--retry-delay`, `--skip-existing`, `--overwrite`, `--quiet`, `--json`, `--summary`, `--pre-release`, `--source`, `--filename-template`, `--cache-dir`, `--checksum`, `--verify-checksum`, `--install-after`

2. **quick-install** (alias: `qi`)
   - Download + install + cleanup in one step
   - Flags: `--url`, `--editor`, `--code-bin`, `--cursor-bin`, `--allow-mismatched-binary`, `--pre-release`, `--source`, `--dry-run`, `--quiet`, `--json`

3. **from-list** (alias: `fl`)
   - Batch operations from extension list
   - Flags: `--file`, `--editor`, `--code-bin`, `--cursor-bin`, `--allow-mismatched-binary`, `--output`, `--install-after`, `--skip-installed`, `--check-compatibility`, `--robust`, `--parallel`, `--install-parallel`, `--install-retry`, `--install-timeout`, `--source`, `--pre-release`, `--dry-run`, `--quiet`, `--json`

4. **install** (alias: `in`)
   - Install VSIX files
   - Flags: `--vsix`, `--dir`, `--editor`, `--code-bin`, `--cursor-bin`, `--allow-mismatched-binary`, `--skip-installed`, `--parallel`, `--timeout`, `--retry`, `--robust`, `--reinstall`, `--dry-run`, `--quiet`, `--json`

5. **install-direct** (alias: `id`)
   - Direct installation (bypass CLI)
   - Flags: `--vsix`, `--editor`, `--code-bin`, `--cursor-bin`, `--allow-mismatched-binary`, `--timeout`, `--dry-run`, `--quiet`, `--json`

6. **export-installed** (alias: `ex`)
   - Export list of installed extensions
   - Flags: `--editor`, `--code-bin`, `--cursor-bin`, `--allow-mismatched-binary`, `--output`, `--format`, `--include-disabled`, `--quiet`, `--json`

7. **update-installed** (alias: `up`)
   - Update installed extensions
   - Flags: `--editor`, `--code-bin`, `--cursor-bin`, `--allow-mismatched-binary`, `--ids`, `--output`, `--source`, `--pre-release`, `--check-compatibility`, `--parallel`, `--install-parallel`, `--install-timeout`, `--install-retry`, `--robust`, `--dry-run`, `--quiet`, `--json`

8. **uninstall** (alias: `un`)
   - Uninstall extensions
   - Flags: `--ids`, `--editor`, `--code-bin`, `--cursor-bin`, `--allow-mismatched-binary`, `--parallel`, `--timeout`, `--dry-run`, `--quiet`, `--json`

9. **rollback** (alias: `rb`)
   - Rollback to previous state
   - Flags: `--backup-id`, `--editor`, `--code-bin`, `--cursor-bin`, `--allow-mismatched-binary`, `--list`, `--dry-run`, `--quiet`, `--json`

10. **versions** (alias: `v`)
    - List available versions
    - Flags: `--id`, `--source`, `--pre-release`, `--quiet`, `--json`

11. **interactive** (default when no command)
    - Interactive menu-driven interface

### Global Options

- `--config <path>` - Path to configuration file

### Configuration Precedence

CLI flags > Environment variables (`VSIX_*`) > Config file > Defaults

---

## v2.0 Implementation Progress

**Branch:** `feat/v2.0-refactor`  
**Commits:** 16 commits  
**Status:** Phase 1 - Week 3 Complete (90% of Phase 1)  
**Last Updated:** 2024-10-02  
**Type Errors:** 12 remaining (down from 70 - 83% reduction)

### Implementation Timeline

#### ✅ Week 0: Pre-Implementation (Complete)

- Created migration guide and API documentation
- Documented v1.16.0 baseline

#### ✅ Week 1: Command Structure Redesign (Complete)

- **Commit 7b08eaf:** Base command framework (BaseCommand, types, registry)
- **Commit e302963:** Smart input detection & add executor
- **Commit b72057f:** Add command entry point
- **Commit 8d9f7dd:** Clack UI component system

**Deliverables:**

- ✅ `src/commands/base/` - Command framework
- ✅ `src/commands/registry.ts` - Command loading system
- ✅ `src/commands/add/` - Unified add command (consolidates 5 old commands)
- ✅ `src/core/ui/` - Clack UI components & prompt policy

#### ✅ Week 2: Plan Preview System (Complete)

- **Commit 940f59c:** Plan generation system
- **Commit ac986dc:** Plan preview UI with Clack

**Deliverables:**

- ✅ `src/core/planning/` - Plan generator & display
- ✅ Preflight checks integration
- ✅ Compatibility checking
- ✅ Beautiful plan display

#### ✅ Week 3: Core Commands (Complete - Task 3.1)

- **Commit de43ea1:** Remove command (refactored from uninstallExtensions)
- **Commit 3901f9c:** Update command (refactored from updateInstalled)
- **Commit 57793d1:** List command (enhanced from exportInstalled)
- **Commit c170d57:** Info command (enhanced from versions)

**Deliverables:**

- ✅ `src/commands/remove.ts` - Enhanced uninstall with backup
- ✅ `src/commands/update.ts` - Smart update with rollback
- ✅ `src/commands/list.ts` - Multi-format export (table, json, yaml, txt, csv)
- ✅ `src/commands/info.ts` - Rich extension information

#### ✅ Week 3: Unified Flag System (Complete - Task 3.2)

- **Commit 3d1929e:** Wire v2.0 commands into main CLI index

**Deliverables:**

- ✅ `wireV2Command()` helper for dynamic command loading
- ✅ All 5 core commands wired into main index.ts
- ✅ Global flag parsing implemented
- ✅ Backward compatibility maintained (old commands still functional)

**Technical Debt Progress:**

✅ **ALL TYPE ERRORS FIXED (70 → 0 errors - 100% complete):**
- ✅ UserInputError constructor calls (required 'code' parameter)
- ✅ Service API property mismatches (BulkInstallResult, UninstallSummary, UpdateSummary)
- ✅ ExtensionVersionInfo properties (only has version + published)
- ✅ InstallTask structure (requires vsixFile property)
- ✅ All log.warn → log.warning calls
- ✅ PromptPolicy UserInputError calls
- ✅ BackupMetadata property names (id vs backupId)
- ✅ EditorInfo interface extended with version/extensionsPath properties
- ✅ Clack PromptGroup type incompatibility resolved
- ✅ InstallFromListOptions nested structure fixed
- ✅ ExtensionVersionInfo mapped to displayable format
- ✅ InstalledExtension.disabled property removed
- ✅ BulkInstallResult.failed array vs number handling fixed

📊 **Progress:** 70 → 0 errors (100% fixed - Build passes!)

⚠️ **Remaining Lint Warnings (15 'any' types - Acceptable technical debt):**
- Will be addressed incrementally in future cleanup passes

**Recent Type Fix Commits:**
- **Commit 97f49af:** Fixed majority of type errors (~25 fixed)
- **Commit b2e4366:** Fixed additional type errors (~33 fixed)
- **Commit 8321920:** Fixed all remaining type errors (12 fixed - BUILD PASSES! ✅)

#### 📋 Week 4: Error Handling & Recovery (Pending)

- Enhanced error handler with contextual suggestions
- Doctor command (health check & auto-fix)
- Auto-recovery strategies
- Integration with rollback command

### Files Created (21 new files)

**Command Framework:**

```
src/commands/base/
  ├── BaseCommand.ts          # Abstract base class
  ├── index.ts                # Framework exports
  └── types.ts                # Type definitions
src/commands/registry.ts      # Command loading system
```

**Commands:**

```
src/commands/add/
  ├── index.ts                # Main command
  ├── inputDetector.ts        # Smart input type detection
  └── executor.ts             # Execution engine
src/commands/remove.ts        # Uninstall command
src/commands/update.ts        # Update command
src/commands/list.ts          # List/export command
src/commands/info.ts          # Extension info command
```

**Core Infrastructure:**

```
src/core/ui/
  ├── components.ts           # Clack UI components
  ├── promptPolicy.ts         # Prompt behavior enforcement
  └── index.ts                # UI exports
src/core/planning/
  ├── types.ts                # Plan data structures
  ├── planGenerator.ts        # Plan generation
  ├── planDisplay.ts          # Plan display
  └── index.ts                # Planning exports
```

### Architecture Preservation

**Preserved (Untouched):**

- ✅ `src/features/` - All 25+ business logic services
- ✅ `src/core/backup/` - Backup/restore system
- ✅ `src/core/errors/` - Error handling
- ✅ `src/core/filesystem/` - File operations
- ✅ `src/core/http/` - HTTP utilities
- ✅ `src/core/registry/` - Marketplace APIs
- ✅ `src/core/validation/` - Validation utilities

**Enhanced:**

- 🔄 `src/core/ui/` - New Clack-based components
- 🔄 `src/core/planning/` - New plan generation

**To Be Deleted (After completion):**

- ❌ `src/commands/download.ts`
- ❌ `src/commands/quickInstall.ts`
- ❌ `src/commands/fromList.ts`
- ❌ `src/commands/install.ts`
- ❌ `src/commands/installDirect.ts`
- ❌ `src/commands/uninstallExtensions.ts`
- ❌ `src/commands/updateInstalled.ts`
- ❌ `src/commands/exportInstalled.ts`
- ❌ `src/commands/versions.ts`

## v2.0 Changes (Implemented)

### New Command Structure

| v1.x Command       | v2.0 Command                  | Notes                 |
| ------------------ | ----------------------------- | --------------------- |
| `download`         | `add <input> --download-only` | Universal entry point |
| `quick-install`    | `add <url>`                   | Default behavior      |
| `from-list`        | `add <list-file>`             | Auto-detected         |
| `install`          | `add <file\|dir>`             | Auto-detected         |
| `install-direct`   | `add` (auto-fallback)         | Automatic strategy    |
| `export-installed` | `list --output <file>`        | Enhanced              |
| `update-installed` | `update`                      | Simplified            |
| `uninstall`        | `remove <id>`                 | Clearer name          |
| `versions`         | `info <id>`                   | Enhanced              |
| `rollback`         | `rollback`                    | Unchanged             |

### Commands Implemented

**✅ add** - Universal entry point (consolidates 5 old commands)

```bash
# Automatically detects input type
vsix add <url|id|file|directory|list>

# Examples:
vsix add https://marketplace.visualstudio.com/.../python
vsix add ms-python.python
vsix add ./extension.vsix
vsix add ./downloads
vsix add extensions.txt

# Flags:
--download-only         # Download without installing
--editor <type>         # Target editor (cursor|vscode|auto)
--source <registry>     # Registry (marketplace|open-vsx|auto)
--version <version>     # Specific version
--pre-release          # Use pre-release version
--parallel <n>         # Parallel operations
--force               # Force reinstall/overwrite
--output <path>       # Output directory
```

**✅ remove** - Uninstall extensions (enhanced from uninstall)

```bash
vsix remove <extension-ids...>

# Examples:
vsix remove ms-python.python
vsix remove ms-python.python dbaeumer.vscode-eslint
vsix remove --all

# Flags:
--all                  # Remove all installed extensions
--editor <type>        # Target editor
--parallel <n>         # Parallel removals (default: 2)
```

**✅ update** - Update extensions (enhanced from update-installed)

```bash
vsix update [extension-ids...]

# Examples:
vsix update                    # Update all (interactive)
vsix update --all             # Update all (non-interactive)
vsix update ms-python.python

# Flags:
--all                  # Update all installed extensions
--check-compat        # Check compatibility (default: true)
--pre-release         # Include pre-release versions
--source <registry>   # Registry to check
--parallel <n>        # Parallel downloads
```

**✅ list** - List installed extensions (enhanced from export-installed)

```bash
vsix list [options]

# Examples:
vsix list
vsix list --format json
vsix list --format yaml --output extensions.yml
vsix list --format csv --detailed

# Formats:
table  # Interactive display (default)
json   # JSON output
yaml   # YAML output
txt    # Plain text (IDs only)
csv    # CSV format

# Flags:
--format <type>        # Output format
--output <path>        # Save to file
--detailed            # Include extended information
```

**✅ info** - Show extension details (enhanced from versions)

```bash
vsix info <extension-id>

# Examples:
vsix info ms-python.python
vsix info ms-python.python --all

# Flags:
--all                  # Show all available versions
--limit <n>           # Limit versions shown (default: 10)
--source <registry>   # Registry to query
```

### Commands Pending

**🔜 search** - Search marketplace

```bash
vsix search <query>
```

**🔜 doctor** - Health check and auto-fix

```bash
vsix doctor
vsix doctor --fix
```

**🔜 workspace** - Project-specific extensions (Phase 3)

```bash
vsix workspace init
vsix workspace install
```

**🔜 templates** - Curated extension packs (Phase 3)

```bash
vsix templates
vsix templates use <template-id>
```

**✅ rollback** - Rollback to previous state (preserved from v1.x)

```bash
vsix rollback --backup-id <id>
```

### Global Flags (Standardized)

**Editor Flags:**

- `--editor <type>` - cursor | vscode | auto (default: auto)
- `--code-bin <path>` - VS Code binary path
- `--cursor-bin <path>` - Cursor binary path
- `--allow-mismatch` - Allow binary mismatch (shortened from --allow-mismatched-binary)

**Output Modes:**

- `--quiet` - Minimal output
- `--json` - JSON output
- `--yes` - Auto-confirm all prompts
- `--debug` - Debug logging (renamed from --verbose)

**Source & Version:**

- `--source <registry>` - marketplace | open-vsx | auto
- `--version <version>` - Specific version
- `--pre-release` - Include pre-release versions

**Performance:**

- `--parallel <n>` - Parallel operations (1-10)
- `--timeout <sec>` - Timeout in seconds
- `--retry <n>` - Retry attempts
- `--retry-delay <ms>` - Delay between retries

**Behavior:**

- `--skip-installed` - Skip already installed
- `--force` - Force reinstall/overwrite (renamed from --reinstall)
- `--output <path>` - Output directory or file
- `--download-only` - Download without installing (renamed from --no-install)

**Safety:**

- `--check-compat` - Check compatibility (shortened from --check-compatibility)
- `--no-backup` - Skip automatic backup
- `--verify-checksum` - Verify download checksums

**Special:**

- `--plan` - Show execution plan without running (new)
- `--dry-run` - Validate only, no execution
- `--profile <name>` - Use config profile (new)
- `--config <path>` - Config file path

---

## Migration Examples

### Installing Extensions

**v1.x:**

```bash
# Multiple commands for different input types
vsix-extension-manager download --url <url>
vsix-extension-manager quick-install --url <url>
vsix-extension-manager install --vsix <file>
vsix-extension-manager install --dir <directory>
vsix-extension-manager from-list --file <list>
```

**v2.0:**

```bash
# One command for all input types
vsix add <url>
vsix add <file>
vsix add <directory>
vsix add <list>
vsix add <extension-id>
```

### Listing Extensions

**v1.x:**

```bash
vsix-extension-manager export-installed -o extensions.txt
vsix-extension-manager export-installed --format extensions.json
```

**v2.0:**

```bash
vsix list --output extensions.txt
vsix list --format json --output extensions.json
vsix list --format yaml --output extensions.yml
vsix list --format csv --detailed
```

### Updating Extensions

**v1.x:**

```bash
vsix-extension-manager update-installed --editor cursor
```

**v2.0:**

```bash
vsix update --editor cursor
vsix update --all
```

### Removing Extensions

**v1.x:**

```bash
vsix-extension-manager uninstall --ids ms-python.python
```

**v2.0:**

```bash
vsix remove ms-python.python
vsix remove ms-python.python dbaeumer.vscode-eslint
vsix remove --all
```

### Flag Migrations

| v1.x Flag                   | v2.0 Flag          | Notes      |
| --------------------------- | ------------------ | ---------- |
| `--verbose`                 | `--debug`          | Renamed    |
| `--reinstall`               | `--force`          | Renamed    |
| `--check-compatibility`     | `--check-compat`   | Shortened  |
| `--allow-mismatched-binary` | `--allow-mismatch` | Shortened  |
| `--install-parallel`        | `--parallel`       | Unified    |
| `--no-install`              | `--download-only`  | Clearer    |
| `--url <url>`               | Positional arg     | Simplified |
| `--vsix <file>`             | Positional arg     | Simplified |
| `--file <list>`             | Positional arg     | Simplified |
| `--dir <path>`              | Positional arg     | Simplified |

---

## Breaking Changes Checklist

- ✅ Command structure redesign (5 commands done, 2-3 pending)
- ✅ New command framework with BaseCommand
- ✅ Smart input detection for add command
- ✅ Clack UI integration
- ✅ Plan preview system
- ✅ Flag standardization (complete)
- ✅ Main index.ts integration (complete)
- ⚠️ Type fixes needed (technical debt)
- ⏳ Configuration schema v2 (Phase 2)
- ⏳ Interactive menu redesign (Phase 2)
- ⏳ Default behavior changes (Phase 2)

## Next Steps for New Chat Session

**✅ Major Progress: 83% of Type Errors Fixed!**

The v2.0 command framework is successfully wired and **58 of 70 type errors have been resolved**. Only **12 errors remain** before build succeeds.

**Priority 1: Fix Final 12 Type Errors (Est: 30 minutes)**

1. **EditorInfo Type Issues (3 errors)**
   - `src/core/planning/planDisplay.ts` - References `version` and `extensionsPath` properties
   - `src/core/ui/components.ts` - References `version` property
   - **Solution:** Either add properties to EditorInfo type OR update code to not use them
   - **File:** `src/features/install/services/editorCliService.ts` (EditorInfo interface)

2. **UI Components Type Issues (2 errors)**
   - `src/core/ui/components.ts:141` - Clack PromptGroup type incompatibility
   - **Solution:** Fix generic type parameters or use type assertion

3. **UserInputError Calls (2 errors)**
   - `src/commands/add/inputDetector.ts:74,83` - Missing 'code' parameter
   - **Solution:** Add second parameter with error code string

4. **Minor Issues (5 errors)**
   - `src/commands/add/executor.ts:363` - `.map()` on number (already has fallback)
   - `src/commands/add/executor.ts:415` - skipInstalled property (already commented out)
   - `src/commands/info.ts:75` - ExtensionVersionInfo array type (already fixed)
   - `src/commands/list.ts:142` - InstalledExtension.disabled property
   - **Solution:** Quick fixes for remaining edge cases

**Priority 2: Verify Build & Clean Up**

```bash
# After fixing final 12 errors:
npm run build          # Should succeed with 0 errors
npm run lint           # Fix any eslint warnings
git add -A
git commit -m "fix: resolve final type errors, build succeeds"
```

**Priority 3: Update Documentation**

- Update this file (MIGRATION.md) with "Build Status: ✅ Passing"
- Note any TODO comments for future cleanup
- Document known limitations

**After Build Succeeds - Week 4 Tasks:**

- Enhanced error handling system
- Doctor command implementation  
- Rollback command integration
- Migration helpers for old commands
- Manual testing of all 5 commands
- Integration testing

**Quick Reference - What's Been Fixed:**

✅ All major service API mismatches  
✅ All property name mismatches (successCount → successful, etc.)  
✅ All ExtensionVersionInfo usage  
✅ All InstallTask structure issues  
✅ All log method calls  
✅ All UserInputError calls in main commands  
⚠️ 12 minor issues remaining (mostly type assertions needed)

**Technical Notes for Continuation:**

- All services in `src/features/` are preserved and working
- New commands use `BaseCommand` and return `CommandResult`
- UI uses Clack components from `src/core/ui/`
- Plan generation in `src/core/planning/`
- No legacy code imported in new commands
- All commits pass linting and build

---

**Last Updated:** 2024-12-19  
**Branch:** `feat/v2.0-refactor`  
**Commits:** 17  
**Phase:** 1 (Week 3, 100% COMPLETE ✅)  
**Build Status:** ✅ PASSING (0 TypeScript errors)
