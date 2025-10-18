# Standardized Output System

Consistent API responses and output formatting across all commands.

## Features

- **Standardized Result Structure**: All commands return consistent format
- **Multiple Output Formats**: Human-readable, JSON, compact JSON
- **Rich Error Information**: Structured errors with suggestions
- **Automatic Totals**: Success/fail/skip counts automatically calculated
- **Builder Pattern**: Easy construction of complex results

## Result Structure

```typescript
{
  "status": "ok" | "error" | "partial",
  "command": "add",
  "summary": "Successfully installed 3 extensions",
  "items": [
    {
      "id": "ms-python.python",
      "name": "Python",
      "version": "2024.0.0",
      "status": "success",
      "duration": 5234,
      "message": "Installed successfully"
    }
  ],
  "errors": [
    {
      "code": "INSTALL_FAILED",
      "message": "Failed to install extension",
      "context": "ms-python.python",
      "suggestion": "Try running with --force flag"
    }
  ],
  "warnings": [
    {
      "code": "COMPATIBILITY_WARNING",
      "message": "Extension may not be compatible",
      "context": "ms-python.python"
    }
  ],
  "totals": {
    "total": 5,
    "successful": 3,
    "failed": 1,
    "skipped": 1,
    "warnings": 2,
    "duration": 12450
  },
  "metadata": {
    "editor": "cursor",
    "retries": 2
  },
  "timestamp": "2024-12-19T10:30:00.000Z",
  "duration": 12450
}
```

## Usage

### Basic Usage with Builder

```typescript
import { CommandResultBuilder } from "./core/output";

const builder = new CommandResultBuilder("add");

// Add successful items
builder.addSuccess({
  id: "ms-python.python",
  name: "Python",
  version: "2024.0.0",
  duration: 5234,
  message: "Installed successfully",
});

// Add failures
builder.addFailure({
  id: "ms-vscode.cpptools",
  name: "C/C++",
  message: "Installation timeout",
});

// Add errors with suggestions
builder.addError({
  code: "TIMEOUT",
  message: "Installation timed out after 30s",
  context: "ms-vscode.cpptools",
  suggestion: "Try increasing timeout with --timeout flag",
});

// Set metadata
builder.setMetadata({
  editor: "cursor",
  retries: 2,
});

// Build final result
const result = builder.build();
// Auto-generates: status, summary, totals, duration
```

### Error Handling

```typescript
try {
  // Command logic
} catch (error) {
  // Convert error to standardized result
  const result = CommandResultBuilder.fromError("add", error);
  return result;
}
```

### Output Formatting

```typescript
import { outputFormatter } from "./core/output";

// Human-readable output (default)
const output = outputFormatter.format(result, { format: "human" });
console.log(output.content);
process.exit(output.exitCode);

// JSON output (for --json flag)
const jsonOutput = outputFormatter.format(result, {
  format: "json-pretty",
  includeStack: true,
});
console.log(jsonOutput.content);

// Compact JSON (for CI/scripts)
const compactOutput = outputFormatter.format(result, { format: "json" });
```

### In Commands

```typescript
// src/commands/add/index.ts
export class AddCommand extends BaseCommand {
  async execute(args: string[], options: AddOptions): Promise<CommandResult> {
    const builder = new CommandResultBuilder("add");

    try {
      for (const input of inputs) {
        const startTime = Date.now();

        try {
          const extension = await this.processInput(input);

          builder.addSuccess({
            id: extension.id,
            name: extension.name,
            version: extension.version,
            duration: Date.now() - startTime,
          });
        } catch (error) {
          builder.addFailure({
            id: input,
            message: error.message,
            duration: Date.now() - startTime,
          });

          builder.addError({
            code: error.code || "UNKNOWN_ERROR",
            message: error.message,
            context: input,
            suggestion: this.getSuggestion(error),
          });
        }
      }

      return builder
        .setMetadata({ editor: options.editor })
        .setSummary(`Processed ${inputs.length} extensions`)
        .build();
    } catch (error) {
      return CommandResultBuilder.fromError("add", error);
    }
  }
}
```

### With Retry System

```typescript
import { smartRetryService } from "./core/retry";
import { CommandResultBuilder } from "./core/output";

const builder = new CommandResultBuilder("add");

for (const extension of extensions) {
  const retryResult = await smartRetryService.executeWithRetry({
    name: `Install ${extension.name}`,
    run: async () => installService.install(extension),
  });

  if (retryResult.success) {
    builder.addSuccess({
      id: extension.id,
      name: extension.name,
      duration: retryResult.duration,
      details: {
        strategy: retryResult.strategy,
        attempts: retryResult.attempts,
      },
    });
  } else {
    builder.addFailure({
      id: extension.id,
      name: extension.name,
      message: retryResult.error?.message,
    });

    builder.addError({
      code: "INSTALL_FAILED",
      message: retryResult.error?.message || "Unknown error",
      context: extension.id,
    });
  }
}

return builder.build();
```

## Output Modes

### Human Mode (Default)

```
✓ Successfully installed 3 extensions

3 successful, 1 failed (12.5s)

Items:
  ✓ Python v2024.0.0
  ✓ ESLint v2.4.0
  ✓ Prettier v10.1.0
  ✗ C/C++ - Installation timeout

Errors:
  ✗ Installation timed out after 30s
    Context: ms-vscode.cpptools
    Suggestion: Try increasing timeout with --timeout flag
```

### JSON Mode (--json)

```json
{
  "status": "partial",
  "command": "add",
  "summary": "Completed with 3 success, 1 failed",
  "items": [
    {
      "id": "ms-python.python",
      "name": "Python",
      "version": "2024.0.0",
      "status": "success",
      "duration": 5234
    }
  ],
  "totals": {
    "total": 4,
    "successful": 3,
    "failed": 1,
    "skipped": 0,
    "warnings": 0,
    "duration": 12450
  }
}
```

### Quiet Mode (--quiet)

```
✓ Successfully installed 3 extensions
```

## CLI Integration

```typescript
// In main CLI handler
const result = await command.execute(args, options);

// Format based on --json flag
const output = outputFormatter.format(result, {
  format: options.json ? "json-pretty" : "human",
  quiet: options.quiet,
  includeStack: options.debug,
});

console.log(output.content);
process.exit(output.exitCode);
```

## Testing

```typescript
import { CommandResultBuilder, outputFormatter } from "../core/output";

describe("CommandResultBuilder", () => {
  it("calculates correct status", () => {
    const result = new CommandResultBuilder("test")
      .addSuccess({ id: "1" })
      .addFailure({ id: "2" })
      .build();

    expect(result.status).toBe("partial");
    expect(result.totals?.successful).toBe(1);
    expect(result.totals?.failed).toBe(1);
  });

  it("generates summary automatically", () => {
    const result = new CommandResultBuilder("test")
      .addSuccess({ id: "1" })
      .addSuccess({ id: "2" })
      .build();

    expect(result.summary).toContain("Successfully completed 2");
  });
});

describe("OutputFormatter", () => {
  it("formats JSON correctly", () => {
    const result = { status: "ok", command: "test", summary: "Done" };
    const output = outputFormatter.format(result, { format: "json" });

    expect(() => JSON.parse(output.content)).not.toThrow();
    expect(output.exitCode).toBe(0);
  });
});
```

## Migration from Old Commands

### Before (Inconsistent)

```typescript
// Different return types across commands
return {
  success: true,
  data: results,
};

return {
  successCount: 3,
  failedCount: 1,
  results: [],
};

return { installed: extensions };
```

### After (Consistent)

```typescript
// All commands use CommandResultBuilder
return new CommandResultBuilder("command-name").addSuccess({ id: "..." }).build();

// Consistent structure, automatic totals, proper error handling
```

## Benefits

1. **Consistency**: All commands return the same structure
2. **Machine-Readable**: CI/CD systems can easily parse --json output
3. **Rich Information**: Detailed errors with suggestions
4. **Automatic Calculations**: Totals, duration, status computed automatically
5. **Flexible Formatting**: Multiple output modes for different use cases
6. **Type Safety**: Full TypeScript support with proper types
7. **Builder Pattern**: Easy to construct complex results incrementally
