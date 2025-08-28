# VSIX Downloader

A modern CLI tool to download VS Code extensions as VSIX files directly from the Visual Studio Marketplace. Supports both single extension downloads and bulk downloads from JSON configuration files.

## 🎯 What This Tool Solves

### The Microsoft-Cursor Extension Block

Recently, Microsoft quietly blocked Cursor (an AI-powered VSCode fork) from accessing the VSCode extension marketplace by adding a simple environment check. This means Cursor users can no longer install extensions directly through the marketplace, seeing "This extension is not available in your environment" errors.

### Why You Need This Tool

**VSIX Downloader** provides a workaround by downloading extensions as `.vsix` files that can be manually installed in Cursor. This is particularly valuable for:

- **Cursor Users**: Bypass Microsoft's marketplace restrictions and continue using your favorite extensions
- **Offline Development**: Download extensions once and install them on machines without internet access
- **Version Control**: Pin specific extension versions for consistent development environments
- **Bulk Setup**: Quickly set up new development environments with all your preferred extensions
- **Backup Strategy**: Create local backups of extensions you depend on

### Perfect For

- Developers using Cursor who need to maintain their extension workflow
- Teams wanting to standardize development environments
- Offline development scenarios
- Extension version management and rollbacks

## 🚀 Features

- **Beautiful CLI**: Stunning interface powered by [Clack](https://github.com/bombshell-dev/clack)
- **Dual Download Modes**: Choose between single extension or bulk download from JSON
- **Interactive Prompts**: Elegant bordered prompts with validation
- **Bulk Download**: Download multiple extensions at once with progress tracking
- **JSON Validation**: Comprehensive validation for bulk download files
- **Non-Interactive Bulk Mode**: Use `--file` to run bulk downloads without prompts
- **Sequential Downloads**: Clean, readable progress with `--retry`/`--retry-delay` options
- **Summary Output**: Write machine-readable results with `--summary <path>.json`
- **Modern Stack**: Built with TypeScript, Commander.js, and Clack
- **Error Handling**: Comprehensive error handling and validation
- **Progress Indicators**: Beautiful spinners and visual feedback
- **Flexible Output**: Customizable download directory (defaults to `./downloads` in current directory)
- **Custom Filename Templates**: Organize downloads with variable substitution (`{name}`, `{version}`, `{source}`, `{publisher}`)
- **Cache Directory Support**: Persistent storage with skip/overwrite behavior for efficient re-downloads
- **Smart File Handling**: Skip existing files or overwrite with intelligent existence checking
- **Progress Indicators**: Real-time download progress with file size, speed, and progress bars
- **Checksum Verification**: Generate SHA256 checksums and verify file integrity
- **Smart Parsing**: Extracts extension info from Marketplace and OpenVSX URLs
- **Interactive Source Selection**: Auto-detects source from URL with ability to switch
- **Mixed-Source Bulk**: Use Marketplace and OpenVSX URLs in the same JSON list
- **Source-Aware "latest"**: Resolve `latest` for both Marketplace and OpenVSX (single and bulk)
- **Versions Command (Both Sources)**: List versions from Marketplace or OpenVSX via URL

## 📦 Installation

### Global Installation (Recommended)

```bash
npm install -g vsix-downloader
```

### Local Installation

```bash
npm install vsix-downloader
```

## 🛠️ Usage

### Interactive Mode (Recommended)

Simply run the command and choose your download mode:

```bash
vsix-downloader
```

You'll be prompted to choose between:

- **📦 Single Extension**: Download one extension interactively
- **📚 Bulk Download**: Download multiple extensions from JSON file

Or use the download command directly:

```bash
vsix-downloader download
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
vsix-downloader download --url "https://marketplace.visualstudio.com/items?itemName=ms-python.python" --version "2023.20.0"

# Resolve and download the latest version (stable by default)
vsix-downloader download --url "https://marketplace.visualstudio.com/items?itemName=ms-python.python" --version latest

# Prefer pre-release when resolving 'latest'
vsix-downloader download --url "https://marketplace.visualstudio.com/items?itemName=ms-python.python" --version latest --pre-release

# Specify custom output directory
vsix-downloader download --url "..." --version "1.2.3" --output "./my-extensions"
```

### Bulk Download from JSON

For downloading multiple extensions, create a JSON file with the extension details and use bulk mode.

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
vsix-downloader download \
  --file ./extensions.json \
  --output ./downloads

# Advanced: sequential downloads with retries, backoff, quiet logs and JSON summary
vsix-downloader download \
  --file ./extensions.json \
  --output ./downloads \
  --retry 3 \
  --retry-delay 1500 \
  --summary ./summary.json \
  --quiet

# Bulk download with custom naming and cache directory
vsix-downloader download \
  --file ./extensions.json \
  --cache-dir ~/.vsix-cache \
  --filename-template "{source}/{publisher}-{name}-v{version}.vsix" \
  --skip-existing

# Bulk download with progress and checksums
vsix-downloader download \
  --file ./extensions.json \
  --checksum \
  --cache-dir ~/.extensions \
  --quiet

# Bulk download with verification against known checksums
vsix-downloader download \
  --file ./extensions.json \
  --verify-checksum "a1b2c3d4e5f6..." \
  --retry 3
```

### Available Commands

```bash
vsix-downloader download [options]    # Download a VSIX file
vsix-downloader versions [options]    # List available versions for an extension
vsix-downloader --help               # Show help
vsix-downloader --version            # Show version
```

### Options

- `-u, --url <url>` - Marketplace URL of the extension
- `-v, --version <version>` - Version of the extension to download (or `latest`)
- `--pre-release` - Prefer pre-release when resolving `latest`
- `--source <source>` - Source registry: `marketplace` | `open-vsx` | `auto` (default: marketplace)
  - In interactive mode, the source defaults from the URL but you can change it
- `-o, --output <path>` - Output directory (default: ./downloads)
- `-f, --file <path>` - Bulk JSON file path (non-interactive)
- `--parallel <n>` - Number of parallel downloads in bulk mode (default: 4)
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
- `-h, --help` - Display help information

### Versions Command

List all available versions for an extension (Marketplace or OpenVSX). Useful when picking a pinned version or checking pre-releases.

```bash
# Prompt for URL, display human-readable list
vsix-downloader versions

# Provide URL and output JSON (works with Marketplace or OpenVSX URLs)
vsix-downloader versions --url "https://marketplace.visualstudio.com/items?itemName=ms-python.python" --json
vsix-downloader versions --url "https://open-vsx.org/extension/ms-python/python" --json
```

### OpenVSX Support

You can download from OpenVSX by specifying the source or by pasting an OpenVSX URL in interactive mode (the source will be preselected as OpenVSX, but you can switch). Bulk supports mixed sources in the same list.

```bash
# Single extension from OpenVSX
vsix-downloader download \
  --url "https://open-vsx.org/extension/ms-python/python" \
  --version latest \
  --source open-vsx

# Bulk with OpenVSX
vsix-downloader download \
  --file ./extensions.json \
  --output ./downloads \
  --source open-vsx
```

Note: `auto` source is reserved for future fallback behavior. Currently, set `--source` explicitly to `marketplace` or `open-vsx`.

### Custom Filename Templates

Customize how downloaded files are named using the `--filename-template` option with variable substitution:

```bash
# Use a custom filename template
vsix-downloader download \
  --url "https://marketplace.visualstudio.com/items?itemName=ms-python.python" \
  --version "2023.20.0" \
  --filename-template "{publisher}_{name}_v{version}.vsix"
# Results in: ms-python_ms-python.python_v2023.20.0.vsix

# Include source in filename
vsix-downloader download \
  --url "..." \
  --version "1.2.3" \
  --filename-template "{source}-{name}-{version}.vsix"
# Results in: marketplace-publisher.extension-1.2.3.vsix

# Bulk download with custom template
vsix-downloader download \
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
vsix-downloader download \
  --url "..." \
  --version "1.2.3" \
  --cache-dir ~/.vsix-cache

# Skip existing files in cache
vsix-downloader download \
  --file ./extensions.json \
  --cache-dir ~/.vsix-cache \
  --skip-existing

# Bulk download to cache with custom naming
vsix-downloader download \
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
vsix-downloader download \
  --url "https://marketplace.visualstudio.com/items?itemName=ms-python.python" \
  --version "2023.20.0" \
  --checksum

# Verify downloaded file against known checksum
vsix-downloader download \
  --url "..." \
  --version "1.2.3" \
  --verify-checksum "a1b2c3d4e5f6...your-sha256-hash-here"

# Bulk download with progress and checksums
vsix-downloader download \
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
vsix-downloader download --url "https://marketplace.visualstudio.com/items?itemName=ms-python.python" --version "2023.20.0"
```

### Example 2: Single Extension (Interactive)

```bash
$ vsix-downloader

┌  🔽 VSIX Downloader
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

### Example 3: Bulk Download

```bash
$ vsix-downloader

┌  🔽 VSIX Downloader
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

- Use the `.vsix` you downloaded with this tool (default in `./downloads/`).
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

### Bulk Download Tips

1. **Create Extension Lists**: Save commonly used extension combinations in JSON files:

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
   vsix-downloader download \
     --file ./extensions.json \
     --cache-dir ~/.extensions \
     --skip-existing
   ```

7. **Integrity Verification**: Generate and verify checksums for downloaded files:

   ```bash
   # Generate checksums for verification
   vsix-downloader download \
     --file ./extensions.json \
     --checksum \
     --summary ./results.json

   # Verify single extension against known hash
   vsix-downloader download \
     --url "..." \
     --version "1.2.3" \
     --verify-checksum "a1b2c3d4e5f6..."

   # Verify all files in bulk download against same hash
   vsix-downloader download \
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
git clone https://github.com/yourusername/vsix-downloader.git
cd vsix-downloader
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
- `npm run prepare` - Build before publishing

## 📁 Project Structure

```
vsix-downloader/
├── src/
│   ├── commands/
│   │   └── download.ts          # Main download command logic
│   ├── utils/
│   │   ├── urlParser.ts         # URL parsing utilities
│   │   ├── downloader.ts        # File download utilities
│   │   └── fileManager.ts       # File system utilities
│   └── index.ts                 # CLI entry point
├── dist/                        # Compiled JavaScript (generated)
├── package.json
├── tsconfig.json
└── README.md
```

## 🔍 How It Works

1. **URL Parsing**: Extracts `publisher.extension` from Marketplace or OpenVSX URLs
2. **Extension Info**: Splits the `itemName` into publisher and extension name
3. **Download URL Construction**: Builds the VSIX download URL using the selected source
4. **File Download**: Downloads the VSIX file using axios with progress tracking
5. **File Management**: Creates output directory and saves the file with proper naming

### URL Patterns

The tool constructs download URLs using these patterns:

```
# Marketplace
https://[publisher].gallery.vsassets.io/_apis/public/gallery/publisher/[publisher]/extension/[extension]/[version]/assetbyname/Microsoft.VisualStudio.Services.VSIXPackage

# OpenVSX
https://open-vsx.org/api/[publisher]/[extension]/[version]/file/[publisher].[extension]-[version].vsix
```

## ⚠️ Error Handling

The tool handles various error scenarios:

- **Invalid URLs**: Validates marketplace URL format
- **Missing Versions**: Validates version number format
- **Network Errors**: Handles timeouts and connection issues
- **File System Errors**: Manages directory creation and permissions
- **404 Errors**: Clear messages for non-existent extensions/versions

## 🤝 Contributing

We welcome contributions! This project uses a protected main branch workflow to ensure code quality and maintain a clean git history.

### 🚀 Quick Start

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/vsix-downloader.git
   cd vsix-downloader
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
- Built with modern CLI tools: Commander.js, Inquirer.js, Chalk, and Ora

## 📞 Support

If you encounter any issues or have questions:

1. Check the [Issues](https://github.com/yourusername/vsix-downloader/issues) page
2. Create a new issue with detailed description
3. Include the marketplace URL and version you're trying to download

<div align="left" style="padding-top: 20px; display: flex; flex-direction: row; align-items: center; gap: 10px;">
  <img src="assets/cursor-inside.png" alt="Built with Cursor" width="100" />
  <em>This package is Built with Cursor for Cursor</em>
</div>
