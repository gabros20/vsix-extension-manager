## VSIX Extension Manager

A modern CLI for downloading, exporting, importing, and managing VS Code/Cursor extensions as VSIX files from both the Visual Studio Marketplace and OpenVSX.

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
- [Usage / Examples](#usage--examples)
  - [Quick Install (one-off)](#quick-install-one-off)
  - [Interactive Mode](#interactive-mode)
  - [Single Extension Download](#single-extension-download)
  - [Bulk Download from JSON](#bulk-download-from-json)
  - [Export Installed Extensions](#export-installed-extensions)
  - [Download from Lists](#download-from-lists)
  - [Install Extensions](#install-extensions)
  - [Update Installed Extensions](#update-installed-extensions)
  - [Backup & Rollback](#backup--rollback)
  - [Versions Command](#versions-command)
  - [Manual Installation Methods](#manual-installation-methods)
- [Configuration / Options](#configuration--options)
  - [Configuration Files](#configuration-files)
  - [Environment Variables](#environment-variables)
  - [Options Overview](#options-overview)
  - [Custom Filename Templates](#custom-filename-templates)
  - [Cache Directory](#cache-directory)
  - [Progress Indicators & Checksums](#progress-indicators--checksums)
- [Contributing](#contributing)
- [Roadmap / TODO](#roadmap--todo)
- [FAQ / Troubleshooting](#faq--troubleshooting)
- [License](#license)
- [Acknowledgments](#acknowledgments)

### Introduction / Why

Microsoft added an environment check that blocks Cursor (a VS Code fork) from accessing the official marketplace, resulting in “This extension is not available in your environment” errors. That also hurts workflows that require offline installs, version pinning, and bulk setup.

VSIX Extension Manager solves this with a fast, reliable CLI for downloading VSIX files, exporting installed extensions, importing lists, managing versions, and installing extensions directly into VS Code and Cursor across both the Visual Studio Marketplace and OpenVSX.

### Features / Highlights

- ✅ Works with both Marketplace and OpenVSX (auto-detect or choose explicitly)
- ✅ Single and bulk downloads, including mixed-source lists
- ✅ Resolve latest version (stable by default) or prefer pre-release
- ✅ Export installed extensions from VS Code or Cursor (txt/extensions.json)
- ✅ Install VSIX files directly into VS Code or Cursor
- ✅ Install from exported lists with automatic downloading
- ✅ Update installed extensions with automatic backup
- ✅ Rollback extensions from backups when updates fail
- ✅ Input lists: .txt or VS Code `extensions.json`
- ✅ Checksums: generate SHA256 or verify against a known hash
- ✅ Configurable output/cache directories and filename templates
- ✅ Retries/backoff, progress bars, quiet mode, and summary reports
- ✅ Alternative binary names: `extension-manager` and legacy `vsix-downloader`

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

### Usage / Examples

#### Quick Install (one-off)

Download an extension by URL to a temporary folder, install it, then clean up.

```bash
# Quick install (auto-detect editor; prefers Cursor)
vsix-extension-manager quick-install \
  --url "https://marketplace.visualstudio.com/items?itemName=ms-python.python"

# Shorthand alias
vsix-extension-manager qi --url "https://open-vsx.org/extension/ms-python/python"

# Explicit editor and binary
vsix-extension-manager qi \
  --url "https://marketplace.visualstudio.com/items?itemName=Fuzionix.file-tree-extractor" \
  --editor cursor \
  --cursor-bin "/Applications/Cursor.app/Contents/Resources/app/bin/cursor"

# Non-interactive output for scripts/CI
vsix-extension-manager qi --url "..." --quiet --json
```

Behavior:

- Creates a unique temp directory
- Downloads latest (or pre-release with --pre-release)
- Prompts for target editor when multiple are available (quiet/json prefers Cursor)
- Installs the VSIX
- Cleans up the temp directory regardless of outcome

#### Quick Start - Install Extensions

```bash
# Install a single VSIX file
vsix-extension-manager install --vsix ./extension.vsix

# Install all VSIX files from downloads folder
vsix-extension-manager install --vsix-dir ./downloads

# Install from exported extension list (with auto-download)
vsix-extension-manager install --file extensions.txt --download-missing

# Download and install in one command
vsix-extension-manager download \
  --url "https://marketplace.visualstudio.com/items?itemName=ms-python.python" \
  --version latest \
  --install-after

# Export from one machine, install on another
vsix-extension-manager export-installed -o my-extensions.txt
vsix-extension-manager install --file my-extensions.txt --download-missing
```

#### Interactive Mode

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
- Download multiple extensions from JSON collection (URLs + versions)
- Download from exported list (txt / extensions.json)

**Update**

- Update installed extensions to latest

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

#### Bulk from JSON collection (URLs + versions)

- Template:

```json
[
  {
    "url": "https://marketplace.visualstudio.com/items?itemName=ms-python.python",
    "version": "latest"
  },
  { "url": "https://open-vsx.org/extension/ms-python/python", "version": "2025.4.0" }
]
```

- Run (non-interactive):

```bash
vsix-extension-manager download \
  --file ./extensions.json \
  --output ./downloads \
  --retry 3 \
  --retry-delay 1500 \
  --summary ./summary.json \
  --quiet

# Download and install bulk extensions
vsix-extension-manager download \
  --file ./extensions.json \
  --output ./downloads \
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

| Mode                        | Input                                     | Version resolution                       | Parallel                                | Best for                           |
| --------------------------- | ----------------------------------------- | ---------------------------------------- | --------------------------------------- | ---------------------------------- |
| **Download Modes**          |                                           |                                          |                                         |                                    |
| Single extension (URL)      | Marketplace/OpenVSX URL                   | Exact or `latest` (pre-release optional) | N/A                                     | One-off downloads                  |
| Bulk from JSON collection   | JSON array of `{ url, version, source? }` | Exact or `latest` per entry              | Yes (CLI `--parallel`, non-interactive) | Mixed sources, pinned versions     |
| Download from exported list | `txt` of IDs or `extensions.json`         | Resolves `latest` automatically          | Yes (CLI)                               | Migrating/export-import workflows  |
| **Install Modes**           |                                           |                                          |                                         |                                    |
| Install single VSIX         | Single `.vsix` file or directory path     | N/A (version in filename)                | N/A                                     | Testing individual extensions      |
| Install from directory      | Directory path (scans for `.vsix`)        | N/A (version in filename)                | Yes (CLI `--parallel`)                  | Bulk setup from downloads          |
| Install from list           | `txt` or `extensions.json`                | Resolves `latest` (or uses existing)     | Yes (CLI `--parallel`)                  | Complete environment setup         |
| **Integrated Workflows**    |                                           |                                          |                                         |                                    |
| Download + Install          | URL + `--install-after`                   | Exact or `latest`                        | N/A                                     | One-step download and install      |
| List Download + Install     | `txt`/JSON + `--install`                  | Resolves `latest` automatically          | Yes (download and install)              | Complete setup from exported lists |

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
  - `--allow-mismatched-binary`: Proceed even if `code` points to Cursor or vice versa (not recommended)

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
  - Binary mismatch detection: if `code` actually points to Cursor (or vice‑versa), the tool warns and blocks by default. Fix PATH via VS Code’s Command Palette (Shell Command: Install 'code' command in PATH) or pass explicit `--code-bin`/`--cursor-bin`. Use `--allow-mismatched-binary` to override.

- Why can't I install some Microsoft extensions in Cursor?
  - Some official Microsoft extensions enforce license or compatibility checks. Downloading the VSIX may still be restricted by the extension’s policies.

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

### License

MIT — see [LICENSE](LICENSE).

### Acknowledgments

- Inspired by [mjmirza/download-vsix-from-visual-studio-market-place](https://github.com/mjmirza/download-vsix-from-visual-studio-market-place)
- Built with modern CLI tooling: [Commander.js](https://github.com/tj/commander.js) and [@clack/prompts](https://github.com/natemooe/clack)

<p align="left">
  <a href="https://www.buymeacoffee.com/tamas_gabor">
    <img src="https://img.buymeacoffee.com/button-api/?text=Buy%20me%20a%20coffee&emoji=&slug=tamas_gabor&button_colour=FFDD00&font_colour=000000&font_family=Lato&outline_colour=000000&coffee_colour=ffffff" alt="Buy Me a Coffee" />
  </a>
</p>
