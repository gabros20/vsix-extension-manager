# Update Notification System

Non-intrusive update checking with configurable frequency.

## Features

- **Background Checking**: Passive update detection without blocking workflow
- **Configurable Frequency**: Never, daily, weekly, or always check
- **Smart Caching**: Respects check intervals to avoid excessive API calls
- **Non-Intrusive**: Minimal, informative notifications
- **Integration Ready**: Works with configuration system

## Components

### UpdateChecker

Handles update checking and caching logic.

```typescript
import { updateChecker } from "./core/updates";

// Check for updates
const result = await updateChecker.checkForUpdates("weekly", {
  force: false,
  editor: "cursor",
  quiet: false,
});

// Result structure
{
  updates: UpdateInfo[],
  lastCheck: number,
  nextCheck: number,
  duration: number
}
```

### NotificationService

Displays update notifications in a non-intrusive way.

```typescript
import { notificationService } from "./core/updates";

// Show update notification (non-blocking)
notificationService.showUpdateNotification(result);

// Show minimal hint
notificationService.showUpdateHint(updateCount);

// Show detailed list
notificationService.showDetailedUpdates(updates);
```

## Usage

### Basic Update Check

```typescript
import { updateChecker, notificationService } from "./core/updates";

async function checkUpdates() {
  const result = await updateChecker.checkForUpdates("weekly");

  if (result.updates.length > 0) {
    notificationService.showUpdateNotification(result);
  }
}
```

### With Configuration

```typescript
import { configLoaderV2 } from "./config";
import { updateChecker, notificationService } from "./core/updates";

async function checkUpdatesWithConfig() {
  const config = await configLoaderV2.loadConfig();
  const frequency = config.behavior.updateCheck || "weekly";

  if (frequency === "never") {
    return; // Skip check
  }

  const result = await updateChecker.checkForUpdates(frequency, {
    quiet: config.behavior.quiet,
  });

  notificationService.showUpdateNotification(result, config.behavior.quiet);
}
```

### Command Integration

```typescript
// In main CLI entry point
async function main() {
  const config = await configLoaderV2.loadConfig();

  // Check for updates in background (non-blocking)
  if (config.behavior.updateCheck !== "never") {
    updateChecker
      .checkForUpdates(config.behavior.updateCheck, {
        quiet: config.quiet,
      })
      .then((result) => {
        notificationService.showUpdateHint(result.updates.length, config.quiet);
      })
      .catch(() => {
        // Silently fail - don't interrupt user
      });
  }

  // Continue with command execution
  await executeCommand();
}
```

### Force Update Check

```typescript
// For explicit update check command
const result = await updateChecker.checkForUpdates("always", {
  force: true,
  quiet: false,
});

notificationService.showDetailedUpdates(result.updates);
```

## Configuration

Update checking is configured in the v2 configuration system:

```yaml
# config.yml
behavior:
  update-check: weekly # never, daily, weekly, always
  quiet: false
```

## Notification Examples

### Minimal Hint (Passive)

```
💡 3 updates available (run 'vsix update')
```

### Standard Notification

```
💡 3 extension updates available
   ms-python.python: 2024.0.0 → 2024.2.0
   dbaeumer.vscode-eslint: 2.4.0 → 2.4.2
   esbenp.prettier-vscode: 10.1.0 → 10.2.0
   Run 'vsix update' to install updates
```

### Detailed List

```
Available Updates:

● ms-python.python
  2024.0.0 → 2024.2.0

● dbaeumer.vscode-eslint
  2.4.0 → 2.4.2

● esbenp.prettier-vscode
  10.1.0 → 10.2.0
```

## Cache Management

Cache is stored at `~/.vsix/update-cache.json`:

```json
{
  "lastCheck": 1703001234567,
  "updates": [
    {
      "extensionId": "ms-python.python",
      "currentVersion": "2024.0.0",
      "latestVersion": "2024.2.0",
      "updateAvailable": true,
      "source": "marketplace"
    }
  ],
  "frequency": "weekly"
}
```

Clear cache:

```typescript
await updateChecker.clearCache();
```

## Check Frequencies

- **never**: Disabled (default for CI/CD)
- **daily**: Check once per 24 hours
- **weekly**: Check once per 7 days (recommended default)
- **always**: Check every time (use with `--force`)

## API Reference

### UpdateChecker

```typescript
class UpdateChecker {
  // Check for updates with caching
  checkForUpdates(
    frequency: CheckFrequency,
    options?: UpdateCheckerOptions,
  ): Promise<UpdateCheckResult>;

  // Get last check timestamp
  getLastCheckTime(): Promise<number>;

  // Format timestamp for display
  formatLastCheck(timestamp: number): string;

  // Clear cache
  clearCache(): Promise<void>;
}
```

### NotificationService

```typescript
class NotificationService {
  // Show full notification with extension list
  showUpdateNotification(result: UpdateCheckResult, quiet?: boolean): void;

  // Show minimal one-line hint
  showUpdateHint(count: number, quiet?: boolean): void;

  // Show detailed update list
  showDetailedUpdates(updates: UpdateInfo[]): void;

  // Show check summary
  showCheckSummary(result: UpdateCheckResult, frequency: CheckFrequency): void;

  // Show check error (non-intrusive)
  showCheckError(error: Error, quiet?: boolean): void;
}
```

## Integration Examples

### In Commands

```typescript
export class AddCommand extends BaseCommand {
  async execute(args: string[], options: AddOptions): Promise<CommandResult> {
    // Show passive update hint at start (non-blocking)
    if (!options.quiet) {
      const lastCheck = await updateChecker.getLastCheckTime();
      if (lastCheck > 0) {
        const cached = await updateChecker.checkForUpdates("weekly");
        if (cached.updates.length > 0) {
          notificationService.showUpdateHint(cached.updates.length);
        }
      }
    }

    // Command logic
    return await this.addExtensions(args, options);
  }
}
```

### Update Command

```typescript
export class UpdateCommand extends BaseCommand {
  async execute(args: string[], options: UpdateOptions): Promise<CommandResult> {
    // Force fresh check for update command
    const result = await updateChecker.checkForUpdates("always", {
      force: true,
      quiet: options.quiet,
    });

    notificationService.showDetailedUpdates(result.updates);

    // Proceed with updates
    return await this.updateExtensions(result.updates, options);
  }
}
```

## Testing

```typescript
describe("UpdateChecker", () => {
  it("respects check frequency", async () => {
    // First check
    const result1 = await updateChecker.checkForUpdates("weekly");
    expect(result1.updates).toBeDefined();

    // Second check (should use cache)
    const result2 = await updateChecker.checkForUpdates("weekly");
    expect(result2.duration).toBe(0); // Cached
  });

  it("forces fresh check", async () => {
    const result = await updateChecker.checkForUpdates("weekly", {
      force: true,
    });
    expect(result.duration).toBeGreaterThan(0); // Fresh check
  });
});
```

## Non-Intrusive Design Principles

1. **Never block**: Update checks run in background
2. **Fail silently**: Network errors don't interrupt workflow
3. **Respect settings**: Honor user's frequency preference
4. **Minimal output**: One-line hints in quiet contexts
5. **Smart caching**: Avoid excessive API calls
6. **Configurable**: Users can disable completely

## Benefits

- **User-Friendly**: Non-intrusive notifications
- **Performance**: Smart caching reduces API calls
- **Flexible**: Multiple notification styles
- **Reliable**: Graceful error handling
- **Configurable**: User controls frequency
- **Privacy**: No telemetry, only version checks
