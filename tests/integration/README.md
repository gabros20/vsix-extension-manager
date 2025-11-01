# Integration Tests

Comprehensive integration tests for v2.0 refactor.

## Test Categories

### 1. Configuration System Tests
- Configuration loading with precedence
- Profile merging and activation
- V1 to V2 migration
- YAML/JSON format support
- Environment variable mapping

### 2. Command Workflow Tests
- Add command with different input types
- Remove command with backup
- Update command with rollback
- List command with multiple formats
- Info command with version details
- Doctor command health checks
- Setup wizard workflows

### 3. Retry System Tests
- Strategy selection and execution
- Error recovery scenarios
- Batch operations with shared context
- User intervention handling
- Strategy priority ordering

### 4. Output System Tests
- CommandResultBuilder usage
- Status calculation (ok, error, partial)
- Totals computation
- Output formatting (human, JSON, compact)
- Error and warning handling

### 5. Update System Tests
- Update checking with caching
- Frequency respect (daily, weekly)
- Notification display
- Cache management

### 6. End-to-End Workflows
- First-run setup → add extensions → list
- Update check → update extensions
- Error scenarios → recovery
- Configuration profiles → command execution

## Running Tests

```bash
# All tests
npm test

# Integration tests only
npm test -- tests/integration

# Specific test file
npm test -- tests/integration/config.test.ts

# Watch mode
npm test -- --watch
```

## Test Structure

```
tests/
├── integration/
│   ├── config.test.ts          # Configuration system
│   ├── commands.test.ts        # Command workflows
│   ├── retry.test.ts           # Retry system
│   ├── output.test.ts          # Output formatting
│   ├── updates.test.ts         # Update checker
│   └── workflows.test.ts       # End-to-end flows
├── fixtures/
│   ├── configs/                # Test configurations
│   ├── extensions/             # Test extension data
│   └── vsix/                   # Test VSIX files
└── helpers/
    ├── mockRegistry.ts         # Mock marketplace API
    ├── mockEditor.ts           # Mock editor CLI
    └── testUtils.ts            # Test utilities
```

## Test Helpers

### Mock Registry

```typescript
import { mockRegistry } from "../helpers/mockRegistry";

// Setup mock responses
mockRegistry.mockExtension("ms-python.python", {
  version: "2024.0.0",
  displayName: "Python",
});

// Make requests
const version = await resolveVersion("ms-python.python", "latest");
expect(version).toBe("2024.0.0");
```

### Mock Editor

```typescript
import { mockEditor } from "../helpers/mockEditor";

// Setup mock editor
mockEditor.setup({
  name: "cursor",
  available: true,
  extensions: ["ms-python.python"],
});

// Test commands
const result = await installService.install("cursor", "extension.vsix");
expect(result.success).toBe(true);
```

## Test Fixtures

### Configuration Fixtures

```typescript
// tests/fixtures/configs/basic.yml
editor:
  prefer: cursor

behavior:
  update-check: weekly
```

### Extension Fixtures

```typescript
// tests/fixtures/extensions/python.json
{
  "id": "ms-python.python",
  "version": "2024.0.0",
  "displayName": "Python"
}
```

## Coverage Goals

- **Unit Coverage**: 80%+ (individual functions)
- **Integration Coverage**: 70%+ (workflows)
- **Critical Paths**: 100% (add, install, update)

## CI/CD Integration

Tests run automatically on:
- Pull requests
- Commits to feat/v2.0-refactor
- Before releases

## Writing New Tests

1. Create test file in appropriate category
2. Use descriptive test names
3. Setup/teardown properly
4. Mock external dependencies
5. Test both success and error cases
6. Verify output/side effects

Example:

```typescript
describe("Add Command", () => {
  beforeEach(async () => {
    await setupTestEnvironment();
  });

  afterEach(async () => {
    await cleanupTestEnvironment();
  });

  it("should add extension from URL", async () => {
    const result = await addCommand.execute(
      ["https://marketplace.visualstudio.com/.../python"],
      { editor: "cursor" }
    );

    expect(result.status).toBe("ok");
    expect(result.totals?.successful).toBe(1);
  });

  it("should handle network errors with retry", async () => {
    mockRegistry.simulateNetworkError();

    const result = await addCommand.execute(
      ["ms-python.python"],
      { editor: "cursor" }
    );

    // Should retry and eventually succeed
    expect(result.status).toBe("ok");
    expect(result.metadata?.retries).toBeGreaterThan(0);
  });
});
```
