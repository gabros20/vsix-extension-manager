# Smart Retry System

Intelligent retry system with escalating strategies for handling transient failures.

## Features

- **Multiple Retry Strategies**: Network errors, timeouts, installation failures
- **Automatic Escalation**: Tries different approaches when one fails
- **User Intervention**: Prompts user when automatic recovery fails
- **Configurable**: Customize max attempts, timeout, backoff multiplier

## Usage

### Basic Usage

```typescript
import { smartRetryService } from "./core/retry";

// Simple task with automatic retry
const result = await smartRetryService.executeWithRetry({
  name: "Download Extension",
  run: async (context) => {
    return await downloadService.download(url, {
      timeout: context.timeout,
    });
  },
});

if (result.success) {
  console.log(`Success after ${result.attempts} attempts`);
  console.log(`Duration: ${result.duration}ms`);
} else {
  console.error(`Failed: ${result.error?.message}`);
}
```

### Custom Options

```typescript
const result = await smartRetryService.executeWithRetry(
  {
    name: "Install Extension",
    run: async (context) => {
      if (context.metadata?.downloadOnly) {
        // Download-only fallback
        return await downloadService.download(extension);
      }
      // Normal install
      return await installService.install(extension);
    },
    metadata: {
      supportsDownloadOnly: true,
    },
  },
  {
    maxAttempts: 5,
    timeout: 30000,
    metadata: {
      quiet: false,
    },
  },
);
```

### Batch Operations

```typescript
const tasks = extensions.map((ext) => ({
  name: `Install ${ext.name}`,
  run: async (context) => installService.install(ext),
}));

const results = await smartRetryService.executeBatch(tasks, {
  maxAttempts: 3,
});

const successful = results.filter((r) => r.success);
console.log(`Installed ${successful.length}/${results.length} extensions`);
```

## Strategies

The retry system includes 5 built-in strategies (in order of priority):

### 1. NetworkRetryStrategy (Priority: 5)

- **Handles**: Network errors (ECONNREFUSED, ETIMEDOUT, ENOTFOUND, fetch failed)
- **Action**: Exponential backoff retry (1s, 2s, 4s, 8s...)
- **Max Attempts**: 5

### 2. TimeoutIncreaseStrategy (Priority: 10)

- **Handles**: Timeout errors
- **Action**: Doubles timeout on each retry
- **Max Attempts**: 3

### 3. DirectInstallStrategy (Priority: 20)

- **Handles**: Installation failures via CLI
- **Action**: Falls back to direct installation (bypassing CLI)
- **Max Attempts**: 2

### 4. DownloadOnlyStrategy (Priority: 30)

- **Handles**: Installation failures after multiple attempts
- **Action**: Downloads without installing (requires manual install)
- **Max Attempts**: Unlimited (fallback strategy)

### 5. UserInterventionStrategy (Priority: 100)

- **Handles**: All failures after 2+ attempts (in interactive mode)
- **Action**: Prompts user for action (Retry / Skip / Abort)
- **Max Attempts**: Unlimited (last resort)

## Custom Strategies

```typescript
import { BaseRetryStrategy } from "./core/retry";

class CustomStrategy extends BaseRetryStrategy {
  name = "custom-strategy";
  priority = 15; // Between timeout and direct install

  canHandle(error: Error, context: RetryContext): boolean {
    return error.message.includes("CUSTOM_ERROR");
  }

  async attempt<T>(task: Task<T>, context: RetryContext): Promise<T> {
    // Custom recovery logic
    await this.delay(5000);
    return await task.run({
      ...context,
      metadata: { ...context.metadata, customFlag: true },
    });
  }

  getDescription(error: Error, context: RetryContext): string {
    return "Applying custom recovery strategy";
  }
}

// Use custom strategy
const retryService = new SmartRetryService([
  new NetworkRetryStrategy(),
  new CustomStrategy(),
  new UserInterventionStrategy(),
]);
```

## Integration Examples

### In Commands

```typescript
// src/commands/add/executor.ts
import { smartRetryService } from "../../core/retry";

export class AddExecutor {
  async executeWithRetry(plan: InstallPlan, options: AddOptions) {
    return await smartRetryService.executeWithRetry(
      {
        name: `Add ${plan.extension.name}`,
        run: async (context) => {
          if (context.metadata?.downloadOnly) {
            return await this.downloadOnly(plan, options);
          }
          if (context.metadata?.strategy === "direct") {
            return await this.installDirect(plan, options);
          }
          return await this.installNormal(plan, options, context.timeout);
        },
        metadata: {
          supportsDownloadOnly: true,
        },
      },
      {
        maxAttempts: options.retry || 3,
        timeout: options.timeout,
        metadata: {
          quiet: options.quiet,
        },
      },
    );
  }
}
```

### With Configuration

```typescript
// Respect user's retry configuration
const config = await configLoaderV2.loadConfig();

const result = await smartRetryService.executeWithRetry(task, {
  maxAttempts: config.behavior.autoRetry ? 3 : 1,
  metadata: {
    quiet: config.behavior.quiet,
  },
});
```

## Error Handling

```typescript
try {
  const result = await smartRetryService.executeWithRetry(task);

  if (!result.success) {
    if (result.error?.message === "SKIP_REQUESTED") {
      console.log("User skipped this operation");
    } else if (result.error?.message === "USER_ABORTED") {
      console.log("User aborted all operations");
      process.exit(1);
    } else {
      console.error(`Failed after ${result.attempts} attempts`);
    }
  }
} catch (error) {
  if (error.message === "USER_ABORTED") {
    process.exit(1);
  }
  throw error;
}
```

## Testing

```typescript
// tests/retry.test.ts
import { SmartRetryService, NetworkRetryStrategy } from "../core/retry";

describe("SmartRetryService", () => {
  it("retries on network errors", async () => {
    let attempts = 0;

    const result = await smartRetryService.executeWithRetry({
      name: "test",
      run: async () => {
        attempts++;
        if (attempts < 3) throw new Error("ECONNREFUSED");
        return "success";
      },
    });

    expect(result.success).toBe(true);
    expect(result.attempts).toBe(3);
    expect(result.strategy).toBe("network-retry");
  });
});
```
