## VSIX Extension Manager

A modern CLI for downloading, exporting, importing, and managing VS Code/Cursor extensions as VSIX files from both the Visual Studio Marketplace and OpenVSX.

[![npm version](https://img.shields.io/npm/v/vsix-extension-manager.svg)](https://www.npmjs.com/package/vsix-extension-manager)
[![npm downloads](https://img.shields.io/npm/dm/vsix-extension-manager.svg)](https://www.npmjs.com/package/vsix-extension-manager)
[![license: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

### Table of Contents

- [Introduction / Why](#introduction--why)
- [Features / Highlights](#features--highlights)
- [Installation / Getting Started](#installation--getting-started)
- [Usage / Examples](#usage--examples)
  - [Interactive Mode](#interactive-mode)
  - [Single Extension Download](#single-extension-download)
  - [Bulk Download from JSON](#bulk-download-from-json)
  - [Export Installed Extensions](#export-installed-extensions)
  - [Download from Lists](#download-from-lists)
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

VSIX Extension Manager solves this with a fast, reliable CLI for downloading VSIX files, exporting installed extensions, importing lists, and managing versions across both the Visual Studio Marketplace and OpenVSX.

### Features / Highlights

- ✅ Works with both Marketplace and OpenVSX (auto-detect or choose explicitly)
- ✅ Single and bulk downloads, including mixed-source lists
- ✅ Resolve latest version (stable by default) or prefer pre-release
- ✅ Export installed extensions from VS Code or Cursor (txt/extensions.json)
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

#### Interactive Mode

```bash
vsix-extension-manager
```

Interactive Mode Menu:

- Download single extension from marketplace URL
- Download multiple extensions from JSON collection (URLs + versions)
- Download from exported list (txt / extensions.json)
- Export installed extensions to (txt / extensions.json)
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

| Mode                        | Input                                     | Version resolution                       | Parallel                                | Best for                          |
| --------------------------- | ----------------------------------------- | ---------------------------------------- | --------------------------------------- | --------------------------------- |
| Single extension (URL)      | Marketplace/OpenVSX URL                   | Exact or `latest` (pre-release optional) | N/A                                     | One-off downloads                 |
| Bulk from JSON collection   | JSON array of `{ url, version, source? }` | Exact or `latest` per entry              | Yes (CLI `--parallel`, non-interactive) | Mixed sources, pinned versions    |
| Download from exported list | `txt` of IDs or `extensions.json`         | Resolves `latest` automatically          | Yes (CLI)                               | Migrating/export-import workflows |

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
  - Inherits bulk options from download

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

- Why can’t I install some Microsoft extensions in Cursor?
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
  - See [`architecture.md`](architecture.md) for module layout and design.

- What are the constructed download URL patterns?
  - Marketplace: `https://[publisher].gallery.vsassets.io/_apis/public/gallery/publisher/[publisher]/extension/[extension]/[version]/assetbyname/Microsoft.VisualStudio.Services.VSIXPackage`
  - OpenVSX: `https://open-vsx.org/api/[publisher]/[extension]/[version]/file/[publisher].[extension]-[version].vsix`

### License

MIT — see [`LICENSE`](LICENSE).

### Acknowledgments

- Inspired by [`mjmirza/download-vsix-from-visual-studio-market-place`](https://github.com/mjmirza/download-vsix-from-visual-studio-market-place)
- Built with modern CLI tooling: [`Commander.js`](https://github.com/tj/commander.js) and [`@clack/prompts`](https://github.com/natemooe/clack)

<div align="left" style="padding-top: 20px; display: flex; flex-direction: row; align-items: center; gap: 10px;">
  <img src="assets/cursor-inside.png" alt="Built with Cursor" width="100" />
  <em>This package is Built with Cursor for Cursor</em>
</div>
