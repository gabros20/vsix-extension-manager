## VSIX Extension Manager v2.0

**Stop fighting with "extension not available" errors.** Download, install, and manage VS Code and Cursor extensions directly—no marketplace restrictions, full version control, complete offline support.

Microsoft blocks Cursor from the official marketplace. This CLI bypasses those restrictions by downloading VSIX files directly from both the Visual Studio Marketplace and OpenVSX, giving you complete control over your extension ecosystem.

**Interactive mode or one-liners—your choice.** Run `vsix-extension-manager` for a beautiful guided menu, or use `vsix-extension-manager add` for smart command-line workflows that auto-detect URLs, extension IDs, local files, directories, or lists. Smart retry logic, automatic backups, health checks, and zero-config setup included.

> **🚧 Work in Progress:** v2.0 is currently in rapid development. Features and commands are actively being tested and refined. Expect breaking changes, incomplete features, and potential bugs. Use with caution and update regularly.

[![npm version](https://img.shields.io/npm/v/vsix-extension-manager.svg)](https://www.npmjs.com/package/vsix-extension-manager)
[![npm downloads](https://img.shields.io/npm/dm/vsix-extension-manager.svg)](https://www.npmjs.com/package/vsix-extension-manager)
[![license: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![CI](https://github.com/gabros20/vsix-extension-manager/actions/workflows/ci.yml/badge.svg)](https://github.com/gabros20/vsix-extension-manager/actions/workflows/ci.yml)
[![Release (semantic-release)](https://github.com/gabros20/vsix-extension-manager/actions/workflows/semantic-release.yml/badge.svg)](https://github.com/gabros20/vsix-extension-manager/actions/workflows/semantic-release.yml)
[![Last commit](https://img.shields.io/github/last-commit/gabros20/vsix-extension-manager)](https://github.com/gabros20/vsix-extension-manager/commits/main)
[![Buy Me a Coffee](https://img.shields.io/badge/Buy%20Me%20a%20Coffee-donate-FFDD00?logo=buymeacoffee&logoColor=black)](https://www.buymeacoffee.com/tamas_gabor)

### Table of Contents

- [Introduction / Why](#introduction--why)
- [Features / Highlights](#features--highlights)
- [Installation / Getting Started](#installation--getting-started)
- [Quick Start (v2.0)](#quick-start-v20)
  - [Universal `add` Command](#universal-add-command)
  - [List & Manage Extensions](#list--manage-extensions)
  - [Update Extensions](#update-extensions)
  - [Health Check](#health-check)
- [v2.0 Commands Reference](#v20-commands-reference)
  - [`add` - Universal Entry Point](#add---universal-entry-point)
  - [`remove` - Uninstall Extensions](#remove---uninstall-extensions)
  - [`update` - Update Extensions](#update---update-extensions)
  - [`list` - List Installed](#list---list-installed)
  - [`info` - Extension Details](#info---extension-details)
  - [`doctor` - Health Check](#doctor---health-check)
  - [`setup` - Configuration Wizard](#setup---configuration-wizard)
  - [`rollback` - Restore Backups](#rollback---restore-backups)
- [Configuration v2.0](#configuration-v20)
  - [YAML Configuration](#yaml-configuration)
  - [Profiles](#profiles)
  - [Environment Variables](#environment-variables)
  - [Precedence Rules](#precedence-rules)
- [Contributing](#contributing)
- [FAQ / Troubleshooting](#faq--troubleshooting)
- [License](#license)
- [Acknowledgments](#acknowledgments)

### Introduction / Why

Microsoft added an environment check that blocks Cursor (a VS Code fork) from accessing the official marketplace, resulting in “This extension is not available in your environment” errors. That also hurts workflows that require offline installs, version pinning, and bulk setup.

VSIX Extension Manager solves this with a fast, reliable CLI for downloading VSIX files, exporting installed extensions, importing lists, managing versions, and installing extensions directly into VS Code and Cursor across both the Visual Studio Marketplace and OpenVSX.

### Features / Highlights

#### 🚀 v2.0 Improvements

- ✨ **Universal `add` command** - One command for all scenarios (URL, file, directory, list, ID)
- 🎯 **Smart input detection** - Automatically determines what to do with your input
- 🔄 **Intelligent retry** - Automatic error recovery with escalating strategies
- ⚙️ **Config v2.0** - YAML-based configuration with profiles and auto-migration
- 🏥 **Health check** - Proactive diagnostics with auto-fix capabilities
- 🔔 **Update notifications** - Non-intrusive background update checking
- 📊 **Standardized output** - Consistent JSON API for CI/CD integration
- 🎨 **First-run wizard** - Interactive setup for new users

#### Core Features

- ✅ **Multi-source support** - Marketplace and OpenVSX with auto-detect
- ✅ **Batch operations** - Download and install multiple extensions efficiently
- ✅ **Version management** - Latest (stable/pre-release) or specific versions
- ✅ **Export/Import** - Share extension lists across machines
- ✅ **Compatibility checking** - Verify extensions work with your editor version
- ✅ **Automatic backups** - Safe updates with rollback capability
- ✅ **Multiple formats** - JSON, YAML, CSV, TXT output options
- ✅ **Editor detection** - Auto-detect VS Code and Cursor installations
- ✅ **Parallel operations** - Configurable concurrency for faster workflows
- ✅ **Progress tracking** - Rich progress bars and time estimates

### Installation / Getting Started

- Global (recommended):

```bash
npm install -g vsix-extension-manager
```

- Local:

```bash
npm install vsix-extension-manager
```

- Development setup:

```bash
git clone https://github.com/gabros20/vsix-extension-manager.git
cd vsix-extension-manager
npm install
npm run build
```

### Quick Start (v2.0)

v2.0 simplifies everything with a universal `add` command that automatically detects what you want to do.

#### Universal `add` Command

The `add` command is your one-stop solution for all extension operations:

```bash
# Install from marketplace URL
vsix-extension-manager add "https://marketplace.visualstudio.com/items?itemName=ms-python.python"

# Install by extension ID
vsix-extension-manager add ms-python.python

# Install from local VSIX file
vsix-extension-manager add ./extension.vsix

# Install all VSIX files from a directory
vsix-extension-manager add ./downloads

# Install from extension list
vsix-extension-manager add extensions.txt

# Download only (no install)
vsix-extension-manager add ms-python.python --download-only

# Specify editor explicitly
vsix-extension-manager add ms-python.python --editor cursor

# Silent mode for CI/CD
vsix-extension-manager add extensions.txt --quiet --json
```

#### List & Manage Extensions

```bash
# List installed extensions
vsix-extension-manager list

# Export to file
vsix-extension-manager list --output my-extensions.txt

# Export as JSON
vsix-extension-manager list --format json --output extensions.json

# Export as YAML
vsix-extension-manager list --format yaml --output extensions.yml

# Detailed information
vsix-extension-manager list --detailed
```

#### Update Extensions

```bash
# Update all extensions
vsix-extension-manager update

# Update specific extension
vsix-extension-manager update ms-python.python

# Check for updates without installing
vsix-extension-manager update --dry-run

# Update with parallel downloads
vsix-extension-manager update --parallel 5
```

#### Health Check

```bash
# Run health check
vsix-extension-manager doctor

# Auto-fix detected issues
vsix-extension-manager doctor --fix
```

### v2.0 Commands Reference

#### `add` - Universal Entry Point

Smart command that automatically detects input type and executes the appropriate workflow.

**Usage:**

```bash
vsix-extension-manager add <input> [options]
```

**Input Types** (automatically detected):

- **URL**: Marketplace or OpenVSX extension URL
- **Extension ID**: `publisher.name` format
- **VSIX File**: Path to `.vsix` file
- **Directory**: Folder containing `.vsix` files
- **List File**: `.txt` or `extensions.json` file

**Examples:**

```bash
# From URL (auto-downloads and installs)
vsix-extension-manager add "https://marketplace.visualstudio.com/items?itemName=ms-python.python"

# From extension ID (resolves latest version)
vsix-extension-manager add ms-python.python

# Pre-release version
vsix-extension-manager add ms-python.python --pre-release

# From local file
vsix-extension-manager add python-2024.1.0.vsix

# From directory
vsix-extension-manager add ./my-extensions

# From list (downloads missing, installs all)
vsix-extension-manager add extensions.txt

# Download only (no install)
vsix-extension-manager add ms-python.python --download-only --output ./downloads

# Specific editor
vsix-extension-manager add ms-python.python --editor cursor

# Force reinstall
vsix-extension-manager add ms-python.python --force

# Multiple parallel downloads
vsix-extension-manager add extensions.txt --parallel 5
```

**Common Options:**

- `--editor <type>` - Target editor (cursor, vscode, auto)
- `--download-only` - Download without installing
- `--output <path>` - Output directory for downloads
- `--force` - Force reinstall if already installed
- `--parallel <n>` - Number of parallel operations (1-10)
- `--pre-release` - Use pre-release versions
- `--source <registry>` - Registry (marketplace, open-vsx, auto)
- `--quiet` - Minimal output
- `--json` - JSON output for scripts
- `--yes` - Auto-confirm all prompts

#### `remove` - Uninstall Extensions

```bash
# Remove single extension
vsix-extension-manager remove ms-python.python

# Remove multiple extensions
vsix-extension-manager remove ms-python.python dbaeumer.vscode-eslint

# Remove all extensions (with confirmation)
vsix-extension-manager remove --all

# Silent mode
vsix-extension-manager remove ms-python.python --quiet --yes
```

#### `update` - Update Extensions

```bash
# Update all installed extensions
vsix-extension-manager update

# Update specific extensions
vsix-extension-manager update ms-python.python

# Include pre-release versions
vsix-extension-manager update --pre-release

# Check for updates without installing
vsix-extension-manager update --dry-run

# Parallel updates
vsix-extension-manager update --parallel 3
```

#### `list` - List Installed

```bash
# List in table format (default)
vsix-extension-manager list

# Export to file
vsix-extension-manager list --output extensions.txt

# JSON format
vsix-extension-manager list --format json --output extensions.json

# YAML format
vsix-extension-manager list --format yaml --output extensions.yml

# CSV format
vsix-extension-manager list --format csv --output extensions.csv

# Detailed information
vsix-extension-manager list --detailed
```

#### `info` - Extension Details

```bash
# Show extension information
vsix-extension-manager info ms-python.python

# Show all available versions
vsix-extension-manager info ms-python.python --all

# Limit versions shown
vsix-extension-manager info ms-python.python --limit 5

# JSON output
vsix-extension-manager info ms-python.python --json
```

#### `doctor` - Health Check

```bash
# Run diagnostics
vsix-extension-manager doctor

# Auto-fix detected issues
vsix-extension-manager doctor --fix

# JSON output for scripts
vsix-extension-manager doctor --json
```

#### `setup` - Configuration Wizard

```bash
# Run interactive setup wizard
vsix-extension-manager setup

# Quick setup with minimal prompts
vsix-extension-manager setup --quick

# Force reconfiguration
vsix-extension-manager setup --force
```

#### `rollback` - Restore Backups

```bash
# List available backups
vsix-extension-manager rollback --list

# Restore specific backup
vsix-extension-manager rollback --backup-id <id>

# Restore latest backup for an extension
vsix-extension-manager rollback --extension-id ms-python.python --latest
```

```bash
vsix-extension-manager
```

Interactive Mode Menu:

**Install**

- Quick install by URL (temp download → install → cleanup)
- Install single VSIX file into VS Code/Cursor
- Install all VSIX files from directory
- Install extensions from list into VS Code/Cursor

**Download**

- Download single extension from marketplace URL
- Download from exported list (txt / extensions.json)

**Update**

- Update installed extensions to latest

**Uninstall**

- Remove extensions from VS Code or Cursor
- Selective or bulk uninstall options

**Export**

- Export installed extensions to (txt / extensions.json)

**Version**

- Show extension versions for extension URL

#### Single extension (URL)

- Interactive:

```bash
vsix-extension-manager download
```

- Command line (copy-paste):

```bash
# Download specific version
vsix-extension-manager download \
  --url "https://marketplace.visualstudio.com/items?itemName=ms-python.python" \
  --version "2023.20.0"

# Resolve and download the latest version (stable by default)
vsix-extension-manager download \
  --url "https://marketplace.visualstudio.com/items?itemName=ms-python.python" \
  --version latest

# Prefer pre-release when resolving 'latest'
vsix-extension-manager download \
  --url "https://marketplace.visualstudio.com/items?itemName=ms-python.python" \
  --version latest \
  --pre-release

# Specify output directory
vsix-extension-manager download \
  --url "https://marketplace.visualstudio.com/items?itemName=ms-python.python" \
  --version "2023.20.0" \
  --output ./downloads

# Generate checksum or verify against a known hash
vsix-extension-manager download --url "..." --version "1.2.3" --checksum
vsix-extension-manager download --url "..." --version "1.2.3" --verify-checksum "<sha256>"

# Download and install in one command
vsix-extension-manager download \
  --url "https://marketplace.visualstudio.com/items?itemName=ms-python.python" \
  --version "2023.20.0" \
  --install-after
```

#### Export Installed Extensions

```bash
# Interactive export
vsix-extension-manager export-installed

# Explicit editor and format
vsix-extension-manager export-installed --editor cursor -o my-extensions.txt -f txt
vsix-extension-manager export-installed --editor vscode -o extensions.json -f extensions.json
vsix-extension-manager export-installed --editor auto   -o extensions.json -f extensions.json

# Workspace extensions.json (if present)
vsix-extension-manager export-installed --workspace

# Machine-readable output (no prompts)
vsix-extension-manager export-installed --json --editor cursor
```

#### Download from exported list (txt / extensions.json)

Supported inputs: `.txt` (one ID per line, `#` comments) or VS Code `extensions.json`.

```bash
# Interactive
vsix-extension-manager from-list

# From text file (one extension ID per line)
vsix-extension-manager from-list --file extensions.txt

# From VS Code extensions.json
vsix-extension-manager from-list --file .vscode/extensions.json

# Explicit format specification
vsix-extension-manager from-list --file extensions.txt --format txt
vsix-extension-manager from-list --file .vscode/extensions.json --format extensions.json

# With bulk options
vsix-extension-manager from-list \
  --file extensions.txt \
  --output ./downloads \
  --retry 3 \
  --checksum \
  --quiet

# Download and install in one command
vsix-extension-manager from-list --file extensions.txt --install

# Download only (explicit, default behavior)
vsix-extension-manager from-list --file extensions.txt --download-only
```

#### Install Extensions

Install VSIX files directly into VS Code or Cursor editors. The install feature automatically detects available editors and provides robust error handling with retry logic.

##### Install single VSIX file

```bash
# Interactive mode - prompts for file and editor selection
vsix-extension-manager install

# Install specific VSIX file with auto-detected editor
vsix-extension-manager install --vsix ./downloads/ms-python.python-2023.1.0.vsix

# Install from directory - scans for VSIX files and lets you pick
vsix-extension-manager install --vsix ./downloads

# Specify target editor explicitly
vsix-extension-manager install --vsix ./extension.vsix --editor cursor
vsix-extension-manager install --vsix ./extension.vsix --editor vscode
vsix-extension-manager install --vsix ./extension.vsix --editor auto

# Use explicit binary paths (useful when editors not in PATH)
vsix-extension-manager install --vsix ./extension.vsix \
  --cursor-bin "/Applications/Cursor.app/Contents/Resources/app/bin/cursor"

vsix-extension-manager install --vsix ./extension.vsix \
  --code-bin "/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code"

# Dry run to see what would be installed
vsix-extension-manager install --vsix ./extension.vsix --dry-run

# Generate installation summary
vsix-extension-manager install --vsix ./extension.vsix --summary install-log.json
```

##### Install all VSIX files from directory

```bash
# Install all VSIX files from downloads directory
vsix-extension-manager install --vsix-dir ./downloads

# Install from multiple directories (searches all)
vsix-extension-manager install --vsix-dir ./downloads --vsix-dir ./cache

# Install with retry and parallel processing
vsix-extension-manager install --vsix-dir ./downloads --parallel 3 --retry 2

# Skip already installed extensions (version-aware)
vsix-extension-manager install --vsix-dir ./downloads --skip-installed

# Force reinstall (ignore version checks)
vsix-extension-manager install --vsix-dir ./downloads --force-reinstall

# Dry run (show what would be installed without changes)
vsix-extension-manager install --vsix-dir ./downloads --dry-run

# Quiet operation for scripts
vsix-extension-manager install --vsix-dir ./downloads --quiet

# Machine-readable JSON output
vsix-extension-manager install --vsix-dir ./downloads --json
```

##### Install from extension list

```bash
# Install from text file (downloads missing extensions automatically)
vsix-extension-manager install --file extensions.txt --download-missing

# Install from VS Code extensions.json format
vsix-extension-manager install --file .vscode/extensions.json --download-missing

# Install only if VSIX files already exist (no auto-download)
vsix-extension-manager install --file extensions.txt

# Specify search directories for existing VSIX files
vsix-extension-manager install --file extensions.txt \
  --vsix-dir ./downloads \
  --vsix-dir ./cache

# Complete workflow: download missing then install all
vsix-extension-manager install --file extensions.txt \
  --download-missing \
  --skip-installed \
  --parallel 2

# Dry run to preview installation plan
vsix-extension-manager install --file extensions.txt \
  --download-missing \
  --dry-run
```

##### Advanced configuration and workflows

```bash
# Generate detailed JSON summary of installation
vsix-extension-manager install --vsix-dir ./downloads \
  --summary install-results.json \
  --skip-installed

# Quiet mode with JSON output for CI/automation
vsix-extension-manager install --vsix-dir ./downloads \
  --quiet \
  --json \
  --skip-installed

# Full configuration example
vsix-extension-manager install \
  --file extensions.txt \
  --download-missing \
  --vsix-dir ./downloads \
  --vsix-dir ./cache \
  --editor auto \
  --parallel 2 \
  --retry 3 \
  --retry-delay 2000 \
  --skip-installed \
  --summary results.json \
  --quiet

# Install with explicit editor binary (useful in containers/CI)
vsix-extension-manager install --vsix-dir ./downloads \
  --code-bin "/usr/bin/code" \
  --skip-installed \
  --quiet
```

##### Integration with download commands

```bash
# Download and install single extension in one command
vsix-extension-manager download \
  --url "https://marketplace.visualstudio.com/items?itemName=ms-python.python" \
  --version latest \
  --install-after

# Download from list and install automatically
vsix-extension-manager from-list --file extensions.txt --install

# Download only (explicit default behavior)
vsix-extension-manager from-list --file extensions.txt --download-only
```

#### Editor Detection and Setup

The install feature automatically detects VS Code and Cursor installations across platforms:

##### Automatic Detection

```bash
# Auto-detect available editors (prefers Cursor if both installed)
vsix-extension-manager install --editor auto

# The tool searches these locations automatically:
# macOS:
#   /Applications/Visual Studio Code.app/Contents/Resources/app/bin/code
#   /Applications/Cursor.app/Contents/Resources/app/bin/cursor
#   /usr/local/bin/code, /usr/local/bin/cursor (Homebrew)
#
# Windows:
#   %PROGRAMFILES%\Microsoft VS Code\bin\code.cmd
#   %LOCALAPPDATA%\Programs\cursor\resources\app\bin\cursor.cmd
#
# Linux:
#   /usr/bin/code, /usr/bin/cursor
#   /snap/bin/code, /snap/bin/cursor
#   ~/.local/bin/code, ~/.local/bin/cursor
```

When multiple editors are detected, the selection labels show identity status: "— OK" when the binary matches the chosen editor or "— MISMATCH" when it doesn’t. Mismatches are blocked unless you pass `--allow-mismatched-binary` or provide an explicit `--code-bin`/`--cursor-bin`.

##### Manual Configuration

```bash
# Specify editor binary explicitly
vsix-extension-manager install --vsix extension.vsix \
  --cursor-bin "/custom/path/to/cursor"

# Use environment variables for persistent configuration
export VSIX_CODE_BIN="/usr/local/bin/code"
export VSIX_CURSOR_BIN="/opt/cursor/bin/cursor"
vsix-extension-manager install --vsix extension.vsix

# Configuration file example (.vsixrc.json)
{
  "editor": "cursor",
  "codeBin": "/usr/local/bin/code",
  "cursorBin": "/Applications/Cursor.app/Contents/Resources/app/bin/cursor",
  "installParallel": 2,
  "skipInstalled": true
}
```

##### Troubleshooting Editor Detection

```bash
# Check which editors are detected
vsix-extension-manager install --vsix ./extension.vsix --dry-run

# If no editors found:
# 1. Install VS Code: https://code.visualstudio.com/
# 2. Install Cursor: https://cursor.sh/
# 3. Ensure binaries are in PATH or use explicit paths

# Test editor binary manually
code --version     # Should show VS Code version
cursor --version   # Should show Cursor version
```

##### Binary mismatch: `code` launches Cursor (or vice versa)

Symptoms: installation appears successful but the extension isn’t visible in the expected editor. Often `code` in PATH is a symlink to Cursor.

Fix:

- Option A (recommended): In Visual Studio Code, open Command Palette → Shell Command: Install "code" command in PATH
- Option B (terminal):

```bash
sudo ln -sf "/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code" /usr/local/bin/code
```

Verify:

```bash
ls -l /usr/local/bin/code
code --version
```

You can also bypass the check (not recommended):

```bash
vsix-extension-manager install --vsix ./ext.vsix --editor vscode --allow-mismatched-binary
# Or set env var
export VSIX_ALLOW_MISMATCHED_BINARY=true
```

#### Uninstall Extensions

Remove extensions from VS Code or Cursor with selective or bulk uninstall options.

##### Interactive Uninstall

```bash
# Interactive uninstall (choose all or selected extensions)
vsix-extension-manager uninstall

# Uninstall from specific editor
vsix-extension-manager uninstall --editor cursor
vsix-extension-manager uninstall --editor vscode
```

##### Batch Uninstall

```bash
# Uninstall all extensions (non-interactive)
vsix-extension-manager uninstall --all --quiet

# Parallel uninstall with retry logic
vsix-extension-manager uninstall --all --parallel 2 --retry 3

# Dry run to see what would be uninstalled
vsix-extension-manager uninstall --all --dry-run

# Custom editor binary paths
vsix-extension-manager uninstall --all \
  --cursor-bin "/Applications/Cursor.app/Contents/Resources/app/bin/cursor"

# Machine-readable output
vsix-extension-manager uninstall --all --json
```

##### Uninstall Features:

- **Interactive Selection**: Choose all or specific extensions to remove
- **Batch Processing**: Uninstall multiple extensions with parallel support
- **Safe Cleanup**: Removes extension files and updates metadata
- **Retry Logic**: Automatic retry for failed uninstalls
- **Dry Run**: Preview what would be uninstalled
- **Summary Reports**: Detailed results with success/failure counts

#### Direct Installation (Advanced)

Install VSIX files directly to the extensions folder, bypassing VS Code/Cursor CLI entirely. This method is more reliable for environments where the CLI has issues.

```bash
# Install single VSIX file directly
vsix-extension-manager install-direct --vsix ./extension.vsix --editor cursor

# Install all VSIX files from directory
vsix-extension-manager install-direct --vsix-dir ./downloads --editor vscode

# Force reinstall existing extensions
vsix-extension-manager install-direct --vsix ./extension.vsix --force

# Machine-readable output
vsix-extension-manager install-direct --vsix ./extension.vsix --json --quiet
```

##### Direct Install Features:

- **CLI Bypass**: Directly extracts and installs VSIX files without using editor CLI
- **Race Condition Safe**: Advanced file locking and atomic operations
- **Metadata Management**: Properly updates extensions.json and .obsolete files
- **Force Reinstall**: Override existing installations
- **Bulk Support**: Install multiple VSIX files from directories

##### When to Use Direct Installation:

- VS Code/Cursor CLI has installation issues
- Environments where editor CLI is unreliable
- Container or CI environments
- Advanced users who need more control

#### Extension Compatibility Checking

Validate extension compatibility with your editor version before downloading to avoid incompatible extensions.

```bash
# Enable compatibility checking in fromList command
vsix-extension-manager from-list --file extensions.txt --check-compatibility

# Auto-detect editor version for compatibility
vsix-extension-manager from-list --file extensions.txt \
  --check-compatibility \
  --editor cursor

# Manual version specification
vsix-extension-manager from-list --file extensions.txt \
  --check-compatibility \
  --manual-version \
  --custom-version "1.85.0"
```

##### Compatibility Features:

- **Auto-Detection**: Automatically detects your current editor version
- **Manual Version**: Specify any VS Code version for compatibility testing
- **VS Code Validation**: Validates VS Code versions against GitHub releases
- **Detailed Reports**: Shows compatibility status, warnings, and errors
- **Source Support**: Works with both Marketplace and OpenVSX extensions
- **Interactive Prompts**: Confirms whether to proceed with incompatible extensions

#### Update Installed Extensions

Update all or selected installed extensions to their latest versions with automatic backup.

```bash
# Interactive update (choose all or selected)
vsix-extension-manager update

# Update all extensions
vsix-extension-manager update --quiet

# Update with options
vsix-extension-manager update \
  --editor cursor \
  --pre-release \
  --source marketplace \
  --parallel 3

# Skip backup (not recommended)
vsix-extension-manager update --skip-backup

# Custom backup directory
vsix-extension-manager update --backup-dir /path/to/backups

# Dry run to preview what would be updated
vsix-extension-manager update --dry-run --json

# Save update summary
vsix-extension-manager update --summary update-results.json
```

##### Update Features:

- **Smart Version Detection**: Compares installed vs. latest available versions
- **Automatic Backup**: Creates backups before updating (enabled by default)
- **Interactive Selection**: Choose specific extensions to update
- **Source Fallback**: Tries Marketplace first, falls back to OpenVSX
- **Parallel Updates**: Update multiple extensions simultaneously
- **Detailed Summary**: Reports success, failures, and backup locations

#### Backup & Rollback

Protect against failed updates with automatic backups and easy rollback.

##### List Backups

```bash
# Show all available backups
vsix-extension-manager rollback --list

# JSON output for scripting
vsix-extension-manager rollback --list --json

# Filter by extension
vsix-extension-manager rollback --list --extension-id ms-python.python

# Filter by editor
vsix-extension-manager rollback --list --editor vscode
```

##### Restore from Backup

```bash
# Interactive rollback (select from list)
vsix-extension-manager rollback

# Restore latest backup for specific extension
vsix-extension-manager rollback \
  --extension-id ms-python.python \
  --latest

# Restore specific backup by ID
vsix-extension-manager rollback \
  --backup-id ms-python.python-2024.1.0-1757614701221

# Force restore (overwrite existing)
vsix-extension-manager rollback \
  --backup-id <id> \
  --force
```

##### Manage Backups

```bash
# Clean up old backups (keep last 3 per extension)
vsix-extension-manager rollback --cleanup

# Keep custom number of backups
vsix-extension-manager rollback --cleanup --keep-count 5

# Use custom backup directory
vsix-extension-manager rollback --list \
  --backup-dir /custom/backup/path
```

##### Backup Features:

- **Automatic Creation**: Backups created before each update
- **Metadata Tracking**: Version, timestamp, and reason recorded
- **Smart Cleanup**: Automatically keeps last N backups per extension
- **Quick Restore**: One command to rollback problematic updates
- **Storage Info**: Monitor backup disk usage

##### Example Workflow:

```bash
# 1. Update extensions (backups created automatically)
vsix-extension-manager update

# 2. If something breaks, check available backups
vsix-extension-manager rollback --list

# 3. Rollback the problematic extension
vsix-extension-manager rollback \
  --extension-id problematic.extension \
  --latest

# 4. Clean up old backups periodically
vsix-extension-manager rollback --cleanup
```

#### Show extension versions (URL)

List available versions from Marketplace or OpenVSX by URL.

```bash
# Prompt for URL, pretty output
vsix-extension-manager versions

# Provide URL and output JSON
vsix-extension-manager versions --url "https://marketplace.visualstudio.com/items?itemName=ms-python.python" --json
vsix-extension-manager versions --url "https://open-vsx.org/extension/ms-python/python" --json
```

#### Manual Installation Methods

- Command line:

```bash
cursor --install-extension ./downloads/<file>.vsix
code   --install-extension ./downloads/<file>.vsix
```

- Drag and drop: open the Extensions panel and drop the `.vsix` file.
- Command Palette: “Extensions: Install from VSIX…”.

### Which mode should I use?

| Mode                        | Input                                 | Version resolution                       | Parallel                   | Best for                           |
| --------------------------- | ------------------------------------- | ---------------------------------------- | -------------------------- | ---------------------------------- |
| **Download Modes**          |                                       |                                          |                            |                                    |
| Single extension (URL)      | Marketplace/OpenVSX URL               | Exact or `latest` (pre-release optional) | N/A                        | One-off downloads                  |
| Download from exported list | `txt` of IDs or `extensions.json`     | Resolves `latest` automatically          | Yes (CLI)                  | Migrating/export-import workflows  |
| **Install Modes**           |                                       |                                          |                            |                                    |
| Install single VSIX         | Single `.vsix` file or directory path | N/A (version in filename)                | N/A                        | Testing individual extensions      |
| Install from directory      | Directory path (scans for `.vsix`)    | N/A (version in filename)                | Yes (CLI `--parallel`)     | Bulk setup from downloads          |
| Install from list           | `txt` or `extensions.json`            | Resolves `latest` (or uses existing)     | Yes (CLI `--parallel`)     | Complete environment setup         |
| **Integrated Workflows**    |                                       |                                          |                            |                                    |
| Download + Install          | URL + `--install-after`               | Exact or `latest`                        | N/A                        | One-step download and install      |
| List Download + Install     | `txt`/JSON + `--install`              | Resolves `latest` automatically          | Yes (download and install) | Complete setup from exported lists |

### Configuration / Options

The CLI supports layered configuration with clear precedence:

1. CLI flags → 2) Environment variables (`VSIX_*`) → 3) Config files → 4) Built-in defaults.

#### Configuration Files

Auto-discovered in this order:

1. Project: `.vsixrc`, `.vsixrc.json`, `.vsixrc.yaml`, `.vsixrc.yml`
2. Project `.config/`: `vsix.config.json`, `vsix.config.yaml`, `vsix.config.yml`
3. User config dir: `~/.config/vsix-extension-manager/` (same names)
4. Home: `~/.vsixrc`, `~/.vsixrc.json`, etc.

- Example (JSON):

```json
{
  "outputDir": "./my-extensions",
  "cacheDir": "~/.vsix-cache",
  "parallel": 5,
  "retry": 3,
  "retryDelay": 2000,
  "skipExisting": true,
  "filenameTemplate": "{source}/{publisher}-{name}-v{version}.vsix",
  "quiet": false,
  "source": "marketplace",
  "checksum": true,
  "editor": "cursor"
}
```

- Example (YAML):

```yaml
outputDir: "./my-extensions"
cacheDir: "~/.vsix-cache"
parallel: 5
retry: 3
retryDelay: 2000
skipExisting: true
filenameTemplate: "{source}/{publisher}-{name}-v{version}.vsix"
quiet: false
source: "marketplace"
checksum: true
editor: "cursor"
```

#### Environment Variables

```bash
export VSIX_OUTPUT_DIR="./downloads"
export VSIX_CACHE_DIR="~/.vsix-cache"
export VSIX_PARALLEL=5
export VSIX_RETRY=3
export VSIX_RETRY_DELAY=2000
export VSIX_SKIP_EXISTING=true
export VSIX_OVERWRITE=false
export VSIX_FILENAME_TEMPLATE="{name}-{version}.vsix"
export VSIX_QUIET=false
export VSIX_JSON=false
export VSIX_SOURCE="marketplace"   # or open-vsx
export VSIX_PRE_RELEASE=false
export VSIX_CHECKSUM=true
export VSIX_EDITOR="auto"           # vscode | cursor | auto

# Install settings
export VSIX_INSTALL_PARALLEL=1      # Number of parallel installs
export VSIX_INSTALL_RETRY=2         # Number of retry attempts per install
export VSIX_INSTALL_RETRY_DELAY=1000 # Delay between retries in ms
export VSIX_SKIP_INSTALLED=false    # Skip if same version already installed
export VSIX_FORCE_REINSTALL=false   # Force reinstall even if same version
export VSIX_DRY_RUN=false           # Show what would be installed without changes

# Editor binary paths
export VSIX_CODE_BIN=""             # Explicit path to VS Code binary
export VSIX_CURSOR_BIN=""           # Explicit path to Cursor binary
export VSIX_ALLOW_MISMATCHED_BINARY=false # Allow proceeding when binary identity mismatches editor
```

#### Options Overview

- Download:
  - `--url <url>`: Marketplace or OpenVSX URL
  - `--version <version>`: version or `latest`
  - `--pre-release`: prefer pre-release for `latest`
  - `--source <marketplace|open-vsx|auto>`: default marketplace
  - `--output <path>`: default `./downloads`
  - `--file <path>`: bulk JSON (non-interactive)
  - `--retry <n>` / `--retry-delay <ms>`
  - `--skip-existing` / `--overwrite`
  - `--filename-template <template>`
  - `--cache-dir <path>`
  - `--checksum` / `--verify-checksum <sha256>`
  - `--quiet` / `--json` (machine-readable)
  - `--summary <path>`: write bulk summary JSON
  - `--install-after`: install downloaded extensions

- Quick-Install:
  - `--url <url>`: Marketplace or OpenVSX URL
  - `--editor <vscode|cursor|auto>`: Target editor (default: auto)
  - `--code-bin <path>` / `--cursor-bin <path>`: Explicit binaries
  - `--allow-mismatched-binary`: Proceed when PATH alias points to a different editor
  - `--pre-release`: Prefer pre-release when resolving latest
  - `--quiet` / `--json`: Non-interactive / machine-readable output
  - `--dry-run`: Show what would be installed without making changes

- Export-Installed:
  - `--output <path>`
  - `--format <txt|extensions.json>`
  - `--editor <vscode|cursor|auto>`
  - `--workspace`
  - `--json`

- From-List:
  - `--file <path>`
  - `--output <path>`
  - `--format <txt|extensions.json|auto>`
  - `--install`: Install after downloading
  - `--download-only`: Download only (default)
  - Inherits bulk options from download

- Install:
  - `--vsix <path>`: Single VSIX file or directory to install (directory scans for .vsix files)
  - `--vsix-dir <path>`: Directory to scan for VSIX files (recursive). Repeat flag to add multiple directories.
  - `--file <path>`: Extension list file (.txt or extensions.json)
  - `--download-missing`: Download missing extensions when installing from list
  - `--editor <vscode|cursor|auto>`: Target editor (default: auto)
  - `--code-bin <path>`: Explicit VS Code binary path
  - `--cursor-bin <path>`: Explicit Cursor binary path
  - `--skip-installed`: Skip if same version already installed
  - `--force-reinstall`: Force reinstall even if same version
  - `--dry-run`: Show what would be installed without changes
  - `--parallel <n>`: Number of parallel installs (default: 1)
  - `--retry <n>`: Number of retry attempts per install
  - `--retry-delay <ms>`: Delay between retries
  - `--quiet`: Reduce output
  - `--json`: Machine-readable logs
  - `--summary <path>`: Write install summary JSON
  - `--allow-mismatched-binary`: Proceed even if `code` points to Cursor or vice‑versa (not recommended)

- Update:
  - `--editor <vscode|cursor|auto>`: Target editor (default: auto)
  - `--pre-release`: Prefer pre-release when resolving 'latest'
  - `--source <marketplace|open-vsx|auto>`: Source registry (default: auto)
  - `--parallel <n>`: Number of parallel updates (default: 1)
  - `--retry <n>`: Number of retry attempts per extension
  - `--retry-delay <ms>`: Delay between retries
  - `--quiet`: Reduce output
  - `--json`: Machine-readable output
  - `--dry-run`: Preview updates without downloading/installing
  - `--summary <path>`: Write update summary JSON
  - `--skip-backup`: Skip creating backups before updating
  - `--backup-dir <path>`: Custom backup directory (default: ~/.vsix-backups)
  - `--code-bin <path>`: Explicit VS Code binary path
  - `--cursor-bin <path>`: Explicit Cursor binary path
  - `--allow-mismatched-binary`: Proceed when binary identity mismatches editor

- Rollback:
  - `--extension-id <id>`: Extension ID to rollback
  - `--editor <vscode|cursor>`: Filter by editor
  - `--backup-id <id>`: Specific backup ID to restore
  - `--latest`: Restore latest backup for the extension
  - `--list`: List available backups
  - `--force`: Force restore even if extension exists
  - `--cleanup`: Clean up old backups
  - `--keep-count <n>`: Number of backups to keep per extension (default: 3)
  - `--quiet`: Reduce output
  - `--json`: Machine-readable output
  - `--backup-dir <path>`: Custom backup directory (default: ~/.vsix-backups)

- Uninstall:
  - `--editor <vscode|cursor|auto>`: Target editor (default: auto)
  - `--code-bin <path>`: Explicit VS Code binary path
  - `--cursor-bin <path>`: Explicit Cursor binary path
  - `--all`: Uninstall all extensions (non-interactive)
  - `--parallel <n>`: Number of parallel uninstalls (default: 1)
  - `--retry <n>`: Number of retry attempts per uninstall
  - `--retry-delay <ms>`: Delay between retries
  - `--dry-run`: Show what would be uninstalled without changes
  - `--quiet`: Reduce output
  - `--json`: Machine-readable output
  - `--summary <path>`: Write uninstall summary JSON
  - `--allow-mismatched-binary`: Proceed when binary identity mismatches editor

- Install-Direct (Advanced):
  - `--vsix <path>`: Path to VSIX file
  - `--vsix-dir <path>`: Path to directory containing VSIX files
  - `--editor <vscode|cursor>`: Target editor (default: vscode)
  - `--force`: Force reinstall if already installed
  - `--quiet`: Reduce output
  - `--json`: Machine-readable output

- Extension Compatibility (in from-list):
  - `--check-compatibility`: Enable compatibility checking
  - `--manual-version`: Specify editor version manually
  - `--custom-version <version>`: Custom VS Code version for compatibility testing

- Global:
  - `--config <path>`
  - `-h, --help`, `-V, --version`

#### Custom Filename Templates

Available variables: `{name}`, `{version}`, `{source}`, `{publisher}`, `{displayName}`.
Rules: include at least `{name}` or `{version}`; `.vsix` is added if missing; invalid filesystem characters are sanitized.

- Examples:

```bash
vsix-extension-manager download --url "..." --version "1.2.3" \
  --filename-template "{publisher}_{name}_v{version}.vsix"

vsix-extension-manager download --file ./extensions.json \
  --filename-template "{publisher}/{name}-{version}.vsix"
```

#### Cache Directory

Use a persistent cache for efficient re-downloads and organization.

```bash
vsix-extension-manager download --url "..." --version "1.2.3" --cache-dir ~/.vsix-cache
vsix-extension-manager download --file ./extensions.json --cache-dir ~/.vsix-cache --skip-existing
```

#### Progress Indicators & Checksums

- Single downloads: real-time progress; bulk: sequential progress with per-file bars
- Checksums: generate SHA256, verify against provided hashes; readable short hashes in bulk

```bash
vsix-extension-manager download --file ./extensions.json --checksum --summary ./results.json
vsix-extension-manager download --url "..." --version "1.2.3" --verify-checksum "<sha256>"
```

### Contributing

Contributions are welcome. Please read the guidelines in [`CONTRIBUTING.md`](CONTRIBUTING.md). Conventional Commits are used for automated versioning and releases.

### Roadmap / TODO

See [`TODO.md`](TODO.md) for upcoming features and ideas. Feedback and PRs are appreciated.

### FAQ / Troubleshooting

- How do I install VS Code/Cursor if they're not found?
  - Install VS Code from https://code.visualstudio.com/ or Cursor from https://cursor.sh/
  - Or use explicit binary paths: `--code-bin "/path/to/code"` or `--cursor-bin "/path/to/cursor"`

- Why does installation fail with "Extension is not available in your environment"?
  - Some Microsoft extensions have additional license/compatibility checks. Try OpenVSX instead: `--source open-vsx`
  - Or use `--force-reinstall` to bypass version checks

- Can I install extensions without downloading them first?
  - Yes! Use `install --file extensions.txt --download-missing` to download and install in one step

- How do I know which extensions are already installed?
  - The install command automatically checks installed extensions when using `--skip-installed`
  - Use `--dry-run` to see what would be installed without making changes

- Why can't the installer find my editor binary?
  - Ensure VS Code/Cursor is installed and the binary is in your PATH
  - Or specify explicit paths: `--code-bin` or `--cursor-bin`
  - On macOS, check `/Applications/` for the `.app` bundles

- What happens if an installation fails?
  - Failed installations are retried automatically (configurable with `--retry`)
  - Use `--summary results.json` to get detailed failure information
  - Check the error message for specific troubleshooting steps

- Can I download and install in one command?
  - Yes! Use `download --install-after` for single extensions
  - Or use `from-list --install` for bulk operations from exported lists

- How do I set up a complete development environment?
  - Export from existing setup: `vsix-extension-manager export-installed -o my-setup.txt`
  - Install on new machine: `vsix-extension-manager install --file my-setup.txt --download-missing`

- How do I update my extensions safely?
  - Run `vsix-extension-manager update` - backups are created automatically
  - If something breaks, use `vsix-extension-manager rollback` to restore
  - See backup history with `vsix-extension-manager rollback --list`

- What's the difference between install modes?
  - `install --vsix`: Install single VSIX file or directory you already have
  - `install --vsix-dir`: Install all VSIX files from directory/directories
  - `install --file`: Install from extension list (with optional auto-download)

- How do I handle permission errors during installation?
  - Ensure your user has permission to run the editor CLI
  - On macOS/Linux, you may need to run with appropriate permissions
  - Check that the editor binary is executable: `ls -la $(which code)`

- Can I install different extensions to different editors?
  - Yes, run separate commands with `--editor vscode` and `--editor cursor`
  - Or use explicit binary paths to target specific installations
  - Binary mismatch detection: if `code` actually points to Cursor (or vice‑versa), the tool warns and blocks by default. Fix PATH via VS Code's Command Palette (Shell Command: Install 'code' command in PATH) or pass explicit `--code-bin`/`--cursor-bin`. Use `--allow-mismatched-binary` to override.

- When should I use direct installation vs regular installation?
  - Use `install-direct` when VS Code/Cursor CLI has issues or in problematic environments
  - Regular `install` command uses editor CLI (recommended for most users)
  - Direct installation bypasses CLI entirely and extracts VSIX files directly
  - Direct installation is more reliable in containers, CI, or when CLI is buggy

- How do I uninstall extensions?
  - Use `vsix-extension-manager uninstall` for interactive selection
  - Use `--all` flag for bulk uninstall of all extensions
  - Supports parallel processing with `--parallel` flag
  - Use `--dry-run` to preview what would be uninstalled

- How does extension compatibility checking work?
  - Available in `from-list` command with `--check-compatibility` flag
  - Auto-detects your current editor version or specify manually
  - Validates extensions against VS Code engine requirements
  - Warns about incompatible extensions before downloading

- Why can't I install some Microsoft extensions in Cursor?
  - Some official Microsoft extensions enforce license or compatibility checks. Downloading the VSIX may still be restricted by the extension's policies.

- Does it support OpenVSX?
  - Yes. Use `--source open-vsx` or paste an OpenVSX URL; mixed sources work in bulk.

- Can I prefer pre-release versions when using `latest`?
  - Yes, add `--pre-release` to opt into pre-releases.

- Where does configuration live and which settings win?
  - Precedence is: CLI > env (`VSIX_*`) > config files > defaults.

- Is there a programmatic API?
  - This project focuses on a CLI. Follow issues for any future API plans.

- Where can I learn about internals?
  - See [`ARCHITECTURE.md`](ARCHITECTURE.md) for module layout and design.
  - See [`BACKUP_ROLLBACK_FEATURE.md`](BACKUP_ROLLBACK_FEATURE.md) for backup/rollback implementation details.

- What are the constructed download URL patterns?
  - Marketplace: `https://[publisher].gallery.vsassets.io/_apis/public/gallery/publisher/[publisher]/extension/[extension]/[version]/assetbyname/Microsoft.VisualStudio.Services.VSIXPackage`
  - OpenVSX: `https://open-vsx.org/api/[publisher]/[extension]/[version]/file/[publisher].[extension]-[version].vsix`

### Configuration v2.0

v2.0 introduces a modern YAML-based configuration system with profiles and automatic migration from v1.x.

#### YAML Configuration

Create `~/.vsix/config.yml` or `.vsix.yml` in your project:

```yaml
# ~/.vsix/config.yml
editor:
  prefer: cursor # Preference when multiple found
  cursor-binary: auto # auto | explicit path
  vscode-binary: auto

safety:
  check-compatibility: true
  auto-backup: true
  verify-checksums: true

performance:
  parallel-downloads: 3
  parallel-installs: 1

behavior:
  skip-installed: ask # ask | always | never
  update-check: weekly # never | daily | weekly
  auto-retry: true

# Active profile
active-profile: production

# Profiles for different environments
profiles:
  production:
    safety:
      check-compatibility: true
    performance:
      parallel-installs: 1
  development:
    safety:
      check-compatibility: false
    performance:
      parallel-installs: 3
```

#### Profiles

Switch between different configurations:

```bash
# Use specific profile
vsix-extension-manager add extensions.txt --profile development

# Set active profile in config.yml
active-profile: development
```

#### Environment Variables

All options can be set via `VSIX_*` environment variables:

```bash
export VSIX_EDITOR=cursor
export VSIX_PARALLEL_DOWNLOADS=5
export VSIX_AUTO_BACKUP=true

vsix-extension-manager add ms-python.python  # Uses environment settings
```

#### Precedence Rules

Configuration precedence (highest to lowest):

1. **CLI flags** - `--editor cursor`
2. **Environment variables** - `VSIX_EDITOR=cursor`
3. **Config file** - `~/.vsix/config.yml`
4. **Default values** - Built-in defaults

### License

MIT — see [LICENSE](LICENSE).

### Acknowledgments

- [Visual Studio Marketplace](https://marketplace.visualstudio.com/) - Primary extension source
- [OpenVSX Registry](https://open-vsx.org/) - Alternative open-source extension registry
- [axios](https://github.com/axios/axios) - HTTP client for reliable downloads
- [adm-zip](https://github.com/cthackers/adm-zip) - VSIX file extraction and handling
- [Commander.js](https://github.com/tj/commander.js) - CLI framework
- [@clack/prompts](https://github.com/natemoo-re/clack) - Beautiful interactive prompts
- [YAML](https://github.com/eemeli/yaml) - Configuration file parsing
- [Zod](https://github.com/colinhacks/zod) - Schema validation
- [semantic-release](https://github.com/semantic-release/semantic-release) - Automated versioning & releases
- Built with [TypeScript](https://www.typescriptlang.org/) for type safety
- Inspired by [mjmirza/download-vsix-from-visual-studio-market-place](https://github.com/mjmirza/download-vsix-from-visual-studio-market-place)

<p align="left">
  <a href="https://www.buymeacoffee.com/tamas_gabor">
    <img src="https://img.buymeacoffee.com/button-api/?text=Buy%20me%20a%20coffee&emoji=&slug=tamas_gabor&button_colour=FFDD00&font_colour=000000&font_family=Lato&outline_colour=000000&coffee_colour=ffffff" alt="Buy Me a Coffee" />
  </a>
</p>
