# UX Improvement Proposals v1.2

**Document Version:** 1.3  
**Date:** October 1, 2025  
**Status:** Proposed  
**Current Version:** v1.16.0  
**Target Release:** v2.0.0 (Breaking Changes - Complete Refactor)

## Executive Summary

This document outlines a **complete refactor of VSIX Extension Manager v2.0.0** - a breaking change release that dramatically simplifies the CLI by reducing cognitive load, minimizing steps to accomplish common tasks, and improving discoverability.

**This is a ground-up redesign with breaking changes.** We're not maintaining backward compatibility - instead, we're building the CLI we wish we had from the start. Current version v1.16.0 will be completely refactored into v2.0.0.

**North Star UX:** "I tell it what I have (URL, file, ID, folder) and what I want (install, download-only). The CLI figures out the rest, shows me the plan, and runs it. If anything goes wrong, it guides me."

**Core Philosophy:** Make simple things simple, complex things possible.

### Key Principles

1. **Smart defaults** - Do the right thing automatically
2. **Progressive disclosure** - Simple first, advanced when needed
3. **Predictable behavior** - Consistent across modes (interactive vs quiet/json)
4. **Fail-forward** - Detect problems early, offer actionable automated recovery
5. **Task-oriented** - Workflows over commands
6. **Clean slate** - Complete refactor, new command structure, simplified flags

---

## Table of Contents

1. [Baseline Snapshot](#baseline-snapshot)
2. [Current UX Analysis](#current-ux-analysis)
3. [Key Problems](#key-problems)
4. [Phase 1: Foundation](#phase-1-foundation-core-refactor)
5. [Phase 2: Intelligence](#phase-2-intelligence-quality-of-life)
6. [Phase 3: Advanced Features](#phase-3-advanced-features-team--workflows)
7. [New Command Structure](#new-command-structure-v20)
8. [New Flag System](#new-flag-system-v20)
9. [Technical Specifications](#technical-specifications)
10. [Implementation Strategy](#implementation-strategy)
11. [Breaking Changes & Migration](#breaking-changes--migration)
12. [Success Metrics](#success-metrics)
13. [User Testing Plan](#user-testing-plan)
14. [Appendices](#appendices)

---

## Baseline Snapshot

Reference: `src/commands/*`, `src/features/*`, `src/core/*`, README.

**Current State:**

- Multiple commands split by task: `download`, `from-list`, `install`, `quick-install`, `update`, `uninstall`, `rollback`, `versions`, plus `install-direct` and interactive menu
- Strong internals already exist: robust installer, editor detection, compatibility checks, bulk download, backup/rollback, progress utilities, and typed error handling
- Friction today: users choose modes first, then provide inputs; prompts vary by command; quiet/json rules differ; some power features are hidden behind flags

---

## Current UX Analysis

### Current User Journeys

#### Journey 1: First-time user wants to install an extension in Cursor

**Current Steps:**

1. User runs `vsix-extension-manager`
2. Navigates: Main Menu → Install → Quick install by URL
3. Pastes marketplace URL
4. Waits for download
5. Selects editor (if multiple detected)
6. Confirms installation

**Step Count:** 6+ interactions  
**Target:** 2 interactions (command + confirm)

---

#### Journey 2: Setup new development environment

**Current Steps:**

1. On old machine: `vsix-extension-manager export-installed -o extensions.txt`
2. Transfer file to new machine
3. On new machine: `vsix-extension-manager install --file extensions.txt --download-missing`
4. Select editor
5. Wait for downloads
6. Wait for installations

**Step Count:** 6 steps, 2 machines, manual file transfer  
**Target:** 3 steps with automated sync

---

#### Journey 3: Update extensions safely

**Current Steps:**

1. User runs `vsix-extension-manager update`
2. Select editor
3. Select extensions or all
4. Confirm update
5. Wait for downloads
6. Wait for installations
7. If something breaks → rollback flow

**Step Count:** 7+ interactions  
**Target:** 3 interactions with automatic backup

---

## Key Problems

### 1. **Too Many Modes & Sub-menus**

**Problem:** Users must navigate through hierarchical menus to reach common actions.

```
Main Menu (7 options)
  ├─ Install (4 sub-options + back)
  ├─ Download (3 sub-options + back)
  ├─ Update (1 sub-option + back)
  ├─ Uninstall (1 sub-option + back)
  ├─ Export (1 sub-option + back)
  └─ Version (1 sub-option + back)
```

**User Pain:** "I just want to install an extension, why do I need to choose between quick-install, install-vsix-single, install-vsix-dir, and install-list?"

---

### 2. **Download ≠ Install Mental Model**

**Problem:** Users think in terms of "get extension" not "download then install."

**Current Separation:**

- `download` - Gets VSIX files
- `install` - Installs VSIX files
- `quick-install` - Download + install + cleanup (but hidden in sub-menu)
- `from-list --install` - Download + install from list

**User Pain:** "Why do I need `--install-after` flag? Shouldn't installing be the default?"

---

### 3. **Hidden Power Features**

**Problem:** Advanced features are buried or require flags users don't know exist.

**Examples:**

- Compatibility checking: Only in `from-list` with `--check-compatibility`
- Automatic backup: Only in `update` command
- Direct installation: Separate `install-direct` command
- Binary mismatch detection: Only shows when there's a problem

**User Pain:** "I installed an incompatible extension and it broke my editor. How was I supposed to know?"

---

### 4. **Configuration Complexity**

**Problem:** Three configuration layers (CLI, ENV, Files) with unclear precedence.

**Current:**

```bash
# Option A: CLI flags (verbose)
vsix-extension-manager install --vsix ./ext.vsix --editor cursor --skip-installed --parallel 2

# Option B: ENV vars (hard to discover)
export VSIX_EDITOR=cursor
export VSIX_SKIP_INSTALLED=true
export VSIX_INSTALL_PARALLEL=2
vsix-extension-manager install --vsix ./ext.vsix

# Option C: Config file (where do I put it?)
# .vsixrc.json? vsix.config.json? ~/.config/vsix-extension-manager/config.json?
```

**User Pain:** "I set `--editor cursor` in my config file but it still asks me which editor. Why?"

**Needed:** Clear precedence: CLI > env `VSIX_*` > config > defaults

---

### 5. **Inconsistent Interactivity**

**Problem:** Interactive behavior differs between modes.

**Examples:**

- `install --vsix file.vsix` - Interactive editor selection
- `install --file list.txt --quiet` - Requires explicit `--editor` flag
- `quick-install --url "..."` - Prompts unless `--quiet`
- Bulk operations sometimes sequential, sometimes parallel

**User Pain:** "Sometimes it asks me questions, sometimes it errors. I can't predict when I need flags."

---

### 6. **Error Recovery Gaps**

**Problem:** When things go wrong, recovery is manual.

**Current State:**

- Installation fails → manual retry
- Extension incompatible → already installed, now need to uninstall
- Update breaks extension → must remember to run `rollback`
- Wrong editor selected → start over

**User Pain:** "It failed. Now what? Do I run the same command again?"

---

## Phase 1: Foundation (Core Refactor)

**Goal:** Core command structure and smart routing  
**Estimated Effort:** 3-4 weeks  
**User Impact:** High - New unified command structure

### 1. Smart `add` Command - Universal Entry Point

**Concept:** One command that does "the right thing" based on input.

```bash
# Just a URL → auto-detect: quick install
vsix-extension-manager add "https://marketplace.../python"

# Just a file path → install local VSIX
vsix-extension-manager add ./extension.vsix

# Just a directory → install all VSIX files
vsix-extension-manager add ./downloads

# Just a list → download + install from list
vsix-extension-manager add extensions.txt

# Just an extension ID → resolve + download + install
vsix-extension-manager add ms-python.python
```

**Behavior flags (simple, memorable):**

- `--download-only` (no install)
- `--install` (force install if ambiguous)
- `--yes`/`-y` (skip confirmations)
- `--editor <vscode|cursor|auto>` (global override)
- `--source <marketplace|open-vsx|auto>` and `--pre-release`

**Benefits:**

- 90% use case = 1 command
- No mental mode switching
- Input type determines behavior
- Fewer flags needed

**Input Detection Order (priority):**

1. URL (Marketplace/OpenVSX) → `parseExtensionUrl`
2. Existing file path → if `.vsix` → file; if `.json` or `.txt` → list
3. Existing directory path → directory
4. Pattern `publisher.name` → extension ID

**Ambiguity Resolution:**

- File paths checked before IDs
- In interactive mode: show Plan with detected type and allow "Customize"
- In quiet/json: error with clear guidance

**Implementation:**

```typescript
// New: src/commands/add.ts
export async function smartAdd(input: string, options: AddOptions) {
  const inputType = detectInputType(input);

  switch (inputType) {
    case "url":
      return await quickInstallFlow(input, options);
    case "vsix-file":
      return await installFileFlow(input, options);
    case "vsix-directory":
      return await installDirectoryFlow(input, options);
    case "extension-list":
      return await installFromListFlow(input, options);
    case "extension-id":
      return await resolveAndInstallFlow(input, options);
    default:
      throw new UserInputError("Unable to determine input type");
  }
}
```

**Notes:**

- Light router layer; reuse existing services: `quickInstall`, `vsixScanner`, `installFromList`, `downloadSingle/bulk`
- No business logic shift required
- All additions are additive and leverage existing internals

---

### 2. Plan Preview - Single Consolidated Confirmation

**Current:** Multiple prompts throughout the process.

**Proposed:** Single confirmation showing the complete plan before execution.

**Visual Design (Interactive Mode):**

```
╭─────────────────────────────────────────────────────╮
│  📦 Installation Plan                               │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Extension: Python                                  │
│  ID: ms-python.python                              │
│  Version: 2024.2.0 (latest)                        │
│  Source: Visual Studio Marketplace                 │
│                                                     │
│  Target: Cursor (v0.41.0)                          │
│  Location: ~/.cursor/extensions                    │
│                                                     │
│  ✅ Compatibility Check: Passed                    │
│  ✅ Disk Space: 45 MB available                    │
│  ✅ Network: Connected                             │
│                                                     │
│  Steps:                                            │
│  1. Download (~15 MB)                              │
│  2. Verify checksum                                │
│  3. Install extension                              │
│  4. Verify installation                            │
│                                                     │
│  Estimated time: ~30 seconds                       │
│                                                     │
├─────────────────────────────────────────────────────┤
│  [Y]es  [N]o  [C]ustomize  [?]Help                │
╰─────────────────────────────────────────────────────╯
```

**Compact Format (when `--yes` skips):**

```text
📋 Plan
  Input: ms-python.python
  Resolve: Marketplace • latest (stable)
  Target: Cursor (auto-detected)
  Steps: Download → Install
  Safety: Compatibility check (auto) • Timeout: 30s • Retries: 2

Continue? (Y/n)
```

**Multiple Editors Detected:**

```
⚠️  Multiple editors found:
   1. Cursor (recommended - most recently used)
   2. VS Code

Install to: (1)
```

**Benefits:**

- User sees the plan before execution
- Defaults are explained
- One confirmation instead of multiple prompts
- Context-aware recommendations

**Implementation (using Clack):**

```typescript
// New: src/core/ui/confirmationScreen.ts
import { log, confirm, select, intro } from "@clack/prompts";

export interface InstallPlan {
  extension: ExtensionInfo;
  target: EditorInfo;
  steps: PlanStep[];
  checks: PreflightCheck[];
  estimates: {
    downloadSize: number;
    downloadTime: number;
    totalTime: number;
  };
}

export async function showInstallPlan(
  plan: InstallPlan,
  options: { allowCustomize: boolean },
): Promise<"confirm" | "cancel" | "customize"> {
  intro("📦 Installation Plan");

  log.message(`
Extension: ${plan.extension.name}
ID: ${plan.extension.id}
Version: ${plan.extension.version} (latest)
Source: Visual Studio Marketplace

Target: ${plan.target.name} (${plan.target.version})
Location: ${plan.target.extensionsPath}

✅ Compatibility Check: Passed
✅ Disk Space: ${plan.estimates.downloadSize} MB available
✅ Network: Connected

Steps:
1. Download (~${plan.estimates.downloadSize} MB)
2. Verify checksum
3. Install extension
4. Verify installation

Estimated time: ~${plan.estimates.totalTime} seconds
`);

  if (options.allowCustomize) {
    return await select({
      message: "How would you like to proceed?",
      options: [
        { value: "confirm", label: "Continue with installation" },
        { value: "customize", label: "Customize settings" },
        { value: "cancel", label: "Cancel" },
      ],
    });
  }

  const shouldContinue = await confirm({
    message: "Continue with installation?",
  });

  return shouldContinue ? "confirm" : "cancel";
}
```

**Plan Export Options:**

- `--plan` prints the computed plan as JSON (download URLs, target editor/bin, steps)
- `--dry-run` executes discovery and validation only, no side effects; prints plan and any warnings
- `--yes` skips preview
- `--json` or `--quiet` outputs machine-readable plan instead of prompting

---

### 3. Consistent Prompting & Quiet Rules

**Standardize across all commands with a clear policy matrix:**

| Mode        | Prompts                                                   | Notes                                       |
| ----------- | --------------------------------------------------------- | ------------------------------------------- |
| Interactive | 1 plan prompt + essential confirmations (e.g., overwrite) | Default mode                                |
| Quiet       | 0                                                         | Missing inputs → fail fast with clear error |
| JSON        | 0                                                         | Output plan/results as JSON                 |

**Multiple editors detected:**

- Interactive: selection prompt with identity badges (OK/MISMATCH)
- Quiet/JSON: require `--editor`, else error

**Predictable Defaults:**

- Editor: prefer Cursor when both present; allow override via `--editor` or config
- Source: `auto` resolves by URL; URL-less flows default to Marketplace with fallback to OpenVSX on 404/403
- Version: `latest` stable; opt into pre-release via `--pre-release`
- Parallelism: safe defaults; sequential in interactive UI; bounded concurrency in quiet

---

### 4. Context-Aware Error Messages & Recovery

**Concept:** Proactively help users based on their situation.

**Scenario: Binary Mismatch Detected**

```
❌ Binary mismatch detected!
   The 'code' command points to Cursor, not VS Code.

💡 Quick fixes:
   1. Install for Cursor instead (recommended)
   2. Fix VS Code binary path
   3. Use explicit binary path

Choose: (1)
```

**Scenario: Extension Already Installed**

```
⚠️  ms-python.python@2024.1.0 is already installed

💡 What would you like to do?
   1. Skip (do nothing)
   2. Reinstall same version
   3. Update to latest (2024.2.0)
   4. Downgrade to specific version

Choose: (1)
```

**Scenario: Installation Failed**

```
❌ Installation failed: Timeout after 30s

💡 Automatic recovery options:
   1. Retry with longer timeout (60s)
   2. Try direct installation (bypass CLI)
   3. Download only for manual install
   4. Skip this extension

Choose: (1)
```

**Error Messaging Standards:**

Every error printed with:

- Human line (what failed and why)
- Suggested next action (automatable when possible)
- Optional `code` for machine handling

**Examples:**

- Network timeout → retry with higher timeout; offer `--retry`/`--retry-delay` hints
- Binary mismatch → show `--editor`, `--code-bin`, `--cursor-bin` solutions and PATH fix snippet (platform-specific)
- Incompatible extension → show reason and offer continue/skip
- CLI install failure → suggest direct install fallback automatically
- 403/404 Marketplace → propose OpenVSX fallback automatically; show final URL used

**Implementation:** Surface suggestions via `core/errors/handler.ts` consistently.

**Benefits:**

- Users learn as they go
- Reduces support burden
- Faster problem resolution
- Builds confidence

---

### 5. Health Check & Auto-Fix (`doctor` command)

**Current:** Problems discovered during operation.

**Proposed:** Proactive health check with auto-fix options.

```bash
# New command
vsix-extension-manager doctor

# Output:
🏥 Running health check...

✅ VS Code detected (v1.85.0)
✅ Cursor detected (v0.41.0)
⚠️  Binary mismatch: 'code' points to Cursor
    Fix: vsix-extension-manager doctor --fix

✅ Extensions directory writable
✅ Network connectivity OK
⚠️  3 corrupted extensions detected
    Fix: vsix-extension-manager doctor --fix

✅ Configuration valid
❌ Update available: v2.5.0 → v2.6.0
    Update: vsix-extension-manager self-update

Summary: 2 warnings, 1 error
Run 'vsix-extension-manager doctor --fix' to auto-fix
```

**Auto-fix capability:**

```bash
vsix-extension-manager doctor --fix

🔧 Applying fixes...

1. Fixing binary mismatch...
   ✅ Updated VS Code binary path

2. Cleaning corrupted extensions...
   ✅ Removed ms-python.python@invalid
   ✅ Removed dbaeumer.vscode-eslint@corrupt
   ✅ Removed github.copilot@damaged

3 issues fixed. Re-run doctor to verify.
```

**Checks:**

- Detect PATH mismatches and broken symlinks
- Validate extensions directory structure, `extensions.json`, `.obsolete`
- Clean temp/corrupted installs safely
- Verify network reachability for registries

**Implementation:** `doctor --fix` applies safe, reversible actions. Internals reuse install/uninstall preflight utilities.

---

### 6. Interactive Menu Redesign - Progressive Enhancement

**Before (Current):**

```
Main Menu:
├─ Install
├─ Download
├─ Update
├─ Uninstall
├─ Export
├─ Version
└─ Quit
```

**After (Proposed):**

```
Quick Actions:
├─ Add extension (URL, file, or list) ⚡
├─ Update all my extensions 🔄
├─ Setup new machine 💻
├─ Fix problems (doctor) 🏥
└─ Advanced options... ⚙️
    ├─ Download only (no install)
    ├─ Export installed
    ├─ Uninstall extensions
    ├─ Check versions
    ├─ Manage backups
    └─ Configuration
```

**Benefits:**

- 80/20 rule: Most common actions visible
- Less cognitive load
- Advanced users can still access everything
- Task-oriented not command-oriented
- Only one sub-prompt per flow (the plan), then go

**Implementation (using Clack):**

```typescript
import { intro, outro, select, isCancel } from "@clack/prompts";

intro("VSIX Extension Manager v2.0");

const action = await select({
  message: "What would you like to do?",
  options: [
    { value: "add", label: "Add extension (URL, file, or list) ⚡" },
    { value: "update", label: "Update all my extensions 🔄" },
    { value: "setup", label: "Setup new machine 💻" },
    { value: "doctor", label: "Fix problems (doctor) 🏥" },
    { value: "advanced", label: "Advanced options... ⚙️" },
  ],
});

if (isCancel(action)) {
  outro("Goodbye!");
  process.exit(0);
}

// Handle selected action...
```

---

## Phase 2: Intelligence (Quality of Life)

**Goal:** Quality of life improvements and automation  
**Estimated Effort:** 3-4 weeks  
**User Impact:** High - Reduces friction and manual work

### 7. Unified Global Flags

**Make common flags global and consistent across commands:**

- `--editor`, `--code-bin`, `--cursor-bin`, `--allow-mismatched-binary`
- `--quiet`, `--json`, `--yes`
- `--source`, `--pre-release`
- `--parallel`, `--retry`, `--retry-delay`

**Document precedence clearly:**

- CLI flags > env `VSIX_*` > config file > defaults
- Add `--debug-config` to show "effective config" snippet
- Display in help output and README

---

### 8. First-Run Guided Setup

**Current:** Users must know what to do.

**Proposed:** First-run wizard for configuration (60 seconds).

```bash
# First time running
vsix-extension-manager <any-command>

👋 Welcome to VSIX Extension Manager!

Let's set up your preferences (2 minutes):

1️⃣  Which editor do you use primarily?
   › Cursor
     VS Code
     Both

2️⃣  Enable safety features? (Recommended)
   ✓ Check compatibility before installing
   ✓ Automatic backups before updates
   ✓ Verify download checksums

3️⃣  Performance preferences:
   Parallel downloads: [3] (1-10)
   Parallel installs: [1] (1-5)

4️⃣  Create config file?
   › Yes, in home directory (~/.vsix/config.yml)
     Yes, in project (.vsix.yml)
     No, use defaults

✅ Setup complete! Run 'vsix-extension-manager help' to get started.
```

**Implementation:** Stores minimal config using existing loader (`src/config/loader.ts`).

---

### 9. Unified Configuration System

**Concept:** Single source of truth with smart discovery and profiles.

**Proposed Structure:**

```yaml
# ~/.vsix/config.yml (or project root .vsix.yml)

# Editor preferences (auto-detected if not set)
editor:
  prefer: cursor # Preference when multiple found
  cursor-binary: auto # auto | explicit path
  vscode-binary: auto

# Safety features (enabled by default)
safety:
  check-compatibility: true # Check before install
  auto-backup: true # Backup before update
  verify-checksums: true # Verify downloads

# Performance
performance:
  parallel-downloads: 3
  parallel-installs: 1

# Behavior
behavior:
  skip-installed: ask # ask | always | never
  update-check: weekly # never | daily | weekly
  auto-retry: true

# Active profile
active-profile: production

# Profiles for different use cases
profiles:
  production:
    safety:
      check-compatibility: true
    behavior:
      skip-installed: always
    performance:
      parallel-installs: 1
  development:
    safety:
      check-compatibility: false
    performance:
      parallel-installs: 3
```

**Switch profiles:** `--profile <name>` or env variable.

**Benefits:**

- Single file, clear structure
- Profiles for different scenarios
- Defaults explained with comments
- Easy to share across team

**Configuration Migration:**

Auto-migration for config files:

```typescript
// New: src/config/migrator.ts
export class ConfigMigrator {
  async migrateConfig(oldConfig: OldConfig): Promise<NewConfig> {
    // Automatically converts old format to new
    // Preserves user settings
    // Adds helpful comments
  }
}
```

Users will see:

```
✅ Configuration migrated to new format
   Old config backed up: ~/.vsix/config.yml.backup
   Review changes: ~/.vsix/config.yml
```

---

### 10. Smart Retry & Recovery (Automatic Escalation)

**Current:** Manual retry on failure.

**Proposed:** Automatic retry with escalating strategies.

**Flow:**

```
Installation failed (Timeout)
  ↓
Retry 1: Increase timeout (30s → 60s)
  ↓ Failed
Retry 2: Direct installation (bypass CLI)
  ↓ Failed
Retry 3: Download only + manual install prompt
  ↓ Failed
Offer: Skip, Abort batch, or Debug
```

**Strategy Ladder:**

1. Increase timeout
2. Retry N times with backoff
3. Switch to direct install fallback
4. Offer "download-only for manual install"

**Implementation:**

```typescript
// Enhanced: src/features/install/services/installService.ts
export class SmartRetryService {
  private strategies: RetryStrategy[] = [
    new TimeoutIncreaseStrategy(),
    new DirectInstallStrategy(),
    new DownloadOnlyStrategy(),
    new ManualInterventionStrategy(),
  ];

  async installWithSmartRetry(task: InstallTask, options: InstallOptions): Promise<InstallResult> {
    let lastError: Error;

    for (const strategy of this.strategies) {
      try {
        return await strategy.attempt(task, options);
      } catch (error) {
        lastError = error;
        if (!(await this.shouldContinue(error, strategy))) {
          break;
        }
      }
    }

    // All strategies failed - offer intervention
    return await this.handleFailure(task, lastError);
  }
}
```

**Output:** Emit a single, concise summary at the end.

---

### 11. JSON Output Contract (Standardized)

**Standardize JSON structures across commands so scripts can rely on them:**

```json
{
  "status": "ok|error",
  "summary": "Human-readable summary",
  "items": [
    {
      "id": "ms-python.python",
      "version": "2024.2.0",
      "status": "success|failed|skipped",
      "duration": 1234
    }
  ],
  "errors": [
    {
      "code": "TIMEOUT",
      "message": "Installation timeout",
      "item": "ms-python.python"
    }
  ],
  "warnings": [],
  "totals": {
    "success": 5,
    "failed": 1,
    "skipped": 2,
    "duration": 45678
  }
}
```

**Always include:**

- `status` (ok|error), `summary`, `items`, `errors`, `warnings`
- Durations and counts; IDs for each item
- For downloads: resolved version, final filename, destination
- For installs: editor, binary path, exit code when applicable

---

### 12. Update Notifications (Passive Awareness)

**Current:** Manual check for updates.

**Proposed:** Passive notifications with smart scheduling.

**Implementation:**

```bash
# On any command execution (cached, weekly check)
vsix-extension-manager <any-command>

💡 3 extension updates available
   Run 'vsix-extension-manager update' to review
   (Checked 2 days ago, will check again in 5 days)
```

**Smart scheduling:**

```typescript
// New: src/core/updateChecker.ts
export class UpdateChecker {
  async checkInBackground(frequency: "daily" | "weekly" | "never") {
    const lastCheck = await this.getLastCheckTime();
    const now = Date.now();

    if (this.shouldCheck(lastCheck, now, frequency)) {
      // Non-blocking background check
      this.queueCheck();
    }
  }

  async getUpdateSummary(): Promise<UpdateSummary> {
    // Returns cached results
    // Doesn't block user's command
  }
}
```

**Benefits:** Non-blocking, cached weekly check. No telemetry needed.

---

## Phase 3: Advanced Features (Team & Workflows)

**Goal:** Team workflows and advanced features  
**Estimated Effort:** 4-6 weeks  
**User Impact:** High - New capabilities, broader use cases

### 13. Workspace Mode - Project-Specific Extensions

**Current:** Global extensions only.

**Proposed:** Workspace-specific extension management.

**New Feature:**

```bash
# Initialize workspace extensions
vsix-extension-manager workspace init

# Created: .vsix/workspace.yml
```

```yaml
# .vsix/workspace.yml
name: "My Project"
description: "React + TypeScript frontend"

extensions:
  required:
    - ms-vscode.vscode-typescript-next
    - dbaeumer.vscode-eslint
    - esbenp.prettier-vscode

  recommended:
    - eamodio.gitlens
    - streetsidesoftware.code-spell-checker

  disabled: # Disable for this workspace
    - ms-python.python

settings:
  auto-install-required: true
  prompt-for-recommended: true
```

**Commands:**

```bash
# Install workspace extensions
vsix-extension-manager workspace install

# Add extension to workspace
vsix-extension-manager workspace add <extension> --required
```

**Benefits:**

- Project-specific extensions
- Onboarding made easy
- Team consistency
- Version control friendly
- `add` honors workspace config when called inside a workspace

---

### 14. Template Library - Curated Extension Packs

**Current:** Users create lists manually.

**Proposed:** Curated templates for common setups.

```bash
# Browse templates
vsix-extension-manager templates

Available Templates:
  1. web-frontend      - React/Vue/Angular development
  2. web-backend       - Node.js/Express backend
  3. python-data       - Data science & ML
  4. devops            - Docker, K8s, CI/CD tools
  5. mobile            - React Native, Flutter
  6. minimal           - Essential dev tools only

# Use template
vsix-extension-manager templates use web-frontend

📦 Installing Web Frontend Development Pack
   - ESLint
   - Prettier
   - TypeScript
   - GitLens
   - Auto Rename Tag
   - Path Intellisense

Continue? (Y/n)
```

**Implementation:**

**Registry Approach:** No backend needed. Templates are bundled with the CLI in the repo.

**Repository Structure:**

```
vsix-extension-manager/
  templates/
    registry.json              # Index of all templates
    web-frontend.yml           # Template definition
    web-backend.yml
    python-data.yml
    devops.yml
    mobile.yml
    minimal.yml
    README.md                  # Contribution guide
```

**Template Definition (YAML):**

```yaml
# templates/web-frontend.yml
id: web-frontend
name: Web Frontend Development
description: Essential tools for React/Vue/Angular development
category: web
author: vsix-extension-manager
version: 1.0.0

extensions:
  required:
    - dbaeumer.vscode-eslint
    - esbenp.prettier-vscode
    - ms-vscode.vscode-typescript-next

  recommended:
    - eamodio.gitlens
    - formulahendry.auto-rename-tag
    - christian-kohler.path-intellisense
    - bradlc.vscode-tailwindcss

workspace:
  settings:
    auto-install-required: true
    prompt-for-recommended: true
```

**Registry Index (JSON):**

```json
{
  "version": "1.0.0",
  "templates": [
    {
      "id": "web-frontend",
      "file": "web-frontend.yml",
      "name": "Web Frontend Development",
      "category": "web",
      "tags": ["react", "vue", "angular", "typescript"]
    },
    {
      "id": "web-backend",
      "file": "web-backend.yml",
      "name": "Web Backend Development",
      "category": "web",
      "tags": ["node", "express", "api"]
    }
  ]
}
```

**TypeScript Implementation:**

```typescript
// New: src/features/templates/
export interface Template {
  id: string;
  name: string;
  description: string;
  category: string;
  author: string;
  version: string;
  extensions: {
    required: string[];
    recommended?: string[];
  };
  workspace?: WorkspaceConfig;
}

export class TemplateService {
  private templatesDir = path.join(__dirname, "../../../templates");

  // Load templates from bundled files
  async listTemplates(): Promise<Template[]> {
    const registry = await this.loadRegistry();
    return registry.templates.map((t) => this.loadTemplate(t.file));
  }

  async applyTemplate(templateId: string): Promise<void> {
    const template = await this.loadTemplate(`${templateId}.yml`);
    // Use existing install flows
    await installFromList(template.extensions.required);
  }

  private async loadRegistry(): Promise<RegistryIndex> {
    // Read templates/registry.json (bundled with CLI)
  }

  private async loadTemplate(filename: string): Promise<Template> {
    // Read and parse YAML from templates/ folder
  }
}
```

**Community Contributions:**

New templates added via PRs:

1. Create template YAML file in `templates/`
2. Update `templates/registry.json` index
3. Add documentation in `templates/README.md`
4. Submit PR with template + rationale

**Benefits:**

- No backend infrastructure needed
- Templates versioned with CLI releases
- Community can contribute via simple PRs
- Easy to review and maintain
- Works offline (bundled with package)
- Can be customized locally by users

---

### 15. Task-Oriented Command Aliases

**Concept:** Intuitive command names that match user mental models, aliasing existing functionality.

**Command Aliases (no new features, just better UX):**

```bash
# Alias for 'add' - more intuitive for first-time users
vsix-extension-manager get <url|id|file>
# → Same as 'add' command

# Alias for 'update' - clearer intent
vsix-extension-manager upgrade [extension-id]
# → Same as 'update' command

# Workspace setup (from section 13)
vsix-extension-manager workspace init
# → Creates .vsix/workspace.yml

vsix-extension-manager workspace install
# → Installs workspace-defined extensions
```

**Rationale:**

- Users think in different terms: "get" vs "add", "upgrade" vs "update"
- Aliases cost almost nothing to maintain
- Makes CLI more approachable for different user backgrounds
- All aliases point to existing command implementations

**Implementation:**

```typescript
// Simple command routing in src/index.ts
const aliases = {
  get: "add",
  upgrade: "update",
};

const command = aliases[userCommand] || userCommand;
```

**Benefits:**

- Zero maintenance overhead (just routing)
- Speaks multiple user "languages"
- Reduces friction for newcomers
- Documents itself via help system

---

## New Command Structure (v2.0)

**Complete redesign of the command structure** - old commands are replaced with task-oriented commands.

### Core Commands

| Command          | Purpose                                     | Replaces                                                              |
| ---------------- | ------------------------------------------- | --------------------------------------------------------------------- |
| `add <input>`    | Universal entry point - installs extensions | `download`, `install`, `quick-install`, `from-list`, `install-direct` |
| `remove <id>`    | Uninstall extensions                        | `uninstall`                                                           |
| `update [id]`    | Update extensions (all or specific)         | `update-installed`                                                    |
| `list`           | List installed extensions                   | `export-installed` (with `--format json\|txt\|yaml`)                  |
| `search <query>` | Search marketplace                          | _(new)_                                                               |
| `info <id>`      | Show extension details                      | `versions` (enhanced)                                                 |
| `doctor`         | Health check & auto-fix                     | _(new)_                                                               |

### Specialized Commands

| Command              | Purpose                      | Notes    |
| -------------------- | ---------------------------- | -------- |
| `workspace init`     | Initialize workspace config  | _(new)_  |
| `workspace install`  | Install workspace extensions | _(new)_  |
| `workspace add <id>` | Add to workspace config      | _(new)_  |
| `templates`          | List available templates     | _(new)_  |
| `templates use <id>` | Apply template               | _(new)_  |
| `rollback`           | Rollback to previous state   | _(kept)_ |

### Interactive Mode

```bash
# No arguments = interactive mode (simplified menu)
vsix-extension-manager

# Interactive menu structure:
┌─────────────────────────────────┐
│ VSIX Extension Manager v2.0     │
├─────────────────────────────────┤
│ → Add extension                 │
│   Update extensions             │
│   Remove extensions             │
│   List installed                │
│   Search marketplace            │
│   Templates                     │
│   Workspace setup               │
│   Health check (doctor)         │
│   Settings                      │
│   Quit                          │
└─────────────────────────────────┘
```

### Command Examples

```bash
# Add from URL
vsix add https://marketplace.visualstudio.com/.../python

# Add by ID
vsix add ms-python.python

# Add from file
vsix add ./extension.vsix

# Add from directory
vsix add ./downloads

# Add from list
vsix add extensions.txt

# Download only (no install)
vsix add ms-python.python --download-only

# Update all
vsix update

# Update specific
vsix update ms-python.python

# Remove
vsix remove ms-python.python

# List installed
vsix list

# List as JSON
vsix list --json

# Export to file
vsix list --output extensions.txt

# Search
vsix search python

# Info
vsix info ms-python.python

# Health check
vsix doctor
vsix doctor --fix

# Templates
vsix templates
vsix templates use web-frontend

# Workspace
vsix workspace init
vsix workspace install
vsix workspace add ms-python.python --required
```

---

## New Flag System (v2.0)

**Simplified, consistent flags across all commands.** Old flag names are removed in favor of clear, standardized options.

### Global Flags (All Commands)

| Flag              | Short | Description                                | Old Equivalent |
| ----------------- | ----- | ------------------------------------------ | -------------- |
| `--editor <name>` | `-e`  | Target editor (`cursor`, `vscode`, `auto`) | Same           |
| `--quiet`         | `-q`  | No prompts, minimal output                 | Same           |
| `--json`          | `-j`  | JSON output                                | Same           |
| `--yes`           | `-y`  | Auto-confirm all prompts                   | Same           |
| `--debug`         |       | Debug logging                              | `--verbose`    |
| `--help`          | `-h`  | Show help                                  | Same           |
| `--version`       | `-v`  | Show version                               | Same           |

### Editor Flags

| Flag                  | Description                        | Old Equivalent              |
| --------------------- | ---------------------------------- | --------------------------- |
| `--editor <name>`     | Editor: `cursor`, `vscode`, `auto` | Same                        |
| `--code-bin <path>`   | VS Code binary path                | Same                        |
| `--cursor-bin <path>` | Cursor binary path                 | Same                        |
| `--allow-mismatch`    | Allow binary mismatch              | `--allow-mismatched-binary` |

### Source & Version Flags

| Flag              | Description                                 | Old Equivalent |
| ----------------- | ------------------------------------------- | -------------- |
| `--source <name>` | Registry: `marketplace`, `open-vsx`, `auto` | Same           |
| `--version <ver>` | Specific version                            | Same           |
| `--pre-release`   | Use pre-release version                     | Same           |

### Behavior Flags

| Flag               | Description                 | Old Equivalent    |
| ------------------ | --------------------------- | ----------------- |
| `--download-only`  | Download without installing | `--no-install`    |
| `--skip-installed` | Skip already installed      | Same              |
| `--force`          | Force reinstall/overwrite   | `--reinstall`     |
| `--output <path>`  | Output directory or file    | `--out-dir`, `-o` |

### Performance Flags

| Flag                 | Description                | Old Equivalent       |
| -------------------- | -------------------------- | -------------------- |
| `--parallel <n>`     | Parallel operations (1-10) | `--install-parallel` |
| `--timeout <sec>`    | Timeout in seconds         | Same                 |
| `--retry <n>`        | Retry attempts             | Same                 |
| `--retry-delay <ms>` | Delay between retries      | Same                 |

### Safety Flags

| Flag                | Description              | Old Equivalent           |
| ------------------- | ------------------------ | ------------------------ |
| `--check-compat`    | Check compatibility      | `--check-compatibility`  |
| `--no-backup`       | Skip automatic backup    | _(new)_                  |
| `--verify-checksum` | Verify download checksum | _(new, auto by default)_ |

### Output Formatting

| Flag                     | Description                            | Old Equivalent |
| ------------------------ | -------------------------------------- | -------------- |
| `--json`                 | JSON output                            | Same           |
| `--format <type>`        | Format: `json`, `yaml`, `txt`, `table` | _(new)_        |
| `--color` / `--no-color` | Force color on/off                     | _(new)_        |

### Special Flags

| Flag               | Description                           | Notes   |
| ------------------ | ------------------------------------- | ------- |
| `--plan`           | Show execution plan (dry-run preview) | _(new)_ |
| `--dry-run`        | Validate only, no execution           | _(new)_ |
| `--profile <name>` | Use config profile                    | _(new)_ |
| `--config <path>`  | Config file path                      | _(new)_ |

### Flag Combinations Examples

```bash
# Quiet CI install
vsix add extensions.txt --editor cursor --quiet --json

# Force reinstall with pre-release
vsix add ms-python.python --force --pre-release

# Download only to custom directory
vsix add ms-python.python --download-only --output ./cache

# Show plan without execution
vsix add extensions.txt --plan

# Update with specific settings
vsix update --parallel 3 --retry 2 --timeout 60

# Export list as YAML
vsix list --format yaml --output extensions.yml

# Install with compatibility check
vsix add ./ext.vsix --check-compat --editor cursor
```

### Removed Flags

These flags are **removed** in v2.0:

| Old Flag                    | Reason        | Alternative                                       |
| --------------------------- | ------------- | ------------------------------------------------- |
| `--url <url>`               | Redundant     | Use positional: `vsix add <url>`                  |
| `--vsix <file>`             | Redundant     | Use positional: `vsix add <file>`                 |
| `--file <list>`             | Redundant     | Use positional: `vsix add <list>`                 |
| `--dir <path>`              | Redundant     | Use positional: `vsix add <dir>`                  |
| `--id <id>`                 | Redundant     | Use positional: `vsix add <id>`                   |
| `--install-after`           | Confusing     | Default is install; use `--download-only` to skip |
| `--download-missing`        | Auto behavior | Downloads automatically when needed               |
| `--no-install`              | Naming        | Use `--download-only`                             |
| `--reinstall`               | Naming        | Use `--force`                                     |
| `--verbose`                 | Naming        | Use `--debug`                                     |
| `--check-compatibility`     | Too long      | Use `--check-compat`                              |
| `--allow-mismatched-binary` | Too long      | Use `--allow-mismatch`                            |
| `--install-parallel`        | Inconsistent  | Use `--parallel`                                  |
| `-o` for editor             | Confusing     | Use `-e` or `--editor`                            |
| `--out-dir`                 | Inconsistent  | Use `--output`                                    |

---

## Technical Specifications

### Plan Object (JSON Contract)

```json
{
  "input": {
    "type": "url|vsix|dir|list|id",
    "value": "..."
  },
  "resolve": {
    "source": "marketplace|open-vsx|auto",
    "version": "latest|<semver>",
    "preRelease": false
  },
  "target": {
    "editor": "cursor",
    "binary": "/path/to/bin"
  },
  "steps": ["download", "install"],
  "safety": {
    "compatibility": "auto|manual|skip",
    "checksum": false
  },
  "performance": {
    "parallel": 1,
    "retry": 2,
    "retryDelay": 1000
  },
  "outputs": {
    "directory": "./downloads",
    "filename": "publisher.name-<v>.vsix"
  }
}
```

### UI/UX Implementation with Clack

**All interactive UI elements will be implemented using [Clack](https://github.com/bombshell-dev/clack)** - a modern CLI prompts library that provides beautiful, accessible components.

**Why Clack:**

- Beautiful, consistent UI components out of the box
- Excellent TypeScript support
- Comprehensive set of prompt types
- Built-in cancellation handling
- Progress indicators and spinners
- Task management with visual feedback

**Clack Components We'll Use:**

| UI Element in Sketches | Clack Component                              | Usage                             |
| ---------------------- | -------------------------------------------- | --------------------------------- |
| Plan Preview Screen    | `log.message()` + `confirm()`                | Display plan and get confirmation |
| Interactive Menu       | `select()`                                   | Main menu and option selection    |
| Multi-step Prompts     | `group()`                                    | Organize related prompts together |
| Progress Indicators    | `spinner()`, `progress()`                    | Download/install progress         |
| Confirmation Dialogs   | `confirm()`                                  | Yes/no decisions                  |
| Text Input             | `text()`                                     | URL, path, or ID input            |
| Multi-select Lists     | `multiselect()`                              | Select multiple extensions        |
| Status Messages        | `log.info()`, `log.success()`, `log.error()` | Feedback messages                 |
| Task Execution         | `tasks()`                                    | Batch operations with progress    |
| Error Recovery Prompts | `select()` with options                      | Automated recovery choices        |

**Implementation Pattern:**

```typescript
// Example: Plan Preview + Confirmation
import { intro, outro, confirm, log, spinner } from "@clack/prompts";

intro("📦 Installation Plan");

log.message(`
Extension: ms-python.python
Version: 2024.2.0 (latest)
Target: Cursor (v0.41.0)
Steps: Download → Install
`);

const shouldContinue = await confirm({
  message: "Continue with installation?",
});

if (!shouldContinue) {
  outro("Installation cancelled");
  process.exit(0);
}

const s = spinner();
s.start("Downloading extension...");
// ... download logic
s.stop("Download complete!");

outro("✅ Installation complete!");
```

**All UI sketches in this document map directly to Clack components.** Reference: [Clack Documentation](https://context7.com/bombshell-dev/clack/llms.txt)

---

### Input Detection Rules (Detailed)

**Detection Order (priority):**

1. URL (Marketplace/OpenVSX) → `parseExtensionUrl`
2. Existing file path → if `.vsix` → file; if `.json` or `.txt` → list
3. Existing directory path → directory
4. Pattern `publisher.name` → extension ID

**Ambiguity Resolution:**

- File paths checked before IDs
- On conflict in interactive mode: show Plan with detected type and allow "Customize"
- In quiet/json: error with guidance

### Prompt Policy Matrix (Reference)

| Mode        | Prompts                                                   | Notes                                       |
| ----------- | --------------------------------------------------------- | ------------------------------------------- |
| Interactive | 1 plan prompt + essential confirmations (e.g., overwrite) | Default mode                                |
| Quiet       | 0                                                         | Missing inputs → fail fast with clear error |
| JSON        | 0                                                         | Output plan/results as JSON                 |

**Multiple editors detected:**

- Interactive: selection prompt with identity badges (OK/MISMATCH)
- Quiet/JSON: require `--editor`, else error

---

## Implementation Strategy

### Refactor Approach

**This is a complete rewrite, not an incremental update.** We're building v2.0 from the ground up with breaking changes from v1.16.0.

### Implementation Notes (Dev-Facing)

**Command Layer Refactor:**

- Delete old command files: `download.ts`, `install.ts`, `quick-install.ts`, `from-list.ts`, `installDirect.ts`, `exportInstalled.ts`, `updateInstalled.ts`, `uninstallExtensions.ts`
- Create new command files: `add.ts`, `remove.ts`, `update.ts`, `list.ts`, `search.ts`, `info.ts`, `doctor.ts`
- Refactor `interactive.ts` with simplified menu structure
- Keep `rollback.ts` (unchanged)

**Core Services (Reuse):**

- Keep all `src/features/*` services - these are the business logic
- Keep all `src/core/*` utilities - filesystem, http, registry, validation
- Refactor `src/core/ui/` for new plan preview system using **Clack** components
- Enhance `src/core/errors/handler.ts` with better suggestions
- Migrate all prompts to **Clack** (`@clack/prompts`) for consistent, beautiful UI

**New Additions:**

- `src/commands/workspace.ts` - Workspace management
- `src/commands/templates.ts` - Template system
- `src/features/templates/` - Template service and loader
- `src/core/ui/plan.ts` - Unified plan preview
- `src/config/migrator.ts` - Config migration utility

**Flag System:**

- Complete rewrite of CLI argument parsing in `src/index.ts`
- Remove all old flag names, implement new standardized flags
- Update all command signatures to use new flags

**Dependencies:**

- `@clack/prompts` (already in dependencies at v0.7.0) - Use for all interactive UI components
- Fully migrate from any other prompt libraries to Clack
- All UI sketches will be implemented with Clack components
- Reference: [Clack Documentation](https://context7.com/bombshell-dev/clack/llms.txt)

### Phased Development

**Phase 1: Core Refactor (3-4 weeks)**

Week 1-2: Command structure

1. Implement new `add` command with smart routing
2. Implement `remove`, `update`, `list` commands
3. Refactor interactive menu
4. Remove old command files
5. Update all flag parsing
6. **Migrate to Clack** - Replace existing prompts with `@clack/prompts`

Week 3-4: UX improvements

1. Plan preview system (using Clack `log.message()` + `confirm()`)
2. Context-aware error messages (using Clack `log` utilities)
3. Health check (`doctor`) command (using Clack `select()` for auto-fix options)
4. First-run wizard (using Clack `group()` for multi-step setup)
5. Update notifications (using Clack `log.info()` with spinner)

**Phase 2: Quality of Life (3-4 weeks)**

Week 1-2: Configuration

1. Unified config system with profiles
2. Config migration tool
3. Smart retry & recovery
4. JSON output standardization

Week 3-4: Polish

1. Consistent prompting across all modes
2. Better editor detection and mismatch handling
3. Performance optimizations
4. Documentation rewrite

**Phase 3: Advanced Features (4-6 weeks)**

Week 1-2: Workspace mode

1. Workspace config system
2. Workspace commands
3. Project-specific extension management

Week 3-4: Templates & extras

1. Template registry and loader
2. Template application system
3. Search command
4. Info command enhancements

Week 5-6: Testing & polish

1. Comprehensive testing
2. Migration guide
3. Documentation
4. Release preparation

### Migration Tooling

**Auto-detection of old usage patterns:**

When users run old commands, show clear migration message:

```bash
$ vsix-extension-manager download --url "..."

❌ Error: Command 'download' no longer exists in v2.0

📚 Migration Guide:
   Old (v1.x): vsix-extension-manager download --url <url>
   New (v2.0): vsix add <url>

   See migration guide: https://github.com/.../MIGRATION.md
```

**Config auto-migration:**

On first run of v2.0, detect and migrate old config files:

```
✅ Detected v1.x configuration
🔄 Migrating to v2.0 format...
✅ Migration complete!

   Old config backed up: ~/.vsix/config.v1.backup
   New config: ~/.vsix/config.yml
```

### Power User Features

**All advanced capabilities preserved:**

- Direct binary paths (`--code-bin`, `--cursor-bin`)
- Retry controls (`--retry`, `--retry-delay`, `--timeout`)
- Parallel settings (`--parallel`)
- Non-interactive modes (`--yes`, `--quiet`, `--json`)
- Force operations (`--force`, `--allow-mismatch`)
- Custom output (`--output`, `--format`)

**New power features:**

- Plan preview (`--plan`)
- Dry-run mode (`--dry-run`)
- Config profiles (`--profile`)
- Debug mode (`--debug`)

---

## Breaking Changes & Migration

### ⚠️ Breaking Changes in v2.0

**v2.0 is a complete refactor with breaking changes from v1.16.0.** Old commands and flags are removed.

### What's Removed

**Commands removed:**

- `download` → Use `add <input> --download-only`
- `install` → Use `add <input>`
- `quick-install` → Use `add <input>`
- `from-list` → Use `add <list-file>`
- `install-direct` → Use `add <input>` (auto-detects method)
- `export-installed` → Use `list --output <file>`
- `update-installed` → Use `update`
- `uninstall` → Use `remove <id>`

**Flags removed:**

- `--url`, `--vsix`, `--file`, `--dir`, `--id` → Use positional args
- `--install-after` → Default behavior; use `--download-only` to skip
- `--download-missing` → Auto behavior
- `--no-install` → Use `--download-only`
- `--reinstall` → Use `--force`
- `--verbose` → Use `--debug`
- `--check-compatibility` → Use `--check-compat`
- `--allow-mismatched-binary` → Use `--allow-mismatch`
- `--install-parallel` → Use `--parallel`
- `--out-dir` → Use `--output`

### Migration Guide

**Quick Command Reference:**

| v1.x Command                   | v2.0 Command                |
| ------------------------------ | --------------------------- |
| `download --url <url>`         | `add <url> --download-only` |
| `install --vsix <file>`        | `add <file>`                |
| `quick-install --url <url>`    | `add <url>`                 |
| `from-list --file <list>`      | `add <list>`                |
| `install --dir <dir>`          | `add <dir>`                 |
| `export-installed -o list.txt` | `list --output list.txt`    |
| `update-installed`             | `update`                    |
| `uninstall <id>`               | `remove <id>`               |
| `versions <id>`                | `info <id>`                 |

**Common Flag Migrations:**

| v1.x Flag                   | v2.0 Flag          |
| --------------------------- | ------------------ |
| `--verbose`                 | `--debug`          |
| `--reinstall`               | `--force`          |
| `--check-compatibility`     | `--check-compat`   |
| `--allow-mismatched-binary` | `--allow-mismatch` |
| `--install-parallel <n>`    | `--parallel <n>`   |
| `--out-dir <path>`          | `--output <path>`  |
| `--no-install`              | `--download-only`  |

**Examples:**

```bash
# Install from URL
# Old:
vsix-extension-manager download --url "https://..." --version latest
vsix-extension-manager install --vsix ./downloads/file.vsix

# New:
vsix add "https://..."

# Install from list
# Old:
vsix-extension-manager from-list --file extensions.txt --install-after

# New:
vsix add extensions.txt

# Export installed
# Old:
vsix-extension-manager export-installed -o extensions.txt

# New:
vsix list --output extensions.txt

# Update all
# Old:
vsix-extension-manager update-installed

# New:
vsix update

# Uninstall
# Old:
vsix-extension-manager uninstall ms-python.python

# New:
vsix remove ms-python.python
```

### What's Preserved

**No breaking changes to:**

- Core functionality (all features still work)
- Extension compatibility
- Downloaded VSIX files (format unchanged)
- Installation mechanism
- Editor detection
- Rollback/backup system

**Config values preserved:**

- Editor preferences
- Binary paths
- Timeout settings
- Parallel settings
- All user preferences

Only the **command/flag interface** changes - the underlying functionality is the same or better.

---

## Success Metrics

### Quantitative Metrics

- **Steps to install from URL:** 6+ → 2 (type + confirm) - 67% reduction
- **Time to first extension:** 2 min → 30 sec - 75% reduction
- **Error recovery success:** 20% → 80% - 4x improvement
- **Configuration issues:** Reduce by 60%
- **Support tickets:** Reduce by 40%
- **Reduction in "why didn't it install?" issues** (PATH/editor mismatch) by proactive suggestions
- **Higher usage of `add` over split commands**

### Qualitative Metrics

- User surveys: "Easy to use" rating
- First-time user completion rate
- Advanced feature discoverability
- Documentation page views (should decrease)
- Fewer support questions about flags

---

## User Testing Plan

### Phase 1: Prototype Testing

- **Participants:** 5 first-time users, 5 experienced users
- **Tasks:**
  1. Install extension from URL
  2. Setup new machine from list
  3. Update all extensions
  4. Recover from failed installation
- **Metrics:** Time to complete, errors encountered, satisfaction score

### Phase 2: Beta Testing

- **Participants:** 50 volunteers (mixed experience)
- **Duration:** 2 weeks
- **Collection:** Usage telemetry (opt-in), feedback surveys
- **Focus:** Real-world workflows, edge cases

### Phase 3: Public Release

- **Rollout:** Gradual feature flags
- **Monitoring:** Error rates, command usage distribution
- **Feedback:** GitHub issues, Discord channel

---

## Risks & Mitigations

### Risk 1: Router Misclassification

- **Risk:** Input detection might misidentify input type
- **Mitigation:** Show plan with detected type and allow quick correction; quiet/json: fail clearly with guidance

### Risk 2: Plan Preview Perceived as Extra Step

- **Risk:** Users might see confirmation as unnecessary friction
- **Mitigation:** Default to showing once; `-y` skips; cache last choices when appropriate

### Risk 3: Feature Creep in Phase 3

- **Risk:** Too many features dilute core value
- **Mitigation:** Keep Phase 1 small and shippable; measure impact before further changes

### Risk 4: Configuration Migration Issues

- **Risk:** Auto-migration might lose user settings
- **Mitigation:** Always backup old config; preserve all settings; add helpful comments explaining changes

---

## Conclusion

These UX improvements focus on **reducing cognitive load**, **minimizing steps**, and **increasing predictability** while maintaining the power and flexibility that makes VSIX Extension Manager valuable.

**Key Principles Achieved:**

1. **Smart defaults** - Do the right thing automatically
2. **Progressive disclosure** - Simple first, advanced when needed
3. **Predictable behavior** - Consistent across modes
4. **Fail-forward** - Automated recovery and helpful guidance
5. **Task-oriented** - Workflows over commands
6. **Clean slate** - Complete refactor, new simplified interface

**This is a complete refactor (v2.0) with breaking changes from v1.16.0.** We're not maintaining backward compatibility - instead, we're building the CLI we wish we had from the start. Common workflows become one-liners with a single confirmation. All behavior is unified and predictable. Recovery is automated. The internals already support most of this functionality; the primary work is reorganizing the command structure, standardizing flags, and improving the UX layer.

**All interactive UI elements will be implemented using Clack** (`@clack/prompts`) - a modern, beautiful CLI framework that provides consistent, accessible components. Every UI sketch in this document maps directly to Clack components, ensuring a polished, professional user experience.

**The result:** A dramatically simpler, more intuitive CLI that's easier to learn, use, and maintain - with a beautiful, consistent interface powered by Clack.

**Next Steps:**

1. Review and approve this breaking change proposal
2. Create detailed implementation specs for v2.0
3. Set up v2.0 development branch
4. Phase 1: Core refactor (commands + flags)
5. Phase 2: Quality of life improvements
6. Phase 3: Advanced features
7. Comprehensive testing and migration guide
8. v2.0 release with clear breaking change communication

---

## Appendices

### Appendix A: User Quotes (Research)

_Note: These are synthesized from common patterns in GitHub issues and user feedback_

> "I just want to install an extension. Why do I need to know about registries, sources, and download modes?"

> "It worked on my machine but failed in CI. Turns out I needed --quiet --json --editor cursor. How was I supposed to know?"

> "The error said 'installation failed' but didn't tell me what to do next. I just ran the command again."

> "I love the tool but I had to read the entire README to figure out the right flags."

> "Quick install is great! Why isn't it the default?"

---

### Appendix B: Command Comparison (v1.x → v2.0)

#### Before vs After (Breaking Changes)

| Task               | v1.x Commands (v1.16.0)                          | v2.0 Commands            | Improvement   |
| ------------------ | ------------------------------------------------ | ------------------------ | ------------- |
| Install from URL   | `download --url X`<br>`install --vsix file.vsix` | `add <url>`              | 2→1 commands  |
| Install from file  | `install --vsix file.vsix`                       | `add file.vsix`          | Cleaner       |
| Install from list  | `from-list --file X --install-after`             | `add list.txt`           | Simpler       |
| Install from dir   | `install --dir downloads`                        | `add downloads`          | Shorter       |
| Update extensions  | `update-installed`<br>(navigate menus)           | `update`                 | Fewer prompts |
| Export installed   | `export-installed -o list.txt`                   | `list --output list.txt` | Consistent    |
| Uninstall          | `uninstall <id>`                                 | `remove <id>`            | Clearer       |
| Check versions     | `versions <id>`                                  | `info <id>`              | Better name   |
| Health check       | Manual debugging                                 | `doctor --fix`           | Automated     |
| Workspace setup    | N/A                                              | `workspace init`         | New feature   |
| Template apply     | N/A                                              | `templates use <name>`   | New feature   |
| Search marketplace | N/A                                              | `search <query>`         | New feature   |

#### Flag Comparison

| v1.x Flag                   | v2.0 Flag             | Change     |
| --------------------------- | --------------------- | ---------- |
| `--url <url>`               | `<url>` (positional)  | Removed    |
| `--vsix <file>`             | `<file>` (positional) | Removed    |
| `--file <list>`             | `<list>` (positional) | Removed    |
| `--verbose`                 | `--debug`             | Renamed    |
| `--reinstall`               | `--force`             | Renamed    |
| `--check-compatibility`     | `--check-compat`      | Shortened  |
| `--allow-mismatched-binary` | `--allow-mismatch`    | Shortened  |
| `--install-parallel <n>`    | `--parallel <n>`      | Simplified |
| `--out-dir <path>`          | `--output <path>`     | Unified    |
| `--no-install`              | `--download-only`     | Clearer    |
| `--install-after`           | (default behavior)    | Removed    |
| `--download-missing`        | (auto behavior)       | Removed    |

---

### Appendix C: Configuration Evolution

#### Before (Multiple sources, unclear precedence)

```bash
# CLI
--editor cursor --skip-installed --parallel 3 --retry 2

# ENV
export VSIX_EDITOR=cursor
export VSIX_SKIP_INSTALLED=true

# FILE
{
  "editor": "cursor",
  "skipInstalled": true
}
```

#### After (Single source, clear structure)

```yaml
# ~/.vsix/config.yml
editor:
  prefer: cursor

behavior:
  skip-installed: always

performance:
  parallel-installs: 3
  retry-attempts: 2

# Or use profiles
active-profile: production

profiles:
  production:
    safety: high
    performance: conservative
  development:
    safety: medium
    performance: aggressive
```

---

### Appendix D: Example Flows

#### Install from URL (interactive)

```bash
vsix-extension-manager add "https://marketplace.visualstudio.com/items?itemName=ms-python.python"
```

Shows plan → confirm → download → install → summary.

#### Install from list (quiet CI)

```bash
vsix-extension-manager add ./extensions.txt --install --quiet --json --editor cursor
```

No prompts; prints JSON plan and results.

#### Download only to cache

```bash
vsix-extension-manager add ms-python.python --download-only --cache-dir ~/.vsix-cache
```

#### Diagnose environment

```bash
vsix-extension-manager doctor --fix
```

#### Apply template

```bash
vsix-extension-manager templates use web-frontend
```

#### Workspace setup

```bash
# In project directory
vsix-extension-manager workspace init
vsix-extension-manager workspace install
```

---

## Document Changelog

| Version | Date       | Changes                                                                                                                                                                                                                                                                                                                                                                                                        | Author       |
| ------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| 1.0     | 2025-10-01 | Initial comprehensive proposal                                                                                                                                                                                                                                                                                                                                                                                 | AI Assistant |
| 1.1     | 2025-10-01 | Refined focus on practical implementation                                                                                                                                                                                                                                                                                                                                                                      | AI Assistant |
| 1.2     | 2025-10-01 | Merged best elements: v1.0 detail + v1.1 technical precision                                                                                                                                                                                                                                                                                                                                                   | AI Assistant |
| 1.3     | 2025-10-01 | **Major update:** Changed to breaking changes approach (v2.0 complete refactor from v1.16.0). Added new command structure, new flag system, breaking changes & migration guide. Removed shareable-link features. Updated template registry to file-based approach. All version references updated from v3.0 to v2.0. Added Clack UI implementation details - all interactive elements will use @clack/prompts. | AI Assistant |

---

**Feedback & Discussion:**  
GitHub Discussions: [Link to discussion thread]  
Discord: #ux-improvements

**Document Status:**  
This is a living document. Feedback welcome!
