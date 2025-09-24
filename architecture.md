# VSIX Extension Manager Architecture

This document describes the internal architecture, design decisions, and developer-facing details of VSIX Extension Manager. It complements the user-focused README by explaining how the CLI is structured, how core flows work, and how to extend or contribute safely.

## Goals and Principles

- Maintain a clean, layered architecture with strict separation of concerns
- Keep user interaction (CLI) decoupled from business workflows (features) and foundational services (core)
- Prefer explicit, typed interfaces and readable code over cleverness
- Provide actionable, typed error handling and thorough input validation
- Favor composability and testability across modules

## High-Level Architecture

Layers and responsibilities:

- `commands/` (Interface Layer)
  - CLI entry points, prompt flows, argument parsing (Commander.js)
  - Orchestrates calls into the `features/` layer
  - Handles interactive UX and small presentation details

- `features/` (Business Logic Layer)
  - Use-case oriented services composed from `core/` primitives
  - Example: single/bulk download orchestration, export services, import parsing

- `core/` (Foundational Layer)
  - Reusable, implementation-specific modules used across features
  - Submodules: `config/`, `errors/`, `validation/`, `filesystem/`, `http/`, `registry/`, `ui/`

### Module Map

```
src/
├─ commands/                    # CLI command handlers (UI/Orchestration layer)
│  ├─ download.ts              # Interactive single & bulk entrypoint
│  ├─ quickInstall.ts          # One-off: temp download → install → cleanup
│  ├─ exportInstalled.ts       # Export installed extensions from editors
│  ├─ fromList.ts              # Download from list formats (txt/json/extensions.json)
│  ├─ install.ts               # Install VSIX files into editors (supports directory scanning)
│  ├─ interactive.ts           # Interactive command flows and prompts
│  ├─ rollback.ts              # Restore extensions from backups
│  ├─ updateInstalled.ts       # Update installed extensions with automatic backup
│  └─ versions.ts              # List versions for an extension
├─ config/                     # Configuration system
│  ├─ constants.ts             # Re-exports and defaults for legacy consumers
│  ├─ loader.ts                # CLI > ENV > FILE > DEFAULTS resolution
│  └─ schema.ts                # Zod schema, types, env var mapping
├─ core/                       # Foundational modules
│  ├─ backup/                  # Backup and restore functionality
│  │  ├─ backupService.ts      # Backup creation, restoration, and history management
│  │  └─ index.ts              # Backup API exports
│  ├─ errors/                  # Typed errors, formatting, enhancement
│  │  ├─ definitions.ts        # Error class definitions and factories
│  │  ├─ handler.ts            # Error handling and formatting
│  │  ├─ index.ts              # Public error API exports
│  │  └─ types.ts              # Error type definitions
│  ├─ filesystem/              # File I/O, naming templates, checksums
│  │  ├─ checksum.ts           # SHA256 checksum generation/verification
│  │  ├─ fileManager.ts        # File operations and existence strategies
│  │  ├─ filenameTemplate.ts   # Template-based filename generation
│  │  └─ index.ts              # Filesystem API exports
│  ├─ http/                    # HTTP downloader with progress tracking
│  │  └─ downloader.ts         # Axios streaming download with progress
│  ├─ registry/                # Marketplace/OpenVSX parsing and versions
│  │  ├─ extensionVersions.ts  # Version fetching and resolution
│  │  ├─ index.ts              # Registry API exports
│  │  └─ urlParser.ts          # URL parsing for different registries
│  ├─ ui/                      # Progress utilities and formatting helpers
│  │  └─ progress.ts           # Progress tracking and rendering
│  ├─ validation/              # AJV schemas and validator service
│  │  ├─ index.ts              # Validation API exports
│  │  ├─ schemas.ts            # JSON Schema definitions
│  │  └─ validator.ts          # AJV validator service
│  ├─ helpers.ts               # Shared utility functions
│  └─ types.ts                 # Shared type definitions
├─ features/                   # Use-case orchestration
│  ├─ download/                # Single and bulk download services
│  │  ├─ services/
│  │  │  ├─ bulkDownloadService.ts    # Bulk download orchestration
│  │  │  └─ singleDownloadService.ts  # Single download orchestration
│  │  └─ index.ts              # Download feature exports
│  ├─ export/                  # Export installed extensions
│  │  ├─ services/
│  │  │  └─ installedExtensionsService.ts  # Extension scanning and formatting
│  │  └─ index.ts              # Export feature exports
│  ├─ import/                  # Parse extension lists and hand off to download
│  │  ├─ services/
│  │  │  └─ extensionListParserService.ts  # List parsing and normalization
│  │  └─ index.ts              # Import feature exports
│  ├─ install/                 # Install VSIX files into editors with scanning services
│  │  ├─ services/
│  │  │  ├─ editorCliService.ts        # Editor detection and CLI resolution
│  │  │  ├─ installFromListService.ts  # Install from extension lists
│  │  │  ├─ installService.ts          # Core installation logic
│  │  │  └─ vsixScannerService.ts      # VSIX file discovery and selection
│  │  └─ index.ts              # Install feature exports
│  └─ update/                  # Update installed extensions
│     ├─ services/
│     │  └─ updateInstalledService.ts  # Update orchestration with backup integration
│     └─ index.ts              # Update feature exports
└─ index.ts                    # Main CLI entry point
```

## Core Flows

### Configuration Flow

1. CLI parses raw options (Commander)
2. `convertCliToConfig` maps CLI flags → config keys
3. `loadConfig` merges sources by priority: CLI > ENV > FILE > DEFAULTS
4. Zod validates the final, merged `Config`

Key files: `src/config/loader.ts`, `src/config/schema.ts`, `src/config/constants.ts`

Notable behavior:

- Supported config files: `.vsixrc(.json|.yaml|.yml)`, `vsix.config.(json|yaml|yml)` in project, `~/.config/vsix-extension-manager/`, or `~/.vsixrc*`
- ENV variables use `VSIX_*` prefix (see `ENV_VAR_MAP`)

### Download Flow

1. `commands/download.ts` collects inputs (interactive or flags)
2. Validation for inputs and templates (basic checks in command + core validators)
3. `features/download` resolves version via `core/registry`
4. Download happens via `core/http/downloader` with progress callbacks
5. `core/filesystem` manages output directories, file existence, naming, and checksums
6. Results surfaced via CLI (spinners, notes)

Notes:

- Single download uses `singleDownloadService.ts`
- Bulk download uses `bulkDownloadService.ts` and validates input JSON structure
- Bulk execution model:
  - Interactive UI (spinners/prompts): sequential for clean UX
  - Non-interactive (flag-based, e.g., `--file`): parallel with bounded concurrency via `--parallel` (default 3)
  - Concurrency bounds are validated (1–20) and can be set via `VSIX_PARALLEL`

### Export Flow

1. `commands/exportInstalled.ts` determines editor and format
2. `features/export` scans extensions directory and formats output
3. Supports JSON, txt, and `extensions.json` (workspace recommendations)

### Import/From-List Flow

1. `commands/fromList.ts` reads list content (txt/json/extensions.json)
2. `features/import` validates and normalizes into extension IDs
3. Converts IDs into bulk items and hands off to bulk download

### Versions Flow

1. `commands/versions.ts` parses URL and infers source
2. `core/registry/extensionVersions.ts` fetches versions from Marketplace or OpenVSX
3. Outputs human-readable or JSON list

### Install Flow

1. `commands/install.ts` determines install mode and collects inputs
   - Single install accepts either VSIX file path or directory path
   - Directory input triggers VSIX scanning via `features/install/services/vsixScannerService`
   - Interactive mode: user selects from multiple VSIX files when found
   - Quiet/JSON mode: auto-selects newest by modification time
2. Editor detection and binary resolution via `features/install/services/editorCliService`
3. Installation execution via `features/install/services/installService`
4. Results surfaced via CLI with progress tracking and error handling

### Quick-Install Flow

1. `commands/quickInstall.ts` collects the URL (and optional editor/bin flags)
2. Creates a unique temp directory under `os.tmpdir()`
3. Uses `features/download/downloadSingleExtension` to fetch the VSIX (latest by default)
4. Resolves target editor via `features/install/services/editorCliService`
   - Auto-detects; prompts when multiple; quiet/json prefers Cursor
   - Supports `--code-bin` / `--cursor-bin` and `--allow-mismatched-binary`
5. Preflight validation via `InstallService.validatePrerequisites`
6. Shows "Install Details" (paths are middle‑truncated to fit TTY)
7. On confirmation, installs via `InstallService.installSingleVsix`
8. Finally, removes the temp directory regardless of success/failure

Notes:

- This command is intentionally non-persistent: no output artifacts remain
- Behavior mirrors single install's editor selection and confirmation UX

### Update Flow

1. `commands/updateInstalled.ts` determines update mode (all vs selected)
2. Scans installed extensions via `features/export/installedExtensionsService`
3. Resolves latest versions from registry with fallback (Marketplace → OpenVSX)
4. **Creates backup** via `core/backup/backupService` before each update (unless `--skip-backup`)
5. Downloads new versions to temp directory
6. Installs with force-reinstall flag via `features/install/installService`
7. Reports summary including backup IDs for potential rollback

Notes:

- Interactive mode allows selecting specific extensions to update
- Backups stored in `~/.vsix-backups/` by default (configurable)
- Parallel updates supported via `--parallel` flag
- Dry-run mode available for preview

### Rollback Flow

1. `commands/rollback.ts` determines operation mode (list/restore/cleanup)
2. For restore: loads backup history from `~/.vsix-backups/backup-history.json`
3. Interactive selection or direct restore via backup ID/latest flag
4. Restoration via `core/backup/backupService.restoreExtension`
5. Optional force flag to overwrite existing extensions

Notes:

- Cleanup mode removes old backups keeping last N per extension
- JSON output available for automation
- Supports filtering by extension ID or editor

## Foundational Modules

### Backup (`core/backup`)

- Complete backup and restore system for extension safety
- Metadata tracking with JSON history file (`backup-history.json`)
- Automatic cleanup keeping last N backups per extension
- Directory size calculation for monitoring disk usage

Key capabilities:

- `backupExtension()`: Creates timestamped backup with metadata
- `restoreExtension()`: Restores from backup with optional force
- `listBackups()`: Query backups with filtering
- `cleanupOldBackups()`: Automatic retention management

### Configuration (`config/`)

- `schema.ts` defines `ConfigSchema` with Zod, defaults, and env var mappings
- `loader.ts` merges config sources and throws `ConfigError` with actionable messages

### Errors (`core/errors`)

- Typed error classes (`VsixError` and specializations) with categories and severities
- Factory helpers with actionable suggestions (e.g., `NetworkErrors`, `FileSystemErrors`)
- Error handler to format output (rich or JSON) and enhance common Node/OS errors

User-facing overview in README is intentionally brief; this section contains the taxonomy and examples that were previously in README.

### Validation (`core/validation`)

- AJV-based validator with compiled JSON Schemas
- Validates: bulk JSON inputs (array or object wrapper), `extensions.json`, simple arrays
- Produces structured error info for user-friendly messaging
  - Bulk schema enforces URL patterns, `version` semantics (`latest` or semver), and optional `source`
  - Helpful error aggregation with data paths for quick fixes

### Registry (`core/registry`)

- URL parsing for Marketplace and OpenVSX
- Version resolution with preference rules (stable vs pre-release)
- Download URL construction for both ecosystems

### HTTP (`core/http/downloader.ts`)

- Axios streaming download with progress events
- Applies default timeout and User-Agent (from config constants)
- Normalizes common HTTP errors (404, 403, timeouts)

### Filesystem (`core/filesystem`)

- Directory creation and validation, file existence strategies (`SKIP`, `OVERWRITE`, `PROMPT`)
- Filename templating with variables `{name}`, `{version}`, `{source}`, `{publisher}`, `{displayName}`
- Checksum generation/verification (SHA256)
  - Cache directory behavior (overrides output); `skipExisting`/`overwrite`
  - Progress indicators are emitted via `ui/progress` (interval-throttled)

### UI (`core/ui/progress.ts`)

- Progress tracker to compute percentage, speed, and ETA
- Helpers to render progress bars and human-readable byte/time formats

## Behavior Notes and Limitations

- Bulk downloads: interactive flows remain sequential; non-interactive bulk supports parallel downloads with bounded concurrency (`--parallel`, default 3, range 1–20).
- `--json` output is supported for some commands and error handling, but not all interactive flows emit strict machine-readable logs yet.
- Source inference works for both Marketplace and OpenVSX URLs; `--source` can override.

## Extensibility Guidelines

- Add new user-facing commands under `src/commands/`, then build feature logic in `src/features/<feature>/services` reusing `core/` modules
- For new configuration flags, update:
  - `src/config/schema.ts` (Zod schema and defaults)
  - `src/config/loader.ts` (`convertCliToConfig`, env var map if needed)
  - Command option declarations in `src/index.ts`
- For new validations, add/extend JSON Schemas in `src/core/validation/schemas.ts`
- For new error cases, add factories to `src/core/errors/definitions.ts`

## Coding Standards

- Strongly typed public APIs; avoid `any`
- Single-responsibility functions, descriptive naming, early returns
- Separate pure logic from side effects; extract helpers for complex conditionals
- Match existing formatting and structure; keep functions small and readable

## Future Improvements

- Implement true parallelism for bulk downloads with bounded concurrency and fair progress reporting
- Expand JSON output surfaces for better automation and CI usage
- Add unit/integration tests for registry parsing, version resolution, and validators
- Pluggable source registries via an abstraction layer
- Compression for backup storage to reduce disk usage
- Cloud backup sync options for distributed teams
- Automatic rollback on install failure detection
- Extension dependency resolution and management
