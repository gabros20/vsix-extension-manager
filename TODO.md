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

- [ ] Introduce feature-oriented modules under `src/features/`
  - `features/download` (single + bulk)
  - `features/export` (installed + workspace)
  - `features/versions`
  - Re-export public APIs via `src/index.ts`
- [ ] Add configuration support (file + env): defaults, cache dir, concurrency, checksum
- [ ] Improve error taxonomy and messages (typed errors, actionable suggestions)
- [ ] Add JSON Schema validation for bulk files and list formats

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

Last updated: Core refactor to solidify foundation for an extensible VSIX manager CLI.
