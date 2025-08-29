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
│  ├─ exportInstalled.ts       # Export installed extensions from editors
│  ├─ fromList.ts              # Download from list formats (txt/json/extensions.json)
│  └─ versions.ts              # List versions for an extension
├─ config/                     # Configuration system
│  ├─ constants.ts             # Re-exports and defaults for legacy consumers
│  ├─ loader.ts                # CLI > ENV > FILE > DEFAULTS resolution
│  └─ schema.ts                # Zod schema, types, env var mapping
├─ core/                       # Foundational modules
│  ├─ errors/                  # Typed errors, formatting, enhancement
│  ├─ filesystem/              # File I/O, naming templates, checksums
│  ├─ http/                    # HTTP downloader with progress tracking
│  ├─ registry/                # Marketplace/OpenVSX parsing and versions
│  ├─ ui/                      # Progress utilities and formatting helpers
│  ├─ validation/              # AJV schemas and validator service
│  ├─ helpers.ts               # Shared helpers
│  └─ types.ts                 # Shared types
└─ features/                   # Use-case orchestration
   ├─ download/                # Single and bulk download services
   ├─ export/                  # Export installed extensions
   └─ import/                  # Parse extension lists and hand off to download
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
- Bulk currently executes sequentially; the `parallel` option is reserved but not yet implemented

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

## Foundational Modules

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

- Bulk downloads run sequentially today. The `--parallel` option is accepted but currently ignored. Future work will implement controlled concurrency.
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
