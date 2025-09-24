# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Project Overview

VSIX Extension Manager is a TypeScript CLI tool for managing VS Code and Cursor extensions, bypassing marketplace restrictions by downloading VSIX files directly. The tool supports downloading, exporting, importing, and installing extensions from both Visual Studio Marketplace and OpenVSX.

## Architecture

### Layered Architecture

- **commands/** - CLI entry points and interactive prompts (Commander.js)
- **features/** - Business logic orchestration for each use case
- **core/** - Foundational utilities (filesystem, HTTP, registry, validation, errors)
- **config/** - Configuration system with CLI > ENV > FILE > DEFAULTS priority

### Key Services

- **Download Service**: Single/bulk downloads with progress tracking
- **Install Service**: Editor detection and extension installation
- **Export Service**: Scan and export installed extensions
- **Registry Service**: Parse and resolve versions from Marketplace/OpenVSX

## Common Commands

### Development

```bash
# Install dependencies
pnpm install

# Build TypeScript to JavaScript
pnpm run build

# Run in development mode (with ts-node)
pnpm run dev

# Run tests (placeholder - no tests yet)
pnpm test

# Lint and format code
pnpm run lint
pnpm run lint:fix
pnpm run format

# Test CLI locally after build
pnpm start
# Or install globally for testing
npm install -g .
```

### Release & CI

```bash
# Semantic release (automatic on main branch push)
pnpm run release

# CI runs on PRs: type check, build, lint (cross-platform)
# Automatic releases via semantic-release on main branch
```

## Development Workflow

### Adding New Commands

1. Create command handler in `src/commands/`
2. Add feature logic in `src/features/<feature>/services/`
3. Update CLI entry in `src/index.ts`
4. Reuse core modules from `src/core/`

### Configuration Updates

1. Update Zod schema in `src/config/schema.ts`
2. Add environment variable mapping if needed
3. Update CLI option conversion in `src/config/loader.ts`

### Error Handling

- Use typed errors from `src/core/errors/definitions.ts`
- Provide actionable error messages with recovery suggestions
- Errors are automatically formatted based on quiet/json mode

## Key Patterns

### Configuration Priority

```
CLI flags > VSIX_* env vars > config files > defaults
```

Config files searched: `.vsixrc(.json|.yaml)`, `vsix.config.(json|yaml)`, `~/.config/vsix-extension-manager/`

### Parallel Processing

- Interactive mode: Sequential for clean UX
- Non-interactive bulk: Parallel with `--parallel` (1-20, default 3)

### Editor Detection

- Auto-detects VS Code and Cursor installations
- Validates binary identity matches requested editor
- Supports explicit binary paths via `--code-bin`/`--cursor-bin`

### File Naming Templates

Variables: `{name}`, `{version}`, `{source}`, `{publisher}`, `{displayName}`

## Testing the CLI

### Quick Install Flow

```bash
# Download and install in one step
vsix-extension-manager quick-install --url "https://marketplace.visualstudio.com/items?itemName=ms-python.python"
```

### Download Extensions

```bash
# Single extension
vsix-extension-manager download --url "..." --version latest

# Bulk from JSON
vsix-extension-manager download --file extensions.json --parallel 5

# From exported list
vsix-extension-manager from-list --file extensions.txt
```

### Install Extensions

```bash
# Install single VSIX
vsix-extension-manager install --vsix ./file.vsix

# Install all from directory
vsix-extension-manager install --vsix-dir ./downloads

# Install from list with auto-download
vsix-extension-manager install --file extensions.txt --download-missing
```

### Export Installed

```bash
# Export to text list
vsix-extension-manager export-installed -o extensions.txt -f txt

# Export to extensions.json
vsix-extension-manager export-installed -o extensions.json -f extensions.json
```

## Important Implementation Details

### Extension Version Resolution

- "latest" resolves to most recent stable version
- `--pre-release` flag opts into pre-release versions
- Supports exact semver versions

### Source Detection

- Automatically detects Marketplace vs OpenVSX from URL
- Can override with `--source marketplace|open-vsx`
- Mixed sources supported in bulk operations

### Install Validation

- Checks for binary identity mismatches (e.g., `code` pointing to Cursor)
- Uses `--allow-mismatched-binary` to bypass check
- Auto-detects editor installations across platforms

### Error Categories

- Network errors (timeouts, 404s)
- Filesystem errors (permissions, disk space)
- Validation errors (invalid inputs, schemas)
- Registry errors (unsupported sources)
- Configuration errors (invalid config files)

## Environment Variables

Key environment variables for configuration:

```bash
VSIX_OUTPUT_DIR="./downloads"
VSIX_CACHE_DIR="~/.vsix-cache"
VSIX_PARALLEL=5
VSIX_RETRY=3
VSIX_SKIP_EXISTING=true
VSIX_EDITOR="cursor"
VSIX_CODE_BIN="/path/to/code"
VSIX_CURSOR_BIN="/path/to/cursor"
```

## Commit Convention

Use Conventional Commits for automatic versioning:

- `feat:` New features
- `fix:` Bug fixes
- `docs:` Documentation changes
- `refactor:` Code restructuring
- `chore:` Maintenance tasks

## Known Limitations

- No unit tests yet (test infrastructure planned)
- Sequential processing in interactive mode only
- JSON output not available for all commands yet
- Download resume not supported for interrupted downloads
