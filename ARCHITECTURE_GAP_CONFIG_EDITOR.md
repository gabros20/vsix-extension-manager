# Architecture Analysis: Config Editor Preference vs Interactive Mode

**Date**: 2024  
**Issue**: Config's `editor.prefer` setting is not used in interactive mode  
**Severity**: Medium (UX inconsistency)  
**Status**: 📋 Gap Identified

---

## Current Architecture Overview

### 1. Config Setup (Setup Wizard)

**File**: `src/core/setup/wizard.ts`

When user runs setup wizard, they choose their preferred editor:

```typescript
editor: () =>
  ui.select({
    message: "Which editor do you use primarily?",
    options: [
      {
        value: "auto",
        label: "Auto-detect (recommended)",
        hint: "Automatically detect Cursor or VS Code",
      },
      { value: "cursor", label: "Cursor", hint: "Use Cursor exclusively" },
      { value: "vscode", label: "VS Code", hint: "Use VS Code exclusively" },
    ],
  });
```

This gets saved to `~/.vsix/vsix.config.yml`:

```yaml
version: "2.0"
editor:
  prefer: cursor # User's preference saved here!
```

### 2. Config Loading

**File**: `src/config/loaderV2.ts`

Config is loaded with precedence:

```
CLI flags > Environment Variables > Config File > Defaults
```

**File**: `src/config/schemaV2.ts`

```typescript
const EditorConfigSchema = z.object({
  prefer: z.enum(["cursor", "vscode", "auto"]).default("auto"),
  "cursor-binary": z.string().optional(),
  "vscode-binary": z.string().optional(),
});
```

Environment variable mapping:

```typescript
VSIX_EDITOR: "editor.prefer";
```

---

## The Gap: How Editor Selection Actually Works

### ❌ What You'd Expect (But Doesn't Happen)

```
User runs setup wizard
  ↓
Chooses "cursor" as preferred editor
  ↓
Config saved with editor.prefer = "cursor"
  ↓
User runs interactive mode
  ↓
System loads config, sees editor.prefer = "cursor"
  ↓
System automatically uses Cursor (no prompt needed)
```

### ✅ What Actually Happens

```
User runs setup wizard
  ↓
Chooses "cursor" as preferred editor
  ↓
Config saved with editor.prefer = "cursor"
  ↓
User runs interactive mode
  ↓
Interactive handler IGNORES config completely!
  ↓
Detects available editors from scratch
  ↓
If multiple editors: PROMPTS user to choose again
```

---

## Code Analysis: Where Config Is (Not) Used

### CLI Commands Flow

**File**: `src/index.ts`

CLI arguments are parsed by Commander:

```typescript
program.option("-e, --editor <type>", "Target editor (cursor|vscode|auto)");
// ... other options

cmd.action(async (...args) => {
  const options = args[args.length - 2];

  const globalOptions = {
    editor: options.editor, // ← From CLI flag only!
    // ... other options
  };

  const result = await commandInstance.execute(positionalArgs, globalOptions);
});
```

**Problem**: `options.editor` comes **only from CLI flags**, not from config file!

### Command Implementation

**File**: `src/commands/list.ts` (and update.ts, remove.ts, add/executor.ts)

```typescript
async execute(_args: string[], options: GlobalOptions): Promise<CommandResult> {
  // Get editor info
  const editorService = getEditorService();
  const editor = options.editor || "auto";  // ← Falls back to "auto", never checks config!
  let chosenEditor: "vscode" | "cursor";

  if (editor === "auto") {
    const available = await editorService.getAvailableEditors();

    if (available.length === 1) {
      chosenEditor = available[0].name;
    } else {
      // Multiple editors - prompt user
      const selected = await ui.selectEditor(available, "cursor");  // ← Hardcoded "cursor" preference!
      chosenEditor = selected.name;
    }
  }
  // ...
}
```

**Problems**:

1. `options.editor` is only set by CLI flag `--editor`
2. Config file's `editor.prefer` is never checked
3. The `"cursor"` passed to `selectEditor()` is hardcoded, not from config
4. User's saved preference is completely ignored

### Interactive Mode

**File**: `src/commands/interactive.ts`

```typescript
async function handleAddExtension() {
  // Select editor first (if multiple available)
  const { getEditorService } = await import("../features/install");
  const editorService = getEditorService();
  const availableEditors = await editorService.getAvailableEditors();

  let selectedEditor: "vscode" | "cursor" | undefined;

  if (availableEditors.length === 1) {
    selectedEditor = availableEditors[0].name;
  } else {
    // Multiple editors available - let user choose
    const editorChoice = await p.select({
      message: "Select target editor:",
      options: availableEditors.map((e) => ({
        value: e.name,
        label: e.displayName,
      })),
    });
    selectedEditor = editorChoice;
  }

  // Pass to command
  const options: GlobalOptions = {
    editor: selectedEditor,
    // ...
  };
}
```

**Problem**:

- Interactive handlers detect editors from scratch
- Never load config to check `editor.prefer`
- User has to re-select editor every time, even though they saved a preference!

---

## The Architecture Gap

### Current Flow (Broken)

```
┌─────────────────────────────────────────────────────┐
│ Setup Wizard                                        │
│ User chooses: prefer = "cursor"                     │
│ Saves to: ~/.vsix/vsix.config.yml                  │
└─────────────────────────────────────────────────────┘
                      ↓
                  Config saved ✓
                      ↓
┌─────────────────────────────────────────────────────┐
│ CLI Usage                                           │
│ $ vsix list                                         │
└─────────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────┐
│ index.ts (CLI Parser)                               │
│ options.editor = CLI flag value || undefined        │
│ ❌ Config NOT loaded here!                          │
└─────────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────┐
│ list.ts (Command)                                   │
│ editor = options.editor || "auto"                   │
│ ❌ Falls back to "auto", config ignored!            │
└─────────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────┐
│ If auto + multiple editors                          │
│ ui.selectEditor(available, "cursor")                │
│ ❌ Hardcoded "cursor", not from config!             │
└─────────────────────────────────────────────────────┘

Result: User's saved preference is completely ignored!
```

---

## Why This Matters

### User Experience Problem

**Scenario**: User has both VS Code and Cursor installed

1. **First Time**: Run setup wizard

   ```bash
   $ vsix setup
   ◇ Which editor do you use primarily?
   │  ● Cursor
   ✓ Configuration saved!
   ```

2. **Later**: Run interactive mode
   ```bash
   $ vsix
   ◇ What would you like to do?
   │  ⚡ Add extension
   │
   ◇ Select target editor:      ← WHY? I already chose Cursor in setup!
   │  ● VS Code
   │    Cursor
   ```

**Problem**: User has to repeatedly select editor, even though they saved a preference!

### What Should Happen

```bash
$ vsix
◇ What would you like to do?
│  ⚡ Add extension
│
│  Using Cursor (from config)  ← Config preference automatically applied!
│
◇ What would you like to add?
│  🔍 Extension by ID
```

---

## Root Causes

### 1. Config Not Loaded in CLI Entry Point

**File**: `src/index.ts`

```typescript
cmd.action(async (...args) => {
  const options = args[args.length - 2];

  // ❌ Config never loaded here!
  // Should be:
  // const config = await configLoaderV2.loadConfig();
  // const editor = options.editor || config.editor.prefer;

  const globalOptions = {
    editor: options.editor, // Only CLI flag
    // ...
  };
});
```

### 2. Commands Don't Receive Config

Commands receive `GlobalOptions` but never receive the loaded config:

```typescript
interface GlobalOptions {
  editor?: EditorType; // Only from CLI flag
  // No config object passed!
}
```

### 3. Interactive Handlers Don't Load Config

**File**: `src/commands/interactive.ts`

```typescript
async function handleAddExtension() {
  // ❌ Should load config here:
  // const config = await configLoaderV2.loadConfig();
  // const preferredEditor = config.editor.prefer;

  const editorService = getEditorService();
  const availableEditors = await editorService.getAvailableEditors();

  // ❌ Should filter by config preference:
  // const preferred = availableEditors.find(e => e.name === preferredEditor);
}
```

---

## Correct Architecture (How It Should Work)

### Option 1: Load Config in CLI Entry Point (Recommended)

**File**: `src/index.ts`

```typescript
cmd.action(async (...args) => {
  const options = args[args.length - 2];

  // ✅ Load config with CLI precedence
  const config = await configLoaderV2.loadConfig({
    editor: {
      prefer: options.editor as any, // CLI overrides config
    },
    // ... map other CLI options to config
  });

  const globalOptions = {
    editor: config.editor.prefer, // ✅ Uses config if no CLI flag
    codeBin: config.editor["cursor-binary"],
    cursorBin: config.editor["vscode-binary"],
    // ...
  };

  const result = await commandInstance.execute(positionalArgs, globalOptions);
});
```

**Precedence**: CLI flag > Env var > Config file > Default

### Option 2: Pass Config to Commands

```typescript
interface GlobalOptions {
  editor?: EditorType;
  config?: ConfigV2; // ✅ Pass full config
  // ...
}

// Commands can now check:
const editor = options.editor || options.config?.editor.prefer || "auto";
```

### Option 3: Load Config in Interactive Handlers

**File**: `src/commands/interactive.ts`

```typescript
async function handleAddExtension() {
  // ✅ Load config to get preference
  const config = await configLoaderV2.loadConfig();

  const editorService = getEditorService();
  const availableEditors = await editorService.getAvailableEditors();

  // ✅ Filter by configured preference
  let selectedEditor: "vscode" | "cursor";

  if (availableEditors.length === 1) {
    selectedEditor = availableEditors[0].name;
  } else if (config.editor.prefer !== "auto") {
    // ✅ Use config preference if set
    const preferred = availableEditors.find((e) => e.name === config.editor.prefer);
    if (preferred) {
      selectedEditor = config.editor.prefer as "vscode" | "cursor";
      p.log.info(`Using ${preferred.displayName} (from config)`);
    } else {
      // Preferred editor not available, prompt
      selectedEditor = await promptForEditor(availableEditors);
    }
  } else {
    // Config says "auto", prompt user
    selectedEditor = await promptForEditor(availableEditors);
  }

  // ...
}
```

---

## Recommended Solution

### Important Design Consideration

**User Need**: Even with a configured default editor, users must be able to choose the non-default editor when needed.

**Example Scenario**:

- User's default: Cursor (configured in setup)
- User has both Cursor and VS Code installed
- User wants to install extension to VS Code (the non-default one)

**Solution**: Always offer choice in interactive mode, but indicate the default.

---

### Step 1: Load Config in CLI Entry Point

This ensures **all commands** respect config, not just interactive mode.

**File**: `src/index.ts`

```typescript
import { configLoaderV2 } from "./config/loaderV2";

program.option("--config <path>", "Path to configuration file");

cmd.action(async (...args) => {
  const cmdOptions = args[args.length - 2];
  const cmdInstance = args[args.length - 1];

  // Load config with CLI precedence
  const config = await configLoaderV2.loadConfig(
    {
      editor: cmdOptions.editor ? { prefer: cmdOptions.editor } : undefined,
      // Map other CLI options to config structure
    },
    {
      configPath: cmdInstance.parent?.opts().config,
    },
  );

  // Build GlobalOptions with config defaults
  const globalOptions = {
    editor: config.editor.prefer,
    codeBin: cmdOptions.codeBin || config.editor["vscode-binary"],
    cursorBin: cmdOptions.cursorBin || config.editor["cursor-binary"],
    timeout: cmdOptions.timeout || config.performance.timeout,
    retry: cmdOptions.retry || config.performance.retry,
    // ... etc
  };

  await commandInstance.execute(positionalArgs, globalOptions);
});
```

### Step 2: Update Interactive Handlers (With Choice Preservation)

**File**: `src/commands/interactive.ts`

```typescript
/**
 * Helper: Select editor with config preference
 * IMPORTANT: Always offers choice if multiple editors available,
 * but indicates which is the configured default
 */
async function selectEditorWithPreference(): Promise<"vscode" | "cursor"> {
  // Load config to get preference
  const config = await configLoaderV2.loadConfig();

  const { getEditorService } = await import("../features/install");
  const editorService = getEditorService();
  const availableEditors = await editorService.getAvailableEditors();

  if (availableEditors.length === 0) {
    throw new Error("No editors found. Please install VS Code or Cursor.");
  }

  // Single editor - no choice needed
  if (availableEditors.length === 1) {
    const editor = availableEditors[0];
    p.log.info(`Using ${editor.displayName}`);
    return editor.name;
  }

  // Multiple editors available
  const hasExplicitPreference = config.editor.prefer !== "auto";
  const preferredEditor = availableEditors.find((e) => e.name === config.editor.prefer);

  // Build options with default indication
  const options = availableEditors.map((e) => {
    const isDefault = hasExplicitPreference && e.name === config.editor.prefer;
    const isRecommended = !hasExplicitPreference && e.name === "cursor";

    let hint: string | undefined;
    if (isDefault) {
      hint = "Default (configured)";
    } else if (isRecommended) {
      hint = "Recommended";
    }

    return {
      value: e.name,
      label: e.displayName,
      hint,
    };
  });

  // CRITICAL: Always prompt, even with configured preference
  // This allows users to choose non-default editor when needed
  const editorChoice = await p.select({
    message: hasExplicitPreference
      ? `Select editor (default: ${preferredEditor?.displayName || config.editor.prefer}):`
      : "Select target editor:",
    options,
  });

  if (p.isCancel(editorChoice)) {
    throw new Error("Editor selection cancelled");
  }

  const selectedEditor = editorChoice as "vscode" | "cursor";

  // Log if user chose non-default
  if (hasExplicitPreference && selectedEditor !== config.editor.prefer) {
    p.log.info(`Using ${selectedEditor === "cursor" ? "Cursor" : "VS Code"} (overriding default)`);
  }

  return selectedEditor;
}

// Use in all handlers:
async function handleAddExtension() {
  p.log.step("Add Extension");

  // ✅ Respects config preference but still offers choice!
  const selectedEditor = await selectEditorWithPreference();

  // ... rest of handler
}
```

**Alternative Approach**: Auto-use default with explicit override option

```typescript
/**
 * Alternative: Auto-use default, offer override
 */
async function selectEditorWithPreference(): Promise<"vscode" | "cursor"> {
  const config = await configLoaderV2.loadConfig();
  const editorService = getEditorService();
  const availableEditors = await editorService.getAvailableEditors();

  if (availableEditors.length === 0) {
    throw new Error("No editors found. Please install VS Code or Cursor.");
  }

  if (availableEditors.length === 1) {
    return availableEditors[0].name;
  }

  // Check if explicit preference is configured
  const hasExplicitPreference = config.editor.prefer !== "auto";
  const preferredEditor = availableEditors.find((e) => e.name === config.editor.prefer);

  if (hasExplicitPreference && preferredEditor) {
    // Ask if user wants to use default or choose different
    const useDefault = await p.confirm({
      message: `Use ${preferredEditor.displayName} (configured default)?`,
      initialValue: true,
    });

    if (p.isCancel(useDefault)) {
      throw new Error("Editor selection cancelled");
    }

    if (useDefault) {
      return preferredEditor.name;
    }

    // User wants to choose different editor
    const otherEditors = availableEditors.filter((e) => e.name !== preferredEditor.name);

    if (otherEditors.length === 1) {
      p.log.info(`Using ${otherEditors[0].displayName} (override)`);
      return otherEditors[0].name;
    }

    // Multiple other editors (unlikely but handle it)
    const choice = await p.select({
      message: "Select alternative editor:",
      options: otherEditors.map((e) => ({
        value: e.name,
        label: e.displayName,
      })),
    });

    if (p.isCancel(choice)) {
      throw new Error("Editor selection cancelled");
    }

    return choice as "vscode" | "cursor";
  }

  // No preference or preference not available - prompt normally
  const choice = await p.select({
    message: "Select target editor:",
    options: availableEditors.map((e) => ({
      value: e.name,
      label: e.displayName,
      hint: e.name === "cursor" ? "Recommended" : undefined,
    })),
  });

  if (p.isCancel(choice)) {
    throw new Error("Editor selection cancelled");
  }

  return choice as "vscode" | "cursor";
}
```

---

## Benefits of Fixing This Gap

### 1. **Better UX**

- Users only configure preference once in setup
- No repeated prompts if preference is clear
- Config actually serves its purpose

### 2. **Consistent Behavior**

- CLI commands respect config
- Interactive mode respects config
- Environment variables work correctly

### 3. **Proper Precedence**

```
CLI flag > Environment variable > Config file > Auto-detect
```

### 4. **Documentation Matches Reality**

- Config file docs say `editor.prefer` controls default
- Currently doesn't work - would make docs accurate

---

## Current vs. Fixed Behavior

### Current (Broken)

```bash
# Setup
$ vsix setup
◇ Which editor do you use primarily?
│  ● Cursor  ✓
✓ Config saved to ~/.vsix/vsix.config.yml

# Later - Interactive mode
$ vsix
◇ What would you like to do?
│  ⚡ Add extension
│
◇ Select target editor:     ← Ignores config! No indication of default
│  ● VS Code
│    Cursor

# Later - CLI mode
$ vsix list
Auto-detected VS Code      ← Ignores config! (picks first available)
```

### Fixed - Approach 1: Show Default, Always Offer Choice

```bash
# Setup
$ vsix setup
◇ Which editor do you use primarily?
│  ● Cursor  ✓
✓ Config saved to ~/.vsix/vsix.config.yml

# Later - Interactive mode (using default)
$ vsix
◇ What would you like to do?
│  ⚡ Add extension
│
◇ Select editor (default: Cursor):  ← Shows default, still offers choice
│  ● Cursor  (Default)
│    VS Code

# Later - Interactive mode (choosing non-default)
$ vsix
◇ What would you like to do?
│  ⚡ Add extension
│
◇ Select editor (default: Cursor):
│    Cursor  (Default)
│  ● VS Code                        ← User can choose non-default!
│
│  Using VS Code (overriding default)

# Later - CLI mode
$ vsix list
Using Cursor (from config)     ← Respects config!

# Override when needed
$ vsix list --editor vscode
Using VS Code                  ← CLI flag overrides config ✓
```

### Fixed - Approach 2: Confirm Default, Then Offer Override

```bash
# Setup
$ vsix setup
◇ Which editor do you use primarily?
│  ● Cursor  ✓
✓ Config saved to ~/.vsix/vsix.config.yml

# Later - Interactive mode (using default)
$ vsix
◇ What would you like to do?
│  ⚡ Add extension
│
◇ Use Cursor (configured default)?
│  ● Yes
│    No - choose different
│
│  Using Cursor

# Later - Interactive mode (choosing non-default)
$ vsix
◇ What would you like to do?
│  ⚡ Add extension
│
◇ Use Cursor (configured default)?
│    Yes
│  ● No - choose different       ← User wants different editor
│
│  Using VS Code (override)

# Later - CLI mode
$ vsix list
Using Cursor (from config)     ← Respects config!

# Override when needed
$ vsix list --editor vscode
Using VS Code                  ← CLI flag overrides config ✓
```

### Comparison of Approaches

| Aspect                    | Approach 1: Always Show   | Approach 2: Confirm First   |
| ------------------------- | ------------------------- | --------------------------- |
| Clicks to use default     | 1 (select default)        | 1 (confirm yes)             |
| Clicks to use non-default | 1 (select other)          | 2 (confirm no, then select) |
| User awareness of default | ✅ Always visible         | ✅ Explicit confirmation    |
| Speed for default usage   | Fast                      | Fast                        |
| Speed for non-default     | Fast                      | Slower (extra step)         |
| UX clarity                | ✅ Clear visual indicator | ✅ Explicit question        |
| **Recommendation**        | ✅ **Better**             | Good, but slower            |

**Recommended**: Approach 1 (Always show choices with default indicated)

---

## Summary

### The Gap

1. **Config file has `editor.prefer`** setting saved by setup wizard
2. **CLI commands never load config** - only use CLI flags
3. **Interactive handlers never load config** - detect editors from scratch
4. **Result**: User's saved preference is completely ignored
5. **Critical Need**: Even with default configured, users must be able to choose non-default editor

### The Fix

1. Load config in CLI entry point (`src/index.ts`)
2. Map config values to `GlobalOptions` with proper precedence
3. Update interactive handlers to check config preference
4. **Always offer choice in interactive mode** - but indicate the default
5. Create helper function for consistent editor selection

### Design Principles

**For CLI Commands** (non-interactive):

- Use configured default automatically
- Override with `--editor` flag when needed
- Show: "Using Cursor (from config)"

**For Interactive Mode**:

- Always show editor choices (even with default configured)
- Visually indicate which is the default: "● Cursor (Default)"
- Allow selecting non-default without extra steps
- User might want to install to VS Code even though Cursor is default

### Implementation Strategy

**Phase 1: CLI Command Config Loading** (2-3 hours)

- [ ] Update `src/index.ts` to load config before command execution
- [ ] Map config values to GlobalOptions with precedence
- [ ] Test CLI commands respect config preference
- [ ] Test CLI flags override config (precedence check)

**Phase 2: Interactive Handler Updates** (2-3 hours)

- [ ] Create `selectEditorWithPreference()` helper
- [ ] Load config to get preference
- [ ] Show choices with default indicated
- [ ] Update all 5 interactive handlers to use helper
- [ ] Add logging for default vs. override usage

**Phase 3: Testing** (1-2 hours)

- [ ] Test with no config (auto-detect behavior)
- [ ] Test with config prefer="cursor" (default indicated)
- [ ] Test with config prefer="vscode" (default indicated)
- [ ] Test with config prefer="auto" (no default, show recommendation)
- [ ] Test CLI flag overrides config
- [ ] Test environment variable overrides config
- [ ] Test selecting non-default in interactive mode

**Phase 4: Documentation** (1 hour)

- [ ] Update README.md with config usage examples
- [ ] Update configuration docs
- [ ] Add examples showing default override
- [ ] Document precedence chain

### Impact

- **Severity**: Medium (works, but ignores user preferences)
- **User Impact**: All users who configured editor preference
- **Frequency**: Every command that needs editor selection
- **Breaking Changes**: None (only fixes behavior to match expectations)
- **User Benefit**: Saves time by using configured default, but preserves flexibility
- **Total Effort**: ~6-9 hours to implement properly

### Edge Cases to Handle

1. **Configured preference not available**

   ```
   Config: prefer = "cursor"
   Available: [vscode]
   → Prompt for vscode (show warning about preference)
   ```

2. **Multiple non-default editors**

   ```
   Config: prefer = "cursor"
   Available: [cursor, vscode, codium]
   → Show all, indicate cursor as default
   ```

3. **Config says "auto" with multiple editors**

   ```
   Config: prefer = "auto"
   Available: [cursor, vscode]
   → Show both with "cursor" as "Recommended"
   ```

4. **Single editor available**

   ```
   Available: [cursor]
   → Auto-use, no prompt needed
   ```

5. **No editors available**
   ```
   Available: []
   → Error: "No editors found. Please install VS Code or Cursor."
   ```

---

**Status**: 📋 Gap Identified and Documented  
**Priority**: Medium (UX improvement)  
**Recommendation**: Implement in next iteration  
**Workaround**: Users can use `--editor` flag or set `VSIX_EDITOR` env var  
**Design Decision**: Always offer choice in interactive mode (preserves flexibility)
