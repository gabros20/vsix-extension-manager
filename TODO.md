# VSIX Manager CLI - Refactor & Roadmap

## Completed in this refactor ✅

- [x] Centralize constants and defaults in `src/config/constants.ts`
- [x] Create shared types in `src/core/types.ts`
- [x] Extract helpers: `truncateText`, `buildBulkOptionsFromCli`, `shouldUpdateProgress`
- [x] Standardize HTTP headers/timeouts via constants
- [x] Remove duplicate helpers and unify output-dir handling defaults
- [x] Refactor commands to use shared builders/types without changing behavior
- [x] Build passes with no type or lint errors

## High-priority next steps 🔜

- [x] Add configuration support (file + env): defaults, cache dir, concurrency, checksum
- [x] Improve error taxonomy and messages (typed errors, actionable suggestions)
- [x] Add JSON Schema validation for bulk files and list formats

## Medium-term improvements 🧭

- [ ] Logging abstraction (quiet/json modes, levels) and structured events
- [ ] HTTP client wrapper (retries, backoff, timeouts, UA) with tests
- [ ] Caching strategy + checksum index for quick verification
- [ ] Download resume support for large files
- [ ] Shell completion and command help polish

## Testing & quality 📦

- [ ] Unit tests for helpers, URL parser, registry, filename template
- [ ] Integration tests for commands (download, from-list, export, versions)
- [ ] Mock external APIs for deterministic CI

## Future features 🚀

- [ ] Additional sources (GitHub Releases, custom registries, local files)
- [ ] Dependency resolution and compatibility checks
- [ ] Extension metadata and simple install automation hooks

---

**Major Update - High-Priority Features Completed:**

**Configuration System:**

- Multi-layer config loading (CLI > ENV > FILE > DEFAULTS) with Zod validation
- Support for `.vsixrc`, `vsix.config.json/yaml` files
- Environment variables (`VSIX_*` prefix) with automatic type conversion
- Global `--config` option for custom config file paths

**Typed Error System:**

- Categorized errors (Network, FileSystem, Validation, Parsing, Registry, etc.)
- Structured error codes and actionable suggestions for recovery
- Rich error formatting with icons, colors, and detailed context
- Enhanced error handling throughout the CLI with specific error types

**JSON Schema Validation:**

- Comprehensive schemas for bulk files, extension lists, and configuration
- Format validation for extension IDs, URLs, versions, and checksums
- Detailed path-specific validation errors with helpful suggestions
- Support for multiple formats (VS Code extensions.json, arrays, objects)

**CLI Integration:**

- All commands now use configuration system automatically
- Improved error messages and user experience
- Better validation and error recovery throughout the application

Last updated: Enhanced foundation with configuration, error handling, and validation systems.
