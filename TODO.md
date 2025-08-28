# VSIX Downloader - Implementation TODO

## Completed Features ✅

- [x] **Non-interactive bulk mode flags and CLI wiring** (`todo-bulk-flags-cli`)
  - Added `--file`, `--parallel`, `--retry`, `--retry-delay`, `--skip-existing`, `--overwrite`, `--quiet`, `--json`, `--summary`, `--pre-release`, `--source` flags
  - Integrated with Commander.js CLI structure

- [x] **Concurrent bulk downloads with retry/backoff and summary JSON** (`todo-bulk-concurrency-retry`)
  - Implemented worker pool for parallel downloads
  - Added exponential backoff retry mechanism
  - Added detailed results aggregation and JSON summary output

- [x] **Version resolution: support "latest"/pre-release and list versions command** (`todo-version-resolution`)
  - Added `resolveVersion` function for marketplace API integration
  - Added `--pre-release` flag for pre-release version support
  - Created `versions` command to list available versions
  - Added `fetchExtensionVersions` and `fetchOpenVsxVersions` functions

- [x] **OpenVSX source support with --source flag and fallback** (`todo-openvsx-source`)
  - Added `--source` flag for marketplace/open-vsx selection
  - Implemented `inferSourceFromUrl` for automatic source detection
  - Added OpenVSX URL parsing and download URL construction
  - Updated bulk downloader to support mixed sources
  - Added interactive source selection with URL-based defaults

- [x] **README updates for new features** (`todo-readme-commit`, `todo-readme-version-docs`, `todo-readme-openvsx`)
  - Updated documentation for all new flags and features
  - Added OpenVSX support examples
  - Updated JSON template and URL patterns documentation

## Pending Features 🔄

### High Priority

- [ ] **Filename template, cache-dir, and skip/overwrite behavior** (`todo-filename-cache`)
  - Add `--filename-template` option for custom naming patterns
  - Add `--cache-dir` for local caching of downloaded files
  - Implement `--skip-existing` and `--overwrite` behavior
  - Add file existence checks before download

- [ ] **Progress indicators and optional checksum output** (`todo-progress-checksum`)
  - Add download progress bars with file size and speed
  - Add `--checksum` flag for SHA256 hash generation
  - Add `--verify-checksum` for integrity verification
  - Implement progress callbacks for real-time updates

### Medium Priority

- [ ] **Export installed and from-list commands** (`todo-export-from-list`)
  - Add `export-installed` command to list currently installed extensions
  - Add `from-list` command to download from simple text file
  - Support VS Code's extensions.json format
  - Add `--format` flag for different output formats

- [ ] **Enhanced bulk-download-example.json schema and docs** (`todo-docs-schema`)
  - Add schema validation with JSON Schema
  - Add more examples for different use cases
  - Add documentation for advanced features
  - Create schema documentation

### Low Priority

- [ ] **Husky hooks and commitlint integration** (`todo-husky-commitlint`)
  - Set up pre-commit hooks for linting and formatting
  - Configure commitlint for conventional commits
  - Add pre-push hooks for testing
  - Set up commit message templates

- [ ] **CI improvements: Node matrix, typecheck, audit, changelog** (`todo-ci-improvements`)
  - Add Node.js version matrix testing
  - Add TypeScript type checking in CI
  - Add npm audit for security checks
  - Add automated changelog generation
  - Add release automation

- [ ] **Refactor into extensionRegistry service and add unit tests** (`todo-refactor-tests`)
  - Extract extension registry logic into separate service
  - Add comprehensive unit tests for all utilities
  - Add integration tests for CLI commands
  - Add test coverage reporting
  - Mock external API calls for testing

## Technical Debt & Improvements

- [ ] **Error handling improvements**
  - Add more specific error types
  - Improve error messages with actionable suggestions
  - Add error recovery strategies
  - Add error reporting for debugging

- [ ] **Performance optimizations**
  - Add connection pooling for HTTP requests
  - Implement proper caching strategies
  - Add download resume capability for large files
  - Optimize memory usage for bulk operations

- [ ] **User experience enhancements**
  - Add colored output for better readability
  - Add keyboard shortcuts for interactive mode
  - Add configuration file support
  - Add shell completion scripts

- [ ] **Documentation improvements**
  - Add API documentation
  - Add troubleshooting guide
  - Add migration guide for breaking changes
  - Add contribution guidelines

## Future Considerations

- [ ] **Additional extension sources**
  - Support for GitHub releases
  - Support for custom extension repositories
  - Support for local extension files

- [ ] **Advanced features**
  - Extension dependency resolution
  - Extension compatibility checking
  - Extension metadata extraction
  - Extension installation automation

---

**Last Updated:** Current session
**Next Priority:** Filename template and cache directory features
