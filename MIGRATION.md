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

## v2.0 Changes

_(This section will be updated as the refactor progresses)_

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

### New Commands

- `search <query>` - Search marketplace
- `doctor` - Health check and auto-fix
- `workspace init/install/add` - Project-specific extensions
- `templates [use]` - Curated extension packs

### Simplified Flags

_(To be documented as implementation progresses)_

---

## Migration Examples

_(Examples will be added during implementation)_

---

## Breaking Changes Checklist

- [ ] Command structure redesign
- [ ] Flag standardization
- [ ] Configuration schema v2
- [ ] Interactive menu redesign
- [ ] Default behavior changes

---

**Last Updated:** [Will be updated during refactor]
