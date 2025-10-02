# Phase 2 Integration Plan

**Goal:** Integrate Phase 2 features into existing v2.0 commands  
**Duration:** 2-3 weeks  
**Status:** In Progress

## Overview

Phase 2 systems are complete and tested. Now we integrate them into the command layer for real-world usage.

## Integration Tasks

### Task 1: Retry System Integration (Priority: High)

**Commands to Update:**
- ✅ Add command (download + install operations)
- ✅ Update command (download + install operations)
- ✅ Remove command (for operation retries)

**Integration Points:**
```typescript
// In add command executor
import { smartRetryService } from "../../core/retry";

const result = await smartRetryService.executeWithRetry({
  name: `Install ${extension.name}`,
  run: async (context) => {
    if (context.metadata?.downloadOnly) {
      return await downloadService.download(extension);
    }
    return await installService.install(extension, {
      timeout: context.timeout
    });
  },
  metadata: { supportsDownloadOnly: true }
}, {
  maxAttempts: options.retry || 3,
  timeout: options.timeout
});
```

**Files to Modify:**
- `src/commands/add/executor.ts` - Add retry to download/install
- `src/commands/update.ts` - Add retry to update operations
- `src/commands/remove.ts` - Add retry to uninstall operations

**Testing:**
- Network error scenarios
- Timeout scenarios
- Installation failures
- Batch operations

### Task 2: Output System Integration (Priority: High)

**Commands to Migrate:**
- ✅ Add command
- ✅ Remove command
- ✅ Update command
- ✅ List command
- ✅ Info command
- ✅ Doctor command
- ✅ Setup command

**Integration Pattern:**
```typescript
import { CommandResultBuilder } from "../../core/output";

export class AddCommand extends BaseCommand {
  async execute(args: string[], options: AddOptions): Promise<CommandResult> {
    const builder = new CommandResultBuilder("add");
    
    try {
      for (const input of inputs) {
        try {
          const extension = await this.processInput(input);
          builder.addSuccess({
            id: extension.id,
            name: extension.name,
            version: extension.version
          });
        } catch (error) {
          builder.addFailure({
            id: input,
            message: error.message
          });
          builder.addError({
            code: error.code || "UNKNOWN",
            message: error.message,
            suggestion: this.getSuggestion(error)
          });
        }
      }
      
      return builder.build();
    } catch (error) {
      return CommandResultBuilder.fromError("add", error);
    }
  }
}
```

**Files to Modify:**
- `src/commands/add/index.ts` - Return CommandResult
- `src/commands/remove.ts` - Return CommandResult
- `src/commands/update.ts` - Return CommandResult
- `src/commands/list.ts` - Return CommandResult
- `src/commands/info.ts` - Return CommandResult
- `src/commands/doctor/index.ts` - Return CommandResult
- `src/commands/setup.ts` - Return CommandResult

**Main CLI Integration:**
```typescript
// src/index.ts
import { outputFormatter } from "./core/output";

const result = await command.execute(args, options);

const output = outputFormatter.format(result, {
  format: options.json ? "json-pretty" : "human",
  quiet: options.quiet,
  includeStack: options.debug
});

console.log(output.content);
process.exit(output.exitCode);
```

### Task 3: Configuration v2 Integration (Priority: Medium)

**Integration Points:**
- Main CLI startup
- All command option parsing
- Setup wizard

**Implementation:**
```typescript
// src/index.ts - Load config v2 at startup
import { configLoaderV2 } from "./config/loaderV2";

async function main() {
  // Load configuration with precedence
  const config = await configLoaderV2.loadConfig(cliOptions);
  
  // Merge with CLI options
  const mergedOptions = {
    ...config,
    ...cliOptions // CLI overrides config
  };
  
  // Execute command with merged options
  await executeCommand(mergedOptions);
}
```

**Files to Modify:**
- `src/index.ts` - Load config v2 at startup
- `src/commands/base/BaseCommand.ts` - Accept config in context
- All command files - Use config values as defaults

**Migration Support:**
```typescript
// Auto-migrate v1 config on first run
import { configMigrator } from "./config/migrator";

if (await configMigrator.needsMigration()) {
  await configMigrator.autoMigrate();
  console.log("✅ Configuration migrated to v2.0");
}
```

### Task 4: Update Checker Integration (Priority: Medium)

**Integration Point:**
- Main CLI startup (background check)

**Implementation:**
```typescript
// src/index.ts
import { updateChecker, notificationService } from "./core/updates";

async function main() {
  const config = await configLoaderV2.loadConfig();
  
  // Background update check (non-blocking)
  if (config.behavior.updateCheck !== "never" && !config.quiet) {
    updateChecker.checkForUpdates(config.behavior.updateCheck, {
      quiet: config.quiet
    })
    .then(result => {
      if (result.updates.length > 0) {
        notificationService.showUpdateHint(result.updates.length, config.quiet);
      }
    })
    .catch(() => {
      // Silently fail - don't interrupt user
    });
  }
  
  // Continue with command execution
  await executeCommand();
}
```

**Files to Modify:**
- `src/index.ts` - Add background update check

### Task 5: First-Run Setup Integration (Priority: Low)

**Integration Point:**
- Main CLI startup (before command execution)

**Implementation:**
```typescript
// src/index.ts
import { handleFirstRun } from "./core/setup";

async function main() {
  // Check for first run
  const ranSetup = await handleFirstRun({
    skip: cliOptions.quiet,
    force: cliOptions.setup
  });
  
  if (ranSetup) {
    // Setup wizard ran, reload config
    config = await configLoaderV2.loadConfig();
  }
  
  // Continue with command execution
  await executeCommand();
}
```

**Files to Modify:**
- `src/index.ts` - Add first-run detection

## Implementation Order

### Phase 1: Core Integration (Week 1)
1. ✅ Create integration plan (this document)
2. ⏳ Integrate CommandResultBuilder into add command
3. ⏳ Integrate retry system into add command
4. ⏳ Update main CLI to handle CommandResult
5. ⏳ Test add command end-to-end

### Phase 2: Command Migration (Week 1-2)
6. ⏳ Migrate remove command to CommandResultBuilder + retry
7. ⏳ Migrate update command to CommandResultBuilder + retry
8. ⏳ Migrate list command to CommandResultBuilder
9. ⏳ Migrate info command to CommandResultBuilder
10. ⏳ Migrate doctor command to CommandResultBuilder
11. ⏳ Migrate setup command to CommandResultBuilder

### Phase 3: System Integration (Week 2)
12. ⏳ Integrate config v2 loading at startup
13. ⏳ Add auto-migration for v1 configs
14. ⏳ Integrate background update checker
15. ⏳ Integrate first-run setup detection

### Phase 4: Testing & Polish (Week 2-3)
16. ⏳ End-to-end manual testing
17. ⏳ Error scenario testing
18. ⏳ Performance testing
19. ⏳ Documentation updates
20. ⏳ User migration guide

## Testing Strategy

### Integration Tests
- Test each command with retry scenarios
- Test output formatting in all modes
- Test config loading and precedence
- Test update checker notifications

### Manual Testing
- Fresh install experience
- Config migration from v1
- All command workflows
- Error recovery scenarios
- Update notifications

### Regression Testing
- Ensure existing functionality preserved
- Test backward compatibility
- Verify no breaking changes in command interface

## Success Criteria

✅ All commands return standardized CommandResult  
✅ Retry system integrated into network/install operations  
✅ Config v2 loaded at startup with precedence  
✅ Update checker runs in background  
✅ First-run setup works seamlessly  
✅ All manual tests pass  
✅ Documentation updated  
✅ Zero regression in existing features

## Risk Mitigation

**Risk:** Breaking existing command behavior  
**Mitigation:** Comprehensive testing, feature flags

**Risk:** Performance degradation  
**Mitigation:** Background operations, caching, profiling

**Risk:** Configuration conflicts  
**Mitigation:** Clear precedence rules, migration guide

**Risk:** User confusion  
**Mitigation:** Clear messaging, setup wizard, help text

## Rollback Plan

If integration causes issues:
1. Keep Phase 2 systems separate (working)
2. Revert command changes
3. Release Phase 1 only
4. Fix issues and retry integration

The modular architecture allows easy rollback without losing Phase 2 work.

## Next Steps

1. Start with Task 1: Integrate retry into add command
2. Verify functionality with manual testing
3. Proceed to remaining commands
4. Complete system integration
5. Final testing and documentation

Let's begin with the add command integration!
