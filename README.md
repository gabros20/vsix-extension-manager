# VSIX Extension Manager

A modern, feature-rich CLI tool to download, export, import, and manage VS Code/Cursor extensions as VSIX files. Supports both Visual Studio Marketplace and OpenVSX registries with comprehensive extension management capabilities.

## 🎯 What This Tool Solves

### The Microsoft-Cursor Extension Block

Recently, Microsoft quietly blocked Cursor (an AI-powered VSCode fork) from accessing the VSCode extension marketplace by adding a simple environment check. This means Cursor users can no longer install extensions directly through the marketplace, seeing "This extension is not available in your environment" errors.

### Why You Need This Tool

**VSIX Extension Manager** provides a comprehensive solution for managing extensions by downloading them as `.vsix` files, exporting your current setup, and importing configurations across environments. This is particularly valuable for:

- **Cursor Users**: Bypass Microsoft's marketplace restrictions and continue using your favorite extensions
- **Offline Development**: Download extensions once and install them on machines without internet access
- **Version Control**: Pin specific extension versions for consistent development environments
- **Bulk Setup**: Quickly set up new development environments with all your preferred extensions
- **Backup Strategy**: Create local backups of extensions you depend on

## 🚀 Features

### Core Functionality

- **Single download**: Fetch a VSIX by Marketplace or OpenVSX URL
- **Bulk download (JSON)**: Process a list of `{ url, version, source? }` entries; sequential with retries/backoff
- **Download from lists**: Parse `.txt`, JSON arrays, or VS Code `extensions.json` via `from-list`
- **Version resolution**: Resolve `latest` (stable by default) or prefer pre-release with `--pre-release`
- **Source selection**: Works with Marketplace and OpenVSX; auto-detect from URL or override with `--source`
- **Versions command**: List available versions for an extension (`versions`)
- **Export installed**: Export from VS Code or Cursor to `json`, `txt`, or `extensions.json`
- **Checksums**: Generate SHA256 or verify against a provided hash
- **Output control**: Choose output or cache directory, `--skip-existing` / `--overwrite`, custom filename templates
- **Progress & summary**: Show progress bars and optionally write a JSON summary (`--summary`)

### Configuration (optional)

Save your favorite flags as defaults so you don’t repeat them on every command.

- **Where to put defaults**: create a `.vsixrc.json` (or `.yaml`) in your project or home folder, or pass `--config <path>` to point to a file.
- **Precedence**: CLI flags > environment variables (`VSIX_*`) > config file > built‑in defaults.
- **Common defaults**: `outputDir`/`cacheDir`, `skipExisting`/`overwrite`, `filenameTemplate`, `retry`/`retryDelay`, `quiet/json`, `source`/`preRelease`, `checksum`.

Quick example:

```json
{
  "outputDir": "./downloads",
  "skipExisting": true
}
```

Now `vsix-extension-manager download --file ./extensions.json` will use these values unless you override them with flags. See detailed examples in the ⚙️ Configuration section below.

### Registry & Source Support

- **🔗 Smart Parsing**: Extracts extension info from Marketplace and OpenVSX URLs
- **🎛️ Interactive Source Selection**: Auto-detects source from URL with ability to switch
- **🌐 Mixed-Source Bulk**: Use Marketplace and OpenVSX URLs in the same JSON list
- **🎯 Source-Aware "latest"**: Resolve `latest` for both Marketplace and OpenVSX (single and bulk)
- **📋 Versions Command**: List versions from Marketplace or OpenVSX via URL

### Import/Export Workflows

- **📤 Export Installed Extensions**: Export currently installed extensions from VS Code or Cursor in multiple formats
- **📥 Import from Lists**: Download extensions from text files, JSON arrays, or VS Code extensions.json
- **🔄 Seamless Editor Integration**: Export extensions from VS Code or Cursor and import to another environment
- **👥 Team Collaboration**: Share extension setups via standardized export formats

## 📦 Installation

### Global Installation (Recommended)

```bash
npm install -g vsix-extension-manager
```

### Local Installation

```bash
npm install vsix-extension-manager
```

## 🛠️ Usage

### Interactive Mode (Recommended)

Simply run the command and choose your download mode:

```bash
vsix-extension-manager
```

You'll see a lightweight menu with the most common actions:

- **📦 Single download**: Download one extension interactively
- **📚 Bulk download (JSON file)**: Download multiple extensions from a JSON file
- **📥 Download from list**: Use a txt/json/extensions.json list file
- **📤 Export installed extensions**: Export from VS Code or Cursor
- **🔢 List available versions**: Show versions for an extension URL
- **Quit**

Note: Interactive mode stays minimal by design. Advanced options (checksums, retries, parallelism, templates, etc.) are available via command-line flags.

Or use the download command directly:

```bash
vsix-extension-manager download
```

### Single Extension Download

#### Interactive Mode

Follow the prompts to enter:

1. Extension URL (Marketplace or OpenVSX)
2. Extension version (or type `latest`)
3. Output directory (optional; press Enter to use `./downloads`)

#### Command Line Arguments

You can also provide arguments directly for single downloads:

```bash
# Download with URL and version
vsix-extension-manager download --url "https://marketplace.visualstudio.com/items?itemName=ms-python.python" --version "2023.20.0"

# Resolve and download the latest version (stable by default)
vsix-extension-manager download --url "https://marketplace.visualstudio.com/items?itemName=ms-python.python" --version latest

# Prefer pre-release when resolving 'latest'
vsix-extension-manager download --url "https://marketplace.visualstudio.com/items?itemName=ms-python.python" --version latest --pre-release

# Specify custom output directory
vsix-extension-manager download --url "..." --version "1.2.3" --output "./my-extensions"
```

### Bulk Download from JSON

For downloading multiple extensions, create a JSON file with the extension details and use bulk mode.

> Note: Interactive bulk runs sequentially for a clean UI. Non-interactive bulk (`--file`) supports parallel downloads via `--parallel <n>`.

#### Interactive Bulk Download

1. Select "📚 Bulk Download" from the main menu
2. Enter the path to your JSON file
3. Specify output directory (optional; press Enter to use `./downloads`)
4. Watch the progress as each extension downloads

#### JSON Template

Create a JSON file (e.g., `extensions.json`) with the following structure (mixed sources allowed):

```json
[
  {
    "url": "https://marketplace.visualstudio.com/items?itemName=ms-python.python",
    "version": "latest"
  },
  { "url": "https://open-vsx.org/extension/ms-python/python", "version": "2025.4.0" },
  {
    "url": "https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode",
    "version": "latest",
    "source": "marketplace"
  }
]
```

#### Required Fields

- **`url`**: Extension URL from either Marketplace or OpenVSX
- **`version`**: Specific version to download (or `latest`)
- Optional: **`source`** — `marketplace` | `open-vsx` (overrides auto-detection)

The extension name is automatically extracted from the URL for display purposes in the CLI.

#### JSON Validation

The CLI performs comprehensive validation on your JSON file before starting downloads:

✅ **File Validation**:

- File exists and is readable
- Valid JSON format
- Array structure (must be an array of objects)
- Non-empty array

✅ **Extension Validation**:

- Required `url` field (Marketplace or OpenVSX URL)
- Required `version` field (non-empty string; `latest` allowed)
- URL format validation for both ecosystems

❌ **Error Handling**:

- Clear error messages for invalid JSON structure
- Specific validation errors for each extension object
- Failed downloads don't stop the bulk process
- Detailed summary of successes and failures

#### Non-Interactive Bulk Mode

Skip prompts and run bulk download straight from a file. Useful for CI and scripts.

```bash
# Basic non-interactive bulk download
vsix-extension-manager download \
  --file ./extensions.json \
  --output ./downloads

# Advanced: sequential downloads with retries, backoff, quiet logs and JSON summary
vsix-extension-manager download \
  --file ./extensions.json \
  --output ./downloads \
  --retry 3 \
  --retry-delay 1500 \
  --summary ./summary.json \
  --quiet

# Bulk download with custom naming and cache directory
vsix-extension-manager download \
  --file ./extensions.json \
  --cache-dir ~/.vsix-cache \
  --filename-template "{source}/{publisher}-{name}-v{version}.vsix" \
  --skip-existing

# Bulk download with progress and checksums
vsix-extension-manager download \
  --file ./extensions.json \
  --checksum \
  --cache-dir ~/.extensions \
  --quiet

# Bulk download with verification against known checksums
vsix-extension-manager download \
  --file ./extensions.json \
  --verify-checksum "a1b2c3d4e5f6..." \
  --retry 3
```

### Export Installed Extensions

Export your currently installed extensions from VS Code or Cursor to share across environments or backup your setup:

```bash
# Interactive export - choose editor, format and output
vsix-extension-manager export-installed

# Export from specific editor
vsix-extension-manager export-installed --editor cursor -o my-extensions.txt -f txt
vsix-extension-manager export-installed --editor vscode -o my-extensions.txt -f txt
vsix-extension-manager export-installed --editor auto -o my-extensions.txt -f txt

# Export to specific file and format (auto-detects editor)
vsix-extension-manager export-installed -o my-extensions.json -f json
vsix-extension-manager export-installed -o my-extensions.txt -f txt
vsix-extension-manager export-installed -o extensions.json -f extensions.json

# Export workspace extensions.json (if it exists)
vsix-extension-manager export-installed --workspace

# Machine-readable output (no prompts)
vsix-extension-manager export-installed --json --editor cursor
```

**Export Formats:**

- `json` - Detailed extension info with metadata (name, version, publisher, description)
- `txt` - Simple list of extension IDs (one per line, supports `#` comments)
- `extensions.json` - VS Code workspace format (recommendations array)

### Download from Extension Lists

Download extensions from various list formats:

```bash
# Interactive mode - select file and proceed
vsix-extension-manager from-list

# From text file (extension IDs, one per line)
vsix-extension-manager from-list --file extensions.txt

# From VS Code extensions.json
vsix-extension-manager from-list --file .vscode/extensions.json

# With all bulk download options
vsix-extension-manager from-list \
  --file extensions.txt \
  --output ./downloads \
  --parallel 5 \
  --retry 3 \
  --checksum \
  --quiet
```

**Supported Input Formats:**

- Text files (`.txt`) - One extension ID per line, `#` comments supported
- JSON arrays - Array of extension ID strings
- VS Code extensions.json - Standard workspace format with `recommendations` array
- Auto-detection based on file content

### Complete Export → Import Workflow

1. **Export extensions from your current setup:**

   ```bash
   # Export your installed extensions
   vsix-extension-manager export-installed -o my-setup.txt -f txt
   ```

2. **Transfer to new environment and download:**

   ```bash
   # Download all extensions from the list
   vsix-extension-manager from-list --file my-setup.txt --output ./extensions
   ```

3. **Install manually in Cursor/VS Code:**
   ```bash
   # Install all downloaded extensions
   cursor --install-extension ./extensions/*.vsix
   ```

### Available Commands

```bash
vsix-extension-manager download [options]           # Download a VSIX file (alias: dl)
vsix-extension-manager versions [options]           # List available versions for an extension
vsix-extension-manager export-installed [options]   # Export currently installed extensions (alias: export)
vsix-extension-manager from-list [options]          # Download extensions from a list file (alias: install)
vsix-extension-manager --help                      # Show help
vsix-extension-manager --version                   # Show version
```

**Alternative Binary Names**: VSIX Extension Manager is also available as `extension-manager` and legacy `vsix-downloader` for convenience.

### Options

#### Download Command Options

- `-u, --url <url>` - Marketplace URL of the extension
- `-v, --version <version>` - Version of the extension to download (or `latest`)
- `--pre-release` - Prefer pre-release when resolving `latest`
- `--source <source>` - Source registry: `marketplace` | `open-vsx` | `auto` (default: marketplace)
  - In interactive mode, the source defaults from the URL but you can change it
- `-o, --output <path>` - Output directory (default: ./downloads)
- `-f, --file <path>` - Bulk JSON file path (non-interactive)
- `--parallel <n>` - Number of parallel downloads in bulk mode (reserved; currently sequential)
- `--retry <n>` - Retry attempts per item in bulk mode (default: 2)
- `--retry-delay <ms>` - Base delay between retries in ms (exponential backoff)
- `--skip-existing` - Skip downloads if target file already exists
- `--overwrite` - Overwrite existing files
- `--filename-template <template>` - Custom filename template (default: `{name}-{version}.vsix`)
- `--cache-dir <path>` - Cache directory for downloads (overrides output)
- `--checksum` - Generate SHA256 checksum for downloaded files
- `--verify-checksum <hash>` - Verify downloaded file against provided SHA256 hash
- `--quiet` - Reduce output (suppress interactive notes/spinners)
- `--json` - Machine-readable logs (reserved for future)
- `--summary <path>` - Write bulk summary JSON to the given path

#### Export-Installed Command Options

- `-o, --output <path>` - Output file path
- `-f, --format <format>` - Output format: `json` | `txt` | `extensions.json`
- `-e, --editor <editor>` - Editor to export from: `vscode` | `cursor` | `auto` (default: auto)
- `-w, --workspace` - Export workspace extensions.json instead of globally installed extensions
- `--json` - Machine-readable output (no interactive prompts)

#### From-List Command Options

- `-f, --file <path>` - Path to extensions list file
- `-o, --output <path>` - Output directory (default: ./downloads)
- `--format <format>` - Input file format: `json` | `txt` | `extensions.json` | `auto`
- All bulk download options from the download command (parallel, retry, checksum, etc.)

#### Global Options

- `-h, --help` - Display help information
- `-V, --version` - Display version number
- `--config <path>` - Path to configuration file (overrides auto-discovery)

### Versions Command

List all available versions for an extension (Marketplace or OpenVSX). Useful when picking a pinned version or checking pre-releases.

```bash
# Prompt for URL, display human-readable list
vsix-extension-manager versions

# Provide URL and output JSON (works with Marketplace or OpenVSX URLs)
vsix-extension-manager versions --url "https://marketplace.visualstudio.com/items?itemName=ms-python.python" --json
vsix-extension-manager versions --url "https://open-vsx.org/extension/ms-python/python" --json
```

### OpenVSX Support

You can download from OpenVSX by specifying the source or by pasting an OpenVSX URL in interactive mode (the source will be preselected as OpenVSX, but you can switch). Bulk supports mixed sources in the same list.

```bash
# Single extension from OpenVSX
vsix-extension-manager download \
  --url "https://open-vsx.org/extension/ms-python/python" \
  --version latest \
  --source open-vsx

# Bulk with OpenVSX
vsix-extension-manager download \
  --file ./extensions.json \
  --output ./downloads \
  --source open-vsx
```

Note: `auto` source is reserved for future fallback behavior. Currently, set `--source` explicitly to `marketplace` or `open-vsx`.

## ⚙️ Configuration

VSIX Extension Manager supports a powerful multi-layer configuration system that allows you to set defaults and customize behavior across all commands.

### Configuration Priority (Highest to Lowest)

1. **CLI Arguments** - Command line options always take precedence
2. **Environment Variables** - `VSIX_*` prefixed environment variables
3. **Configuration Files** - Auto-discovered or explicitly specified config files
4. **Built-in Defaults** - Sensible defaults for all options

### Configuration Files

#### Supported Formats & Locations

VSIX Extension Manager automatically searches for configuration files in this order:

1. **Current directory**: `.vsixrc`, `.vsixrc.json`, `.vsixrc.yaml`, `.vsixrc.yml`
2. **Current directory `.config/`**: `vsix.config.json`, `vsix.config.yaml`, `vsix.config.yml`
3. **User config directory**: `~/.config/vsix-extension-manager/` (same filenames)
4. **User home directory**: `~/.vsixrc`, `~/.vsixrc.json`, etc.

#### Configuration File Example

**JSON Format** (`.vsixrc.json` or `vsix.config.json`):

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

**YAML Format** (`.vsixrc.yaml` or `vsix.config.yaml`):

```yaml
# VSIX Extension Manager Configuration
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

#### Available Configuration Options

| Option             | Type    | Default                          | Description                                       |
| ------------------ | ------- | -------------------------------- | ------------------------------------------------- |
| `outputDir`        | string  | `"./downloads"`                  | Default output directory for downloads            |
| `cacheDir`         | string  | `undefined`                      | Cache directory (overrides outputDir)             |
| `parallel`         | number  | `3`                              | Parallel workers for non-interactive bulk (1-20)  |
| `retry`            | number  | `2`                              | Number of retry attempts (0-10)                   |
| `retryDelay`       | number  | `1000`                           | Delay between retries in milliseconds             |
| `skipExisting`     | boolean | `false`                          | Skip downloads if file already exists             |
| `overwrite`        | boolean | `false`                          | Overwrite existing files                          |
| `filenameTemplate` | string  | `"{name}-{version}.vsix"`        | Custom filename template                          |
| `quiet`            | boolean | `false`                          | Reduce output verbosity                           |
| `json`             | boolean | `false`                          | Output in JSON format                             |
| `source`           | string  | `"marketplace"`                  | Default source: `marketplace`, `open-vsx`, `auto` |
| `preRelease`       | boolean | `false`                          | Prefer pre-release versions                       |
| `checksum`         | boolean | `false`                          | Generate checksums for downloads                  |
| `timeout`          | number  | `30000`                          | HTTP timeout in milliseconds                      |
| `userAgent`        | string  | `"vsix-extension-manager/1.5.0"` | HTTP User-Agent string                            |
| `editor`           | string  | `"auto"`                         | Default editor: `vscode`, `cursor`, `auto`        |

### Environment Variables

Set configuration via environment variables using the `VSIX_` prefix:

```bash
# Basic settings
export VSIX_OUTPUT_DIR="./team-extensions"
export VSIX_CACHE_DIR="~/.shared-vsix-cache"
export VSIX_PARALLEL=5  # applies to non-interactive bulk mode
export VSIX_RETRY=3

# File handling
export VSIX_SKIP_EXISTING=true
export VSIX_FILENAME_TEMPLATE="{source}/{publisher}-{name}.vsix"

# Source and quality
export VSIX_SOURCE="marketplace"
export VSIX_CHECKSUM=true
export VSIX_EDITOR="cursor"

# Output preferences
export VSIX_QUIET=false
export VSIX_JSON=false
```

**Environment Variable Reference:**

| Environment Variable     | Config Option      | Type    | Example                   |
| ------------------------ | ------------------ | ------- | ------------------------- |
| `VSIX_OUTPUT_DIR`        | `outputDir`        | string  | `"./downloads"`           |
| `VSIX_CACHE_DIR`         | `cacheDir`         | string  | `"~/.vsix-cache"`         |
| `VSIX_PARALLEL`          | `parallel`         | number  | `"5"`                     |
| `VSIX_RETRY`             | `retry`            | number  | `"3"`                     |
| `VSIX_RETRY_DELAY`       | `retryDelay`       | number  | `"2000"`                  |
| `VSIX_SKIP_EXISTING`     | `skipExisting`     | boolean | `"true"`                  |
| `VSIX_OVERWRITE`         | `overwrite`        | boolean | `"false"`                 |
| `VSIX_FILENAME_TEMPLATE` | `filenameTemplate` | string  | `"{name}-{version}.vsix"` |
| `VSIX_QUIET`             | `quiet`            | boolean | `"true"`                  |
| `VSIX_JSON`              | `json`             | boolean | `"false"`                 |
| `VSIX_SOURCE`            | `source`           | string  | `"marketplace"`           |
| `VSIX_PRE_RELEASE`       | `preRelease`       | boolean | `"false"`                 |
| `VSIX_CHECKSUM`          | `checksum`         | boolean | `"true"`                  |
| `VSIX_EDITOR`            | `editor`           | string  | `"cursor"`                |

### Configuration Examples

#### Team/CI Configuration

Create a shared configuration for team environments:

**`.vsixrc.json` in project root:**

```json
{
  "outputDir": "./team-extensions",
  "parallel": 3,
  "retry": 5,
  "retryDelay": 2000,
  "skipExisting": true,
  "filenameTemplate": "{publisher}-{name}-{version}.vsix",
  "checksum": true,
  "quiet": true,
  "source": "marketplace"
}
```

#### Personal Development Setup

**`~/.config/vsix-extension-manager/vsix.config.yaml`:**

```yaml
# Personal development configuration
cacheDir: "~/.vsix-cache"
parallel: 5
retry: 3
skipExisting: true
filenameTemplate: "{source}/{name}-v{version}.vsix"
checksum: true
editor: "cursor"
source: "marketplace"
```

#### Environment-Specific Configurations

**Development environment:**

```bash
export VSIX_CACHE_DIR="./dev-extensions"
export VSIX_PARALLEL=5
export VSIX_CHECKSUM=true
```

**Production/CI environment:**

```bash
export VSIX_OUTPUT_DIR="./production-extensions"
export VSIX_PARALLEL=3
export VSIX_RETRY=5
export VSIX_QUIET=true
export VSIX_JSON=true
```

### Using Custom Configuration Files

Specify a custom configuration file with the global `--config` option:

```bash
# Use specific config file
vsix-extension-manager --config ./custom-config.json download --url "..."

# Different configs for different environments
vsix-extension-manager --config ./configs/development.yaml from-list --file ./extensions.txt
vsix-extension-manager --config ./configs/production.json download --file ./critical-extensions.json
```

### Configuration Validation

VSIX Extension Manager validates all configuration sources and provides helpful error messages:

```bash
# Invalid configuration will show specific errors
$ vsix-extension-manager download --url "..."
❌ Configuration Error: Invalid configuration in ~/.vsixrc.json:
   parallel: Expected number between 1 and 20, received 25
   source: Expected 'marketplace' | 'open-vsx' | 'auto', received 'invalid'

💡 Suggested actions:
   1. Fix configuration: Correct the configuration errors
   2. Use default config: Remove the config file to use defaults
   3. Generate sample: Generate a sample configuration file
```

### Custom Filename Templates

Customize how downloaded files are named using the `--filename-template` option with variable substitution:

```bash
# Use a custom filename template
vsix-extension-manager download \
  --url "https://marketplace.visualstudio.com/items?itemName=ms-python.python" \
  --version "2023.20.0" \
  --filename-template "{publisher}_{name}_v{version}.vsix"
# Results in: ms-python_ms-python.python_v2023.20.0.vsix

# Include source in filename
vsix-extension-manager download \
  --url "..." \
  --version "1.2.3" \
  --filename-template "{source}-{name}-{version}.vsix"
# Results in: marketplace-publisher.extension-1.2.3.vsix

# Bulk download with custom template
vsix-extension-manager download \
  --file ./extensions.json \
  --filename-template "{publisher}/{name}-{version}.vsix"
```

#### Available Template Variables

- `{name}` - Full extension identifier (e.g., `ms-python.python`)
- `{version}` - Version number (e.g., `2023.20.0`)
- `{source}` - Source registry (`marketplace` or `open-vsx`)
- `{publisher}` - Publisher name (e.g., `ms-python`)
- `{displayName}` - Display name when available

#### Template Requirements

- Templates must include at least `{name}` or `{version}`
- Invalid filesystem characters are automatically sanitized
- `.vsix` extension is automatically added if missing
- Default template: `{name}-{version}.vsix`

### Cache Directory

Use a dedicated cache directory for downloads that persists across sessions:

```bash
# Use cache directory (overrides --output)
vsix-extension-manager download \
  --url "..." \
  --version "1.2.3" \
  --cache-dir ~/.vsix-cache

# Skip existing files in cache
vsix-extension-manager download \
  --file ./extensions.json \
  --cache-dir ~/.vsix-cache \
  --skip-existing

# Bulk download to cache with custom naming
vsix-extension-manager download \
  --file ./extensions.json \
  --cache-dir ~/.vsix-cache \
  --filename-template "{source}/{publisher}/{name}-{version}.vsix" \
  --overwrite
```

**Cache Directory Benefits:**

- Persistent storage across download sessions
- Organized extension storage with custom templates
- Efficient re-downloads with `--skip-existing`
- Overrides `--output` when both are specified

### Progress Indicators & Checksums

Monitor download progress and verify file integrity:

```bash
# Generate checksum after download
vsix-extension-manager download \
  --url "https://marketplace.visualstudio.com/items?itemName=ms-python.python" \
  --version "2023.20.0" \
  --checksum

# Verify downloaded file against known checksum
vsix-extension-manager download \
  --url "..." \
  --version "1.2.3" \
  --verify-checksum "a1b2c3d4e5f6...your-sha256-hash-here"

# Bulk download with progress and checksums
vsix-extension-manager download \
  --file ./extensions.json \
  --checksum \
  --cache-dir ~/.extensions
```

**Progress Features:**

- **Single downloads**: Real-time progress bars with percentage completion and file size
- **Bulk downloads**: Sequential progress with visual progress bars and file sizes per file
- Time remaining estimates for single downloads
- Non-intrusive updates (100ms intervals)

**Checksum Features:**

- SHA256 hash generation for integrity verification (both single and bulk)
- File verification against provided checksums (both single and bulk)
- Visual indicators: ✅ PASSED, ❌ FAILED, ⚠️ WARNING
- Graceful error handling for checksum failures
- Short hash display in bulk mode for readability
- Full hash display in single mode
- Bulk verification stops on failed checksums to prevent corrupted files

## 📋 Examples

### Example 1: Single Extension (Command Line)

```bash
vsix-extension-manager download --url "https://marketplace.visualstudio.com/items?itemName=ms-python.python" --version "2023.20.0"
```

### Example 2: Export → Import Workflow (Cursor to new environment)

```bash
# Step 1: Export your current Cursor extensions
$ vsix-extension-manager export-installed --editor cursor -o my-cursor-extensions.txt -f txt

# Step 2: Review the exported list
$ cat my-cursor-extensions.txt
# ms-python.python
# eamodio.gitlens
# PKief.material-icon-theme
# Continue.continue
# Prisma.prisma

# Step 3: Download all extensions on new machine
$ vsix-extension-manager from-list --file my-cursor-extensions.txt --output ./downloads

# Step 4: Install in Cursor
$ cursor --install-extension ./downloads/*.vsix
```

### Example 3: Cross-Editor Migration (VS Code → Cursor)

```bash
# Step 1: Export your VS Code extensions
$ vsix-extension-manager export-installed --editor vscode -o vscode-extensions.txt -f txt

# Step 2: Download extensions for Cursor installation
$ vsix-extension-manager from-list --file vscode-extensions.txt --output ./cursor-migration

# Step 3: Install in Cursor
$ cursor --install-extension ./cursor-migration/*.vsix

# Step 4: Verify Cursor now has the extensions
$ vsix-extension-manager export-installed --editor cursor --json | grep -c '"id"'
```

### Example 4: VS Code Workspace Integration

```bash
# Export to VS Code workspace format
$ vsix-extension-manager export-installed -o .vscode/extensions.json -f extensions.json

# Contents of .vscode/extensions.json:
{
  "recommendations": [
    "ms-python.python",
    "eamodio.gitlens",
    "PKief.material-icon-theme"
  ]
}

# Download from workspace extensions.json
$ vsix-extension-manager from-list --file .vscode/extensions.json --output ./team-extensions
```

### Example 5: Single Extension (Interactive)

```bash
$ vsix-extension-manager

┌  🔽 VSIX Extension Manager
│
◇  Choose download mode:
│  📦 Single Extension
│
◇  Enter the VS Code extension marketplace URL:
│  https://marketplace.visualstudio.com/items?itemName=ms-python.python
│
◇  Extension info extracted
│
◇  Extension ──────────────────────╮
│                                  │
│  ms-python - python              │
│                                  │
├──────────────────────────────────╯
│
◇  Enter the extension version (or use the version number):
│  latest
│
◇  Enter output directory:
│  ./downloads
│
◇  Download Details ──────────────────────────────────╮
│                                                     │
│  Filename: ms-python.python-2023.20.0.vsix          │
│  Output: ./downloads                                │
│  Resolved Version: 2023.20.0                       │
│  Template: {name}-{version}.vsix                    │
│  URL: https://ms-python.gallery.vs...SIXPackage     │
│                                                     │
├─────────────────────────────────────────────────────╯
│
◇  Download ms-python.python-2023.20.0.vsix?
│  Yes
│
◇  Downloaded successfully!
│
◇  Download Complete ───────────────────────────────────────────╮
│                                                               │
│  File: ms-python.python-2023.20.0.vsix                        │
│  Location: downloads/ms-python.python-2023.20.0.vsix          │
│  Size: 15420 KB                                              │
│  SHA256: a1b2c3d4e5f6789...                                  │
│                                                               │
├───────────────────────────────────────────────────────────────╯
│
└  🎉 Successfully downloaded VSIX extension!
```

### Example 6: Bulk Download

```bash
$ vsix-extension-manager

┌  🔽 VSIX Extension Manager
│
◇  Choose download mode:
│  📚 Bulk Download
│
◇  Enter the path to your JSON file:
│  ./extensions.json
│
◇  Enter output directory:
│  ./downloads
│
●  🔍 Reading and validating JSON file...
│
◆  ✅ JSON validation passed! Found 3 extension(s) to download.
│
●  [1/3] ms-python.python - [██████████░░░░░░░░░░] 45.2% 15.0 MB/38.4 MB
│
●  [1/3] ✅ ms-python.python (38.4 MB) - SHA256: a1b2c3d4... ✅
│
●  [2/3] esbenp.prettier-vscode - [███████████████░░░░░] 78.9% 218 KB/276 KB
│
●  [2/3] ✅ esbenp.prettier-vscode (276 KB) - SHA256: e5f6g7h8... ✅
│
●  [3/3] PKief.material-icon... - [██████████████████░░] 92.1% 738 KB/801 KB
│
●  [3/3] ✅ PKief.material-icon-theme (801 KB) - SHA256: i9j0k1l2... ✅
│
●  Bulk download completed! 3 successful, 0 failed.
│
◇  Download Complete ─────────────────╮
│                                     │
│  Total: 3 extensions                │
│  Successful: 3                      │
│  Failed: 0                          │
│  Output: ./downloads                │
│                                     │
├─────────────────────────────────────╯
│
└  🎉 Bulk download completed! 3 extension(s) downloaded successfully.
```

## 🧩 Manual Installation Methods

### 1. Command Line (.vsix)

- Use the `.vsix` you downloaded with VSIX Extension Manager (default in `./downloads/`).
- Open your terminal and navigate to the directory with the `.vsix` file.
- Run:

```bash
cursor --install-extension your-extension.vsix
```

- Restart Cursor IDE to activate the extension.

### 2. Drag and Drop

- Open Cursor’s Extensions panel (Ctrl+Shift+X).
- Drag the `.vsix` file from your file explorer into the Extensions panel.
- The extension will install automatically.

### 3. Command Palette

- Open the Command Palette with Ctrl+Shift+P.
- Type and select “Extensions: Install from VSIX…”.
- Select your `.vsix` file and confirm.

### Additional Tips

- Some extensions may have compatibility or license limitations due to Cursor’s fork status, especially for Microsoft (official) extensions.
- If you have multiple profiles, you can append `--profile "<profile_name>"` to the install command.

## 💡 Tips & Best Practices

### Extension Management Workflow

1. **Export-Import Workflow**: The most efficient way to migrate extensions between environments:

   ```bash
   # On source machine: export current extensions (auto-detects editor)
   vsix-extension-manager export-installed -o dev-setup.txt -f txt

   # Or export from specific editor
   vsix-extension-manager export-installed --editor cursor -o cursor-setup.txt -f txt
   vsix-extension-manager export-installed --editor vscode -o vscode-setup.txt -f txt

   # On target machine: download all extensions
   vsix-extension-manager from-list --file dev-setup.txt --cache-dir ~/.extensions

   # Install all at once (Cursor or VS Code)
   cursor --install-extension ~/.extensions/*.vsix
   code --install-extension ~/.extensions/*.vsix
   ```

2. **Team Extension Standardization**: Use workspace extensions.json for team consistency:

   ```bash
   # Create team extension recommendations
   vsix-extension-manager export-installed -o .vscode/extensions.json -f extensions.json

   # Team members can download recommended extensions
   vsix-extension-manager from-list --file .vscode/extensions.json
   ```

3. **Multiple Environment Support**: Maintain different extension sets for different purposes:

   ```bash
   # Export different setups from specific editors
   vsix-extension-manager export-installed --editor cursor -o frontend-setup.txt -f txt
   vsix-extension-manager export-installed --editor vscode -o backend-setup.txt -f txt
   vsix-extension-manager export-installed --editor auto -o datascience-setup.txt -f txt

   # Quick setup on new machines (non-interactive bulk with parallelism)
   vsix-extension-manager from-list --file frontend-setup.txt --parallel 5
   ```

4. **Editor Auto-Detection**: VSIX Extension Manager intelligently detects available editors:

   ```bash
   # Auto mode prefers Cursor if both editors have extensions
   vsix-extension-manager export-installed --editor auto

   # Explicit editor selection when you need specific one
   vsix-extension-manager export-installed --editor cursor  # Force Cursor
   vsix-extension-manager export-installed --editor vscode  # Force VS Code
   ```

### Bulk Download Tips

1. **Create Extension Lists**: Save commonly used extension combinations in files:

   ```bash
   # Frontend development stack
   ./frontend-extensions.json

   # Backend development stack
   ./backend-extensions.json

   # Data science toolkit
   ./datascience-extensions.json
   ```

2. **Version Pinning**: Always specify exact versions in your JSON for reproducible setups.

3. **Error Recovery**: The CLI continues downloading even if one extension fails, so you can retry just the failed ones.

4. **Large Batches**: For downloading many extensions, the progress tracking helps you monitor the process.

5. **Organized Storage**: Use filename templates and cache directories for better organization:

   ```bash
   # Organize by source and publisher
   --cache-dir ~/.extensions \
   --filename-template "{source}/{publisher}/{name}-{version}.vsix"

   # Version-focused naming
   --filename-template "{name}_v{version}_{source}.vsix"
   ```

6. **Efficient Re-downloads**: Use `--skip-existing` with cache directories to avoid re-downloading:

   ```bash
   # Only download new or updated extensions
   vsix-extension-manager download \
     --file ./extensions.json \
     --cache-dir ~/.extensions \
     --skip-existing
   ```

7. **Integrity Verification**: Generate and verify checksums for downloaded files:

   ```bash
   # Generate checksums for verification
   vsix-extension-manager download \
     --file ./extensions.json \
     --checksum \
     --summary ./results.json

   # Verify single extension against known hash
   vsix-extension-manager download \
     --url "..." \
     --version "1.2.3" \
     --verify-checksum "a1b2c3d4e5f6..."

   # Verify all files in bulk download against same hash (parallel supported)
   vsix-extension-manager download \
     --file ./extensions.json \
     --verify-checksum "a1b2c3d4e5f6..." \
     --parallel 4
   ```

### Finding Extension URLs and Versions

1. **Browse Extensions**: Go to [Visual Studio Marketplace](https://marketplace.visualstudio.com/vscode)
2. **Copy URL**: From the extension page, copy the full URL (e.g., `https://marketplace.visualstudio.com/items?itemName=ms-python.python`)
3. **Find Version**: Check the "Version History" tab or "More Info" section for version numbers

## 🔧 Development

### Prerequisites

- Node.js 16+
- npm or yarn

### Setup

1. Clone the repository:

```bash
git clone https://github.com/gabros20/vsix-extension-manager.git
cd vsix-extension-manager
```

2. Install dependencies:

```bash
npm install
```

3. Build the project:

```bash
npm run build
```

4. Run in development mode:

```bash
npm run dev
```

### Scripts

- `npm run build` - Compile TypeScript to JavaScript
- `npm run dev` - Run in development mode with ts-node
- `npm start` - Run the compiled version
- `npm run lint` - Run ESLint for code quality
- `npm run format` - Format code with Prettier
- `npm run lint:fix` - Auto-fix ESLint issues
- `npm run prepack` - Build before packaging
- `npm run prepublishOnly` - Build before publishing

## 🧱 Architecture & Internals (for developers)

This README focuses on how to use the CLI. If you're interested in the internal design, module layout, and architectural decisions, see the developer documentation:

- See Architecture: [architecture.md](architecture.md)

## URL Patterns

Constructed download URLs:

```
# Marketplace
https://[publisher].gallery.vsassets.io/_apis/public/gallery/publisher/[publisher]/extension/[extension]/[version]/assetbyname/Microsoft.VisualStudio.Services.VSIXPackage

# OpenVSX
https://open-vsx.org/api/[publisher]/[extension]/[version]/file/[publisher].[extension]-[version].vsix
```

## Error Handling (quick overview)

Errors are shown with clear messages and suggestions. Bulk operations continue across failures and report a summary. For the full taxonomy, typed errors and developer details, see [architecture.md](architecture.md).

## 🤝 Contributing

We welcome contributions! This project uses a protected main branch workflow to ensure code quality and maintain a clean git history.

### 🚀 Quick Start

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/vsix-extension-manager.git
   cd vsix-extension-manager
   ```
3. **Create a feature branch**:
   ```bash
   git checkout -b feature/your-feature-name
   ```
4. **Make your changes** and commit using conventional commits (see below)
5. **Push to your fork**:
   ```bash
   git push origin feature/your-feature-name
   ```
6. **Create a Pull Request** from your fork to the main repository

### Conventional Commits

This project uses [Conventional Commits](https://www.conventionalcommits.org/) for automatic versioning and releases. Please follow this format:

```bash
# Format: <type>[optional scope]: <description>

# Examples:
git commit -m "feat: add new download feature"
git commit -m "fix: resolve URL parsing issue"
git commit -m "docs: update README with new examples"
git commit -m "feat!: breaking change in API"
git commit -m "feat(download): add bulk download capability"
```

**Commit Types:**

- `feat`: New features
- `fix`: Bug fixes
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `perf`: Performance improvements
- `test`: Adding or updating tests
- `chore`: Build process or tooling changes

**Breaking Changes:** Add `!` after the type for breaking changes (e.g., `feat!: breaking change`)

## 🚀 Automated Publishing

This project uses GitHub Actions for automated publishing to NPM:

- **Automatic Versioning**: Version bumps based on conventional commits
- **NPM Publishing**: Automatic publish on merge to main branch
- **GitHub Releases**: Automatic release creation with tags
- **Version Sync**: GitHub releases and NPM versions stay in sync

**Workflow:**

1. Make changes and commit with conventional commit format
2. Create Pull Request from feature branch
3. Get review and approval
4. Merge PR to main branch
5. GitHub Actions automatically:
   - Determines version bump (patch/minor/major)
   - Updates package.json version
   - Publishes to NPM
   - Creates GitHub release with tag
   - Pushes version changes back to repository

**Note**: Since main branch is protected, publishing only occurs after PR approval and merge, ensuring all changes are reviewed.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Original inspiration from [mjmirza/download-vsix-from-visual-studio-market-place](https://github.com/mjmirza/download-vsix-from-visual-studio-market-place)
- Built with modern CLI tools: [Commander.js](https://github.com/tj/commander.js) and [@clack/prompts](https://github.com/natemoo-re/clack).

## 📞 Support

If you encounter any issues or have questions:

1. Check the [Issues](https://github.com/gabros20/vsix-extension-manager/issues) page
2. Create a new issue with detailed description
3. Include the marketplace URL and version you're trying to download

<div align="left" style="padding-top: 20px; display: flex; flex-direction: row; align-items: center; gap: 10px;">
  <img src="assets/cursor-inside.png" alt="Built with Cursor" width="100" />
  <em>This package is Built with Cursor for Cursor</em>
</div>
