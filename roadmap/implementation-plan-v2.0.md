# VSIX Extension Manager v2.0 Implementation Plan

**Document Version:** 1.0  
**Date:** October 1, 2025  
**Based on:** UX Improvement Proposals v1.2  
**Target Release:** v2.0.0 (Breaking Changes Release)  
**Current Version:** v1.16.0

## Executive Summary

This document provides a detailed implementation plan for the complete refactor of VSIX Extension Manager from v1.16.0 to v2.0.0. This is a **breaking changes release** that completely rewrites the CLI interface while preserving core functionality.

**Total Estimated Duration:** 10-14 weeks  
**Team Size:** 1-2 developers  
**Risk Level:** Medium (interface refactor + service integration)

**Architecture Strategy:** **80% Reuse + 20% Reorganization**

- **Preserve:** All proven business logic in `features/` (25+ services)
- **Rewrite:** Command interface layer (`src/commands/*` + `src/index.ts`)
- **Enhance:** Configuration and UI systems
- **Migrate:** CLI surface from complex → simple

## ✅ Key Point: We're Building ON Your Foundation, Not Starting Over

**What STAYS (your excellent work):**

- ✅ **All 25+ services in `features/`** - installService, robustInstallService, extensionCompatibilityService, etc.
- ✅ **All `core/` utilities** - backup system, error handling, file operations, registry APIs
- ✅ **All business logic** - download orchestration, install strategies, compatibility checking
- ✅ **Configuration precedence** - Your CLI > ENV > FILE > DEFAULTS system
- ✅ **Error handling patterns** - withConfigAndErrorHandling wrapper and typed errors
- ✅ **Progress tracking** - Rich progress bars and time estimates
- ✅ **Safety features** - File locking, atomic operations, backup/rollback

**What CHANGES (interface only):**

- ❌ `src/commands/*.ts` - 11 commands become 7 simpler commands
- ❌ `src/index.ts` - Commander setup gets reorganized
- 🔄 Configuration schema - Enhanced but migration-compatible
- 🔄 CLI flags - Simplified but preserve all functionality

**Implementation Approach:**

1. **Extract & Rewrite** - Pull core logic from old commands, rewrite cleanly in new structure (no imports of legacy files)
2. **Service Integration** - New commands use your existing `features/` services directly (installService, downloadService, etc.)
3. **Pattern Preservation** - Keep your proven error handling, configuration loading, progress tracking patterns
4. **Zero Data Loss** - All advanced features preserved and enhanced in new command structure

**Result:** Same powerful capabilities, much simpler user interface. Your architecture becomes the engine behind a cleaner CLI.

## 🚀 Refactoring Philosophy: EXTRACT → REWRITE → DELETE

This implementation plan follows a **surgical refactoring approach**:

### ✅ What We PRESERVE (Your Proven Foundation)

- **`features/`** - All 25+ business logic services (installService, robustInstallService, etc.)
- **`core/`** - All utilities (backup, errors, filesystem, http, registry, ui, validation)
- **Working patterns** - Configuration precedence, error handling, progress tracking, safety features

### 🔄 What We REFACTOR (Extract + Enhance)

- **Extract core logic** from old commands, rewrite cleanly in new structure
- **Consolidate functionality** - 5 install-related commands become 1 smart `add` command
- **Enhance capabilities** - Add plan preview, auto-backup, smart retry, better error handling
- **Standardize interfaces** - Unified flag handling, consistent JSON output, predictable prompting

### ❌ What We DELETE (Legacy Command Layer Only)

- **9 old command files** - download.ts, quickInstall.ts, fromList.ts, install.ts, etc.
- **Redundant code** - Remove duplication between similar commands
- **Complex CLI surface** - Replace with simple, predictable interface

### 🆕 What We ADD (New Capabilities)

- **Smart routing** - Auto-detect input type, show execution plan
- **Workspace management** - Project-specific extension sets
- **Template system** - Curated extension packs for common setups
- **Health check** - Proactive problem detection and auto-fix

**This is surgical enhancement of your excellent codebase, not a rewrite from scratch.**

---

## Table of Contents

1. [Pre-Implementation Setup](#pre-implementation-setup)
2. [Phase 1: Foundation (Weeks 1-4)](#phase-1-foundation-weeks-1-4)
3. [Phase 2: Intelligence (Weeks 5-8)](#phase-2-intelligence-weeks-5-8)
4. [Phase 3: Advanced Features (Weeks 9-14)](#phase-3-advanced-features-weeks-9-14)
5. [Testing Strategy](#testing-strategy)
6. [Migration & Release Strategy](#migration--release-strategy)
7. [Risk Management](#risk-management)
8. [Technical Dependencies](#technical-dependencies)
9. [Success Criteria](#success-criteria)

---

## Pre-Implementation Setup

### Week 0: Project Preparation

#### Task 0.1: Environment Setup

- [ ] Create `feat/v2.0-refactor` branch from main
- [ ] Set up development environment for breaking changes
- [ ] Install required dependencies (ensure `@clack/prompts` is available)
- [ ] Create backup of current v1.16.0 codebase
- [ ] Document current API surface for migration guide

**Deliverables:**

- Development branch ready
- Dependency audit complete
- Baseline documentation

#### Task 0.2: Architecture Planning

- [ ] Review current codebase structure (`src/commands/*`, `src/features/*`, `src/core/*`)
- [ ] Identify reusable services and utilities
- [ ] Plan new directory structure
- [ ] Create technical specification document

**Refactoring Architecture (DELETE + REWRITE + PRESERVE):**

```
src/
├── commands/          # COMPLETE REWRITE (11 → 7 commands)
│   ├── add/              # 🆕 NEW (consolidates 5 old commands)
│   │   ├── index.ts         # Main unified command
│   │   ├── executor.ts      # REFACTOR: extract from quickInstall.ts + fromList.ts + install.ts
│   │   ├── inputDetector.ts # NEW: smart input type detection
│   │   └── planDisplay.ts   # NEW: plan preview with Clack
│   ├── remove.ts         # 🔄 REWRITE uninstallExtensions.ts (enhanced with backup)
│   ├── update.ts         # 🔄 REWRITE updateInstalled.ts (enhanced with rollback)
│   ├── list.ts           # 🔄 REWRITE exportInstalled.ts (enhanced with formats)
│   ├── info.ts           # 🔄 REWRITE versions.ts (enhanced with details)
│   ├── search.ts         # 🆕 NEW (marketplace search)
│   ├── doctor.ts         # 🆕 NEW (health check + auto-fix)
│   ├── workspace.ts      # 🆕 NEW (project-specific extensions)
│   ├── templates.ts      # 🆕 NEW (curated extension packs)
│   ├── interactive.ts    # 🔄 REFACTOR (simplified menu)
│   └── rollback.ts       # ✅ KEEP (already excellent)
│
│   # 🗑️ DELETE THESE (logic extracted and rewritten):
│   # ❌ download.ts → logic moved to add/executor.ts
│   # ❌ quickInstall.ts → logic moved to add/executor.ts
│   # ❌ fromList.ts → batch logic moved to add/executor.ts
│   # ❌ install.ts → install logic moved to add/executor.ts
│   # ❌ installDirect.ts → direct install moved to add/executor.ts
│   # ❌ uninstallExtensions.ts → rewritten as remove.ts
│   # ❌ updateInstalled.ts → rewritten as update.ts
│   # ❌ exportInstalled.ts → enhanced as list.ts
│   # ❌ versions.ts → enhanced as info.ts

├── features/         # ✅ PRESERVE ALL (25+ services - your proven business logic)
│   ├── download/     # ✅ Single/bulk orchestration, fallback logic
│   ├── export/       # ✅ Extension scanning, format conversion
│   ├── import/       # ✅ List parsing, validation, normalization
│   ├── install/      # ✅ 12 services: install, compatibility, preflight, etc.
│   ├── uninstall/    # ✅ Extension removal with cleanup
│   ├── update/       # ✅ Update orchestration with backup integration
│   ├── workspace/    # 🆕 NEW service for project-specific extensions
│   └── templates/    # 🆕 NEW service for extension packs

├── core/            # ✅ PRESERVE + ENHANCE (sophisticated utilities)
│   ├── backup/       # ✅ Complete backup/restore with metadata
│   ├── errors/       # ✅ Typed errors, contextual handling
│   ├── filesystem/   # ✅ Templates, checksums, file operations
│   ├── http/         # ✅ Progress tracking, retry logic
│   ├── registry/     # ✅ Marketplace/OpenVSX APIs, version resolution
│   ├── ui/           # ✅ Clack integration, progress utilities
│   ├── validation/   # ✅ JSON Schema + Zod validation
│   ├── planning/     # 🆕 NEW: plan generation and preview
│   └── retry/        # 🆕 NEW: intelligent retry strategies

├── config/          # 🔄 MIGRATE (preserve logic, enhance schema)
│   ├── schemaV2.ts   # NEW: enhanced YAML configuration
│   ├── loaderV2.ts   # ENHANCE: existing precedence system
│   ├── migrator.ts   # NEW: v1 → v2 config migration
│   └── constants.ts  # PRESERVE: re-exports, environment mappings

└── index.ts         # 🔄 COMPLETE REWRITE (new Commander setup)
```

**Critical Features to Preserve:**

- **Advanced Install Strategies**: CLI, direct, robust (race-safe), enhanced bulk
- **Compatibility System**: Marketplace API, version validation, compatibility checking
- **Backup/Rollback**: Complete metadata tracking, automated backup before updates
- **Error Recovery**: Typed errors with automated suggestions and recovery
- **File System Safety**: Atomic operations, file locking, race condition prevention
- **Progress Tracking**: Rich progress bars, download tracking, time estimates
- **Configuration**: Sophisticated precedence, validation, environment detection
- **Registry Integration**: Both Marketplace and OpenVSX APIs with fallback

**Deliverables:**

- Technical architecture document
- Feature preservation strategy (all 25+ services)
- Advanced capability migration plan

#### Task 0.3: Testing Infrastructure

- [ ] Set up comprehensive test environment
- [ ] Create test fixtures for all input types
- [ ] Set up CI/CD for breaking changes branch
- [ ] Plan user acceptance testing environment

**Deliverables:**

- Test infrastructure ready
- Test data prepared
- CI/CD configured

---

## Phase 1: Foundation (Weeks 1-4)

**Goal:** Core command structure and smart routing  
**Priority:** Critical - Foundation for all other phases

### Week 1: Command Structure Redesign

#### Task 1.1: Create New Command Framework

**Priority:** Critical  
**Estimated Time:** 3-4 days  
**Dependencies:** None

**Implementation:**

1. **Create new command base classes:**

   ```typescript
   // src/commands/base/BaseCommand.ts
   export abstract class BaseCommand {
     abstract execute(args: string[], options: GlobalOptions): Promise<CommandResult>;
     abstract getHelp(): CommandHelp;
   }

   // src/commands/base/types.ts
   export interface GlobalOptions {
     editor?: "cursor" | "vscode" | "auto";
     quiet?: boolean;
     json?: boolean;
     yes?: boolean;
     debug?: boolean;
     // ... all global flags
   }
   ```

2. **Create command registry:**

   ```typescript
   // src/commands/registry.ts
   export const COMMANDS = {
     add: () => import("./add"),
     remove: () => import("./remove"),
     update: () => import("./update"),
     list: () => import("./list"),
     search: () => import("./search"),
     info: () => import("./info"),
     doctor: () => import("./doctor"),
     workspace: () => import("./workspace"),
     templates: () => import("./templates"),
     rollback: () => import("./rollback"),
   };

   export const ALIASES = {
     get: "add",
     upgrade: "update",
     install: "add", // Migration helper
   };
   ```

**Deliverables:**

- [ ] `src/commands/base/` directory with base classes
- [ ] Command registry system
- [ ] Type definitions for new API
- [ ] Basic command router

#### Task 1.2: Implement Smart `add` Command

**Priority:** Critical  
**Estimated Time:** 4-5 days  
**Dependencies:** Task 1.1

**Implementation:**

1. **Create input detection system:**

   ```typescript
   // src/commands/add/inputDetector.ts
   export type InputType =
     | "url"
     | "vsix-file"
     | "vsix-directory"
     | "extension-list"
     | "extension-id";

   export class InputDetector {
     detectInputType(input: string): InputType {
       // 1. URL detection (marketplace/open-vsx)
       if (this.isUrl(input)) return "url";

       // 2. File path detection
       if (fs.existsSync(input)) {
         if (path.extname(input) === ".vsix") return "vsix-file";
         if (fs.statSync(input).isDirectory()) return "vsix-directory";
         if (this.isExtensionList(input)) return "extension-list";
       }

       // 3. Extension ID pattern (publisher.name)
       if (this.isExtensionId(input)) return "extension-id";

       throw new UserInputError(`Unable to determine input type for: ${input}`);
     }
   }
   ```

2. **Create smart execution engine that REFACTORS existing business logic:**

   ```typescript
   // src/commands/add/executor.ts - REWRITTEN from scratch using proven services
   import { downloadSingle, downloadBulk } from "../../features/download";
   import {
     installService,
     directInstallService,
     robustInstallService,
   } from "../../features/install";
   import { editorCliService } from "../../features/install/services";
   import { registryService } from "../../core/registry";
   import { backupService } from "../../core/backup";
   import { progressTracker } from "../../core/ui";

   export class AddExecutor {
     async execute(plan: InstallPlan, options: AddOptions): Promise<CommandResult> {
       const tracker = progressTracker.create(plan.steps);

       try {
         switch (plan.input.type) {
           case "url":
           case "extension-id":
             return await this.executeUrlFlow(plan, options, tracker);
           case "vsix-file":
             return await this.executeFileFlow(plan, options, tracker);
           case "vsix-directory":
             return await this.executeDirectoryFlow(plan, options, tracker);
           case "extension-list":
             return await this.executeListFlow(plan, options, tracker);
         }
       } catch (error) {
         tracker.fail(error);
         throw error;
       }
     }

     private async executeUrlFlow(
       plan: InstallPlan,
       options: AddOptions,
       tracker: ProgressTracker,
     ): Promise<CommandResult> {
       // REFACTORED: Extract core logic from quickInstall.ts, rewrite cleanly
       tracker.start("Resolving extension");

       // 1. Resolve extension metadata
       const extension = await registryService.resolveExtension(
         plan.extension.id,
         plan.extension.version,
         plan.extension.source,
       );

       // 2. Download extension
       tracker.update("Downloading extension");
       const downloadResult = await downloadSingle.download(extension, {
         outputDir: options.output || "./downloads",
         source: options.source,
         preRelease: options.preRelease,
         verify: true,
       });

       // 3. Install extension
       if (!options.downloadOnly) {
         tracker.update("Installing extension");

         // Create backup if needed
         if (options.backup !== false) {
           await backupService.createPreInstallBackup(plan.target, extension);
         }

         // Choose install strategy based on options
         const installer = this.selectInstaller(options);
         const installResult = await installer.install(
           plan.target.binaryPath,
           downloadResult.filePath,
           {
             timeout: options.timeout || 30000,
             retries: options.retry || 2,
           },
         );

         tracker.complete("Extension installed successfully");
         return {
           status: "ok",
           summary: `${extension.name} installed successfully`,
           extension,
           installResult,
         };
       }

       tracker.complete("Extension downloaded");
       return {
         status: "ok",
         summary: `${extension.name} downloaded to ${downloadResult.filePath}`,
         extension,
         downloadResult,
       };
     }

     private async executeListFlow(
       plan: InstallPlan,
       options: AddOptions,
       tracker: ProgressTracker,
     ): Promise<CommandResult> {
       // REFACTORED: Extract and rewrite logic from fromList.ts
       tracker.start("Processing extension list");

       // 1. Parse extension list
       const parser = new ExtensionListParser();
       const extensions = await parser.parse(plan.input.value);

       // 2. Batch download missing extensions
       const downloads = await downloadBulk.downloadMissing(extensions, {
         outputDir: options.output || "./downloads",
         parallel: options.parallel || 3,
         source: options.source,
       });

       // 3. Batch install if requested
       if (!options.downloadOnly) {
         const installer = new BatchInstaller({
           parallel: options.parallel || 1,
           strategy: this.selectInstaller(options),
         });

         const results = await installer.installBatch(
           plan.target.binaryPath,
           downloads.successful,
           options,
         );

         return {
           status: "ok",
           summary: `Processed ${extensions.length} extensions`,
           results,
         };
       }

       return {
         status: "ok",
         summary: `Downloaded ${downloads.successful.length} extensions`,
         downloads,
       };
     }

     private selectInstaller(options: AddOptions): InstallService {
       // Smart installer selection based on requirements
       if (options.robust || options.parallel > 1) {
         return robustInstallService; // Race-condition safe
       }

       if (options.direct) {
         return directInstallService; // CLI bypass
       }

       return installService; // Standard install
     }
   }
   ```

**Files to CREATE (complete rewrites):**

- [ ] `src/commands/add/index.ts` - Unified add command (REWRITE from 4 old commands)
- [ ] `src/commands/add/inputDetector.ts` - Smart input type detection (NEW)
- [ ] `src/commands/add/executor.ts` - Execution engine (REFACTOR logic from quickInstall.ts + fromList.ts + install.ts)
- [ ] `src/commands/add/planGenerator.ts` - Plan generation (EXTRACT from existing validation services)
- [ ] `src/commands/add/planDisplay.ts` - Plan preview UI (NEW with Clack)
- [ ] `src/commands/add/batchInstaller.ts` - Batch operations (CONSOLIDATE from multiple files)
- [ ] Integration tests for unified workflows

**Refactoring Strategy:**

- **EXTRACT core logic** - Pull business logic from old commands, rewrite cleanly
- **CONSOLIDATE features** - Merge download.ts + quickInstall.ts + fromList.ts + install.ts into unified flows
- **DEDUPLICATE code** - Remove redundant validation, error handling, progress tracking
- **STANDARDIZE interfaces** - One consistent API instead of 4 different command signatures
- **DELETE legacy files** - Old command files completely removed, not imported

**Deliverables:**

- [ ] Unified `add` command with smart input detection
- [ ] All input types supported (URL, file, directory, list, ID)
- [ ] Plan preview with existing service integration
- [ ] Preservation of all advanced features

#### Task 1.3: Migrate to Clack UI Framework

**Priority:** High  
**Estimated Time:** 3 days  
**Dependencies:** None (can be parallel with other tasks)

**Implementation:**

1. **Replace all existing prompts with Clack:**

   ```typescript
   // OLD: Using inquirer or other prompt library
   // Remove all references to old prompt libraries

   // NEW: Using @clack/prompts
   import { intro, outro, confirm, select, text, group } from "@clack/prompts";

   // src/core/ui/prompts.ts
   export class ClackPrompts {
     async confirmPlan(plan: InstallPlan): Promise<boolean> {
       intro("📦 Installation Plan");

       log.message(`
   Extension: ${plan.extension.name}
   Version: ${plan.extension.version}
   Target: ${plan.target.name}
   `);

       return await confirm({
         message: "Continue with installation?",
       });
     }
   }
   ```

2. **Create reusable UI components:**
   ```typescript
   // src/core/ui/components.ts
   export class UIComponents {
     async showPlan(plan: InstallPlan): Promise<PlanAction>;
     async selectEditor(editors: EditorInfo[]): Promise<EditorInfo>;
     async showProgress(task: Task): Promise<void>;
     async handleError(error: Error, context: ErrorContext): Promise<ErrorAction>;
   }
   ```

**Files to Update:**

- [ ] `src/core/ui/` - Complete rewrite with Clack
- [ ] All command files - Replace prompts
- [ ] Remove old prompt dependencies
- [ ] Update package.json

**Deliverables:**

- [ ] All UI converted to Clack
- [ ] Consistent visual design
- [ ] Reusable UI components
- [ ] Old prompt libraries removed

### Week 2: Plan Preview System

#### Task 2.1: Implement Plan Generation

**Priority:** High  
**Estimated Time:** 3-4 days  
**Dependencies:** Task 1.2

**Implementation:**

1. **Create plan data structures:**

   ```typescript
   // src/core/planning/types.ts
   export interface InstallPlan {
     input: {
       type: InputType;
       value: string;
     };
     extension: ExtensionInfo;
     target: EditorInfo;
     steps: PlanStep[];
     checks: PreflightCheck[];
     estimates: {
       downloadSize: number;
       downloadTime: number;
       totalTime: number;
     };
     safety: SafetyConfig;
     performance: PerformanceConfig;
   }
   ```

2. **Create plan generator that leverages existing advanced services:**

   ```typescript
   // src/core/planning/planGenerator.ts
   import { getEditorService } from "../../features/install";
   import { getInstallPreflightService } from "../../features/install/services/installPreflightService";
   import { getExtensionCompatibilityService } from "../../features/install/services/extensionCompatibilityService";
   import { parseExtensionUrl, resolveVersion } from "../registry";

   export class PlanGenerator {
     private editorService = getEditorService();
     private preflightService = getInstallPreflightService();
     private compatibilityService = getExtensionCompatibilityService();

     async generatePlan(input: string, options: AddOptions): Promise<InstallPlan> {
       // 1. Detect input type
       const inputType = this.detector.detectInputType(input);

       // 2. Resolve extension info using existing registry services
       const extension = await this.resolveExtension(input, inputType, options);

       // 3. Detect target editor using existing service
       const target = await this.detectEditor(options);

       // 4. Run comprehensive preflight checks using existing service
       const checks = await this.runPreflightChecks(extension, target, options);

       // 5. Generate execution steps
       const steps = this.generateSteps(extension, target, options);

       // 6. Calculate estimates using existing metadata
       const estimates = await this.calculateEstimates(extension, steps);

       return {
         input: { type: inputType, value: input },
         extension,
         target,
         steps,
         checks,
         estimates,
         safety: this.getSafetyConfig(options),
         performance: this.getPerformanceConfig(options),
       };
     }

     private async resolveExtension(
       input: string,
       type: InputType,
       options: AddOptions,
     ): Promise<ExtensionInfo> {
       switch (type) {
         case "url":
           const parsed = parseExtensionUrl(input);
           const version = await resolveVersion(
             parsed.itemName,
             "latest",
             options.preRelease || false,
             options.source || "auto",
           );
           return {
             id: parsed.itemName,
             name: parsed.itemName.split(".")[1],
             version,
             source: options.source || "marketplace",
             url: input,
           };

         case "extension-id":
           const resolvedVersion = await resolveVersion(
             input,
             "latest",
             options.preRelease || false,
             options.source || "auto",
           );
           return {
             id: input,
             name: input.split(".")[1],
             version: resolvedVersion,
             source: options.source || "marketplace",
             url: `https://marketplace.visualstudio.com/items?itemName=${input}`,
           };

         case "vsix-file":
           // Extract metadata from VSIX file using existing scanner
           const { getVsixScanner } = await import("../../features/install");
           const scanner = getVsixScanner();
           const scanResult = await scanner.scanDirectory(path.dirname(input), {
             recursive: false,
           });
           const vsixFile = scanResult.validVsixFiles.find((f) => f.path === input);
           if (!vsixFile) throw new Error(`Invalid VSIX file: ${input}`);

           return {
             id: vsixFile.extensionId || "unknown",
             name: vsixFile.extensionId?.split(".")[1] || "unknown",
             version: vsixFile.version || "unknown",
             source: "local",
             filePath: input,
           };

         // ... other cases
       }
     }

     private async detectEditor(options: AddOptions): Promise<EditorInfo> {
       if (options.editor && options.editor !== "auto") {
         const editorInfo = await this.editorService.getEditorInfo(options.editor);
         if (!editorInfo) throw new Error(`Editor not found: ${options.editor}`);
         return editorInfo;
       }

       const available = await this.editorService.getAvailableEditors();
       if (available.length === 0) {
         throw new Error("No editors found. Please install VS Code or Cursor.");
       }

       // Prefer Cursor if available (matching existing behavior)
       return available.find((e) => e.name === "cursor") || available[0];
     }

     private async runPreflightChecks(
       extension: ExtensionInfo,
       target: EditorInfo,
       options: AddOptions,
     ): Promise<PreflightCheck[]> {
       const checks: PreflightCheck[] = [];

       // 1. Editor binary check
       checks.push({
         name: "Editor Binary",
         status: target.isAvailable ? "pass" : "fail",
         message: target.isAvailable ? "Editor available" : "Editor not found",
       });

       // 2. Extensions directory check using existing preflight service
       try {
         const preflightResult = await this.preflightService.runPreflightChecks(target.name);
         checks.push({
           name: "Extensions Directory",
           status: preflightResult.valid ? "pass" : "fail",
           message: preflightResult.valid
             ? "Extensions directory ready"
             : preflightResult.errors[0] || "Directory check failed",
         });
       } catch (error) {
         checks.push({
           name: "Extensions Directory",
           status: "fail",
           message: `Preflight check failed: ${error instanceof Error ? error.message : String(error)}`,
         });
       }

       // 3. Compatibility check using existing compatibility service (for marketplace extensions)
       if (extension.id && extension.id !== "unknown" && extension.source !== "local") {
         try {
           const compatResult = await this.compatibilityService.checkCompatibility(
             extension.id,
             extension.version,
             target.binaryPath,
             extension.source as "marketplace" | "open-vsx",
           );

           checks.push({
             name: "Compatibility",
             status: compatResult.compatible ? "pass" : "warning",
             message: compatResult.result.reason || "Compatibility checked",
           });
         } catch (error) {
           checks.push({
             name: "Compatibility",
             status: "warning",
             message: `Compatibility check failed: ${error instanceof Error ? error.message : String(error)}`,
           });
         }
       }

       // 4. Disk space check
       // TODO: Integrate existing disk space checking logic

       return checks;
     }
   }
   ```

**Files to Create:**

- [ ] `src/core/planning/` directory
- [ ] Plan generation logic
- [ ] Preflight check system
- [ ] Estimation algorithms
- [ ] Plan validation

**Deliverables:**

- [ ] Complete plan generation system
- [ ] Preflight checks (compatibility, disk space, network)
- [ ] Accurate time/size estimates
- [ ] Plan validation

#### Task 2.2: Implement Plan Preview UI

**Priority:** High  
**Estimated Time:** 2-3 days  
**Dependencies:** Task 2.1, Task 1.3

**Implementation:**

1. **Create plan display components:**

   ```typescript
   // src/core/ui/planDisplay.ts
   export class PlanDisplay {
     async showPlan(plan: InstallPlan): Promise<PlanAction> {
       intro("📦 Installation Plan");

       // Show plan details using log.message
       log.message(this.formatPlan(plan));

       // Get user confirmation
       return await select({
         message: "How would you like to proceed?",
         options: [
           { value: "confirm", label: "Continue with installation" },
           { value: "customize", label: "Customize settings" },
           { value: "cancel", label: "Cancel" },
         ],
       });
     }

     private formatPlan(plan: InstallPlan): string {
       return `
   Extension: ${plan.extension.name}
   ID: ${plan.extension.id}
   Version: ${plan.extension.version} (latest)
   Source: ${plan.extension.source}
   
   Target: ${plan.target.name} (${plan.target.version})
   Location: ${plan.target.extensionsPath}
   
   ${this.formatChecks(plan.checks)}
   
   Steps:
   ${plan.steps.map((step, i) => `${i + 1}. ${step.description}`).join("\n")}
   
   Estimated time: ~${plan.estimates.totalTime} seconds
   `;
     }
   }
   ```

**Files to Create:**

- [ ] Plan display components
- [ ] Plan formatting utilities
- [ ] Customization interface
- [ ] Plan export functionality (--plan flag)

**Deliverables:**

- [ ] Beautiful plan preview UI
- [ ] Customization options
- [ ] Plan export as JSON
- [ ] Dry-run mode support

### Week 3: Core Commands Implementation

#### Task 3.1: Implement Basic Commands

**Priority:** High  
**Estimated Time:** 4-5 days  
**Dependencies:** Task 1.1, existing services

**Commands to REWRITE (consolidating functionality):**

1. **`remove` command (REFACTOR from uninstallExtensions.ts):**

   ```typescript
   // src/commands/remove/index.ts - REWRITTEN with enhanced capabilities
   import { uninstallService } from "../../features/uninstall";
   import { backupService } from "../../core/backup";
   import { progressTracker } from "../../core/ui";

   export class RemoveCommand extends BaseCommand {
     async execute(args: string[], options: RemoveOptions): Promise<CommandResult> {
       const extensionIds = args.length > 0 ? args : await this.promptForSelection(options);

       const tracker = progressTracker.create([
         "Creating backup",
         "Uninstalling extensions",
         "Cleaning up",
       ]);

       // ENHANCED: Automatic backup before removal (extracted from updateInstalled.ts backup logic)
       if (options.backup !== false) {
         tracker.start("Creating backup");
         await backupService.createPreUninstallBackup(extensionIds);
       }

       // REFACTORED: Extract and enhance logic from uninstallExtensions.ts
       tracker.update("Uninstalling extensions");
       const results = await uninstallService.uninstallBatch(extensionIds, {
         parallel: options.parallel || 2,
         cleanup: options.cleanup !== false,
         dryRun: options.dryRun,
       });

       tracker.complete(`Removed ${results.successful.length} extensions`);
       return {
         status: "ok",
         summary: `Removed ${results.successful.length} of ${extensionIds.length} extensions`,
         results,
       };
     }

     private async promptForSelection(options: RemoveOptions): Promise<string[]> {
       // CONSOLIDATED: Smart selection from interactive patterns
       const installed = await exportService.getInstalled();
       return await this.multiSelectPrompt(installed, options);
     }
   }
   ```

2. **`update` command (CONSOLIDATE updateInstalled.ts + backup logic):**

   ```typescript
   // src/commands/update/index.ts - REWRITTEN with integrated backup/rollback
   import { updateService } from "../../features/update";
   import { backupService } from "../../core/backup";
   import { compatibilityService } from "../../features/install/services";

   export class UpdateCommand extends BaseCommand {
     async execute(args: string[], options: UpdateOptions): Promise<CommandResult> {
       const targetExtensions = await this.resolveTargets(args, options);

       // INTEGRATED: Automatic backup (from updateInstalled.ts) + compatibility checking
       const backupId = await backupService.createUpdateBackup(targetExtensions);

       try {
         const results = await updateService.updateBatch(targetExtensions, {
           checkCompatibility: options.checkCompatibility !== false,
           parallel: options.parallel || 1,
           preRelease: options.preRelease,
           source: options.source,
         });

         // ENHANCED: Smart rollback on critical failures
         if (results.criticalFailures.length > 0) {
           await this.handleCriticalFailures(results, backupId, options);
         }

         return {
           status: "ok",
           summary: `Updated ${results.successful.length} extensions`,
           results,
           backupId,
         };
       } catch (error) {
         // AUTO-ROLLBACK on catastrophic failure
         await backupService.rollback(backupId);
         throw error;
       }
     }
   }
   ```

3. **`list` command (ENHANCE exportInstalled.ts with new formats):**

   ```typescript
   // src/commands/list/index.ts - ENHANCED with workspace integration
   import { exportService } from "../../features/export";
   import { workspaceService } from "../../features/workspace";

   export class ListCommand extends BaseCommand {
     async execute(args: string[], options: ListOptions): Promise<CommandResult> {
       // ENHANCED: Support workspace-aware listing + new formats
       const extensions = await exportService.getInstalled({
         includeDisabled: options.includeDisabled,
         workspaceFilter: options.workspaceOnly,
         detailed: options.detailed,
       });

       // NEW: Rich formatting options
       if (options.output) {
         await this.exportToFile(extensions, options);
         return {
           status: "ok",
           message: `List exported to ${options.output}`,
           count: extensions.length,
         };
       }

       // ENHANCED: Multiple display formats in console
       await this.displayExtensions(extensions, options);

       return {
         status: "ok",
         items: extensions,
         summary: `Found ${extensions.length} extensions`,
       };
     }

     private async exportToFile(extensions: Extension[], options: ListOptions): Promise<void> {
       // CONSOLIDATED: All format support in one place (yaml, json, txt, csv)
       const formatters = {
         json: () => JSON.stringify(extensions, null, 2),
         yaml: () => yaml.stringify(extensions),
         txt: () => extensions.map((e) => e.id).join("\n"),
         csv: () => this.toCsv(extensions),
         workspace: () => this.toWorkspaceConfig(extensions), // NEW format
       };

       const content = formatters[options.format || "json"]();
       await fs.writeFile(options.output, content);
     }
   }
   ```

**Files to CREATE (by refactoring legacy commands):**

- [ ] `src/commands/remove/index.ts` - REWRITE uninstallExtensions.ts with backup integration
- [ ] `src/commands/update/index.ts` - REFACTOR updateInstalled.ts with smart rollback
- [ ] `src/commands/list/index.ts` - ENHANCE exportInstalled.ts with new formats/workspace support
- [ ] `src/commands/info/index.ts` - UPGRADE versions.ts with richer extension information
- [ ] Tests for refactored command workflows

**Files to DELETE (legacy command files):**

- [ ] `src/commands/download.ts` - Logic moved to `add` command executor
- [ ] `src/commands/quickInstall.ts` - Logic consolidated into `add` command
- [ ] `src/commands/fromList.ts` - Batch logic moved to `add` command
- [ ] `src/commands/install.ts` - Install logic moved to `add` command
- [ ] `src/commands/installDirect.ts` - Direct install moved to `add` command
- [ ] `src/commands/uninstallExtensions.ts` - Refactored into `remove` command
- [ ] `src/commands/updateInstalled.ts` - Refactored into `update` command
- [ ] `src/commands/exportInstalled.ts` - Enhanced as `list` command
- [ ] `src/commands/versions.ts` - Enhanced as `info` command

**Deliverables:**

- [ ] All core commands completely rewritten
- [ ] Legacy command files deleted
- [ ] Consolidated, de-duplicated functionality
- [ ] Enhanced capabilities in each rewritten command
- [ ] Unified flag handling and error patterns

#### Task 3.2: Implement Flag System

**Priority:** Critical  
**Estimated Time:** 2-3 days  
**Dependencies:** Task 1.1

**Implementation:**

1. **Enhance existing Commander setup:**

   ```typescript
   // src/core/cli/commandSetup.ts
   export class CommandSetup {
     setupCommands(program: Command): void {
       // Use existing Commander patterns
       // Add new command structure
       // Support all new flag names
       // Reject old flag names with helpful errors

       // Reuse existing withConfigAndErrorHandling wrapper
       program
         .command("add")
         .description("Add extensions (universal entry point)")
         .argument("<input>", "URL, file, directory, list, or extension ID")
         .option("--editor <name>", "Target editor (cursor|vscode|auto)")
         .option("--download-only", "Download without installing")
         .option("-y, --yes", "Auto-confirm all prompts")
         .action(async (input, opts) => {
           await withConfigAndErrorHandling(async (config, options) => {
             await smartAdd(input, { ...options, ...config });
           }, opts);
         });
     }

     validateFlags(command: string, flags: GlobalOptions): void {
       // Validate flag combinations using existing patterns
       // Show helpful errors for old flags
     }
   }
   ```

2. **Create migration helper:**

   ```typescript
   // src/core/cli/migration.ts
   export class MigrationHelper {
     checkForOldFlags(args: string[]): MigrationWarning[] {
       const warnings: MigrationWarning[] = [];

       // Check for old flags and suggest new ones
       if (args.includes("--verbose")) {
         warnings.push({
           old: "--verbose",
           new: "--debug",
           message: "Use --debug instead of --verbose",
         });
       }

       return warnings;
     }
   }
   ```

**Files to Create:**

- [ ] New flag parsing system
- [ ] Flag validation
- [ ] Migration warnings
- [ ] Help system updates

**Deliverables:**

- [ ] Complete new flag system
- [ ] Old flag detection and warnings
- [ ] Consistent flag handling across commands
- [ ] Updated help text

### Week 4: Error Handling & Recovery

#### Task 4.1: Enhanced Error Handling

**Priority:** High  
**Estimated Time:** 3-4 days  
**Dependencies:** Task 1.2, existing error system

**Implementation:**

1. **Enhance error handler:**

   ```typescript
   // src/core/errors/enhancedHandler.ts
   export class EnhancedErrorHandler extends ErrorHandler {
     async handleError(error: Error, context: ErrorContext): Promise<ErrorAction> {
       const suggestion = this.getSuggestion(error, context);

       if (suggestion.autoRecovery) {
         return await this.attemptAutoRecovery(error, context, suggestion);
       }

       return await this.promptUserForAction(error, context, suggestion);
     }

     private getSuggestion(error: Error, context: ErrorContext): ErrorSuggestion {
       // Binary mismatch -> suggest --editor flag
       // Timeout -> suggest retry with higher timeout
       // 403/404 -> suggest alternative source
       // etc.
     }
   }
   ```

2. **Create contextual error messages:**
   ```typescript
   // src/core/errors/contextualErrors.ts
   export class ContextualErrorHandler {
     formatError(error: Error, context: ErrorContext): FormattedError {
       return {
         title: this.getErrorTitle(error),
         description: this.getErrorDescription(error, context),
         suggestions: this.getActionableSuggestions(error, context),
         code: this.getErrorCode(error),
       };
     }
   }
   ```

**Files to Create/Update:**

- [ ] Enhanced error handler
- [ ] Contextual error formatting
- [ ] Auto-recovery strategies
- [ ] User-friendly error messages

**Deliverables:**

- [ ] Context-aware error messages
- [ ] Automated recovery suggestions
- [ ] Better user guidance
- [ ] Reduced error frustration

#### Task 4.2: Health Check (`doctor` Command)

**Priority:** Medium  
**Estimated Time:** 3-4 days  
**Dependencies:** Task 3.1

**Implementation:**

1. **Create health check system:**

   ```typescript
   // src/commands/doctor/healthChecker.ts
   export class HealthChecker {
     async runChecks(): Promise<HealthReport> {
       const checks = [
         this.checkEditorInstallation(),
         this.checkBinaryPaths(),
         this.checkExtensionsDirectory(),
         this.checkNetworkConnectivity(),
         this.checkCorruptedExtensions(),
         this.checkConfiguration(),
         this.checkForUpdates(),
       ];

       const results = await Promise.all(checks);
       return this.compileReport(results);
     }
   }
   ```

2. **Create auto-fix system:**
   ```typescript
   // src/commands/doctor/autoFix.ts
   export class AutoFix {
     async applyFix(issue: HealthIssue): Promise<FixResult> {
       switch (issue.type) {
         case "binary-mismatch":
           return await this.fixBinaryMismatch(issue);
         case "corrupted-extension":
           return await this.removeCorruptedExtension(issue);
         case "config-invalid":
           return await this.fixConfiguration(issue);
       }
     }
   }
   ```

**Files to Create:**

- [ ] `src/commands/doctor/index.ts`
- [ ] Health check system
- [ ] Auto-fix capabilities
- [ ] Health report formatting

**Deliverables:**

- [ ] Comprehensive health checks
- [ ] Automated fixes for common issues
- [ ] Clear health reports
- [ ] Prevention of common problems

---

## Phase 2: Intelligence (Weeks 5-8)

**Goal:** Quality of life improvements and automation  
**Priority:** High - Significantly improves user experience

### Week 5: Configuration System Redesign

#### Task 5.1: Unified Configuration System

**Priority:** High  
**Estimated Time:** 4-5 days  
**Dependencies:** None (can start early)

**Implementation:**

1. **Create new configuration schema (using existing Zod):**

   ```typescript
   // src/config/schemaV2.ts (using existing Zod patterns)
   import { z } from "zod";

   const EditorConfigSchema = z.object({
     prefer: z.enum(["cursor", "vscode", "auto"]).default("auto"),
     "cursor-binary": z.string().optional(),
     "vscode-binary": z.string().optional(),
   });

   const SafetyConfigSchema = z.object({
     "check-compatibility": z.boolean().default(true),
     "auto-backup": z.boolean().default(true),
     "verify-checksums": z.boolean().default(true),
   });

   const PerformanceConfigSchema = z.object({
     "parallel-downloads": z.number().min(1).max(10).default(3),
     "parallel-installs": z.number().min(1).max(5).default(1),
   });

   const BehaviorConfigSchema = z.object({
     "skip-installed": z.enum(["ask", "always", "never"]).default("ask"),
     "update-check": z.enum(["never", "daily", "weekly"]).default("weekly"),
     "auto-retry": z.boolean().default(true),
   });

   export const ConfigV2Schema = z.object({
     editor: EditorConfigSchema,
     safety: SafetyConfigSchema,
     performance: PerformanceConfigSchema,
     behavior: BehaviorConfigSchema,
     "active-profile": z.string().optional(),
     profiles: z.record(z.string(), ConfigV2Schema.partial()).optional(),
   });

   export type ConfigV2 = z.infer<typeof ConfigV2Schema>;
   ```

   **Sample config file (YAML):**

   ```yaml
   # ~/.vsix/config.yml
   editor:
     prefer: cursor
     cursor-binary: auto
     vscode-binary: auto

   safety:
     check-compatibility: true
     auto-backup: true
     verify-checksums: true

   performance:
     parallel-downloads: 3
     parallel-installs: 1

   behavior:
     skip-installed: ask
     update-check: weekly
     auto-retry: true

   active-profile: production

   profiles:
     production:
       safety:
         check-compatibility: true
       performance:
         parallel-installs: 1
     development:
       safety:
         check-compatibility: false
       performance:
         parallel-installs: 3
   ```

2. **Enhance existing configuration loader:**

   ```typescript
   // src/config/loaderV2.ts (building on existing loader.ts patterns)
   import { ConfigV2Schema, ConfigV2 } from "./schemaV2";
   import * as yaml from "yaml";

   export class ConfigLoaderV2 {
     async loadConfig(cliConfig: Partial<ConfigV2>, configPath?: string): Promise<ConfigV2> {
       // Reuse existing precedence pattern: CLI > ENV > FILE > DEFAULTS

       const fileConfig = await this.loadFileConfig(configPath);
       const envConfig = this.loadEnvConfig();
       const defaultConfig = this.getDefaults();

       // Merge with precedence (same pattern as existing code)
       const mergedConfig = {
         ...defaultConfig,
         ...fileConfig,
         ...envConfig,
         ...cliConfig,
       };

       // Validate with Zod (instead of existing AJV)
       const result = ConfigV2Schema.safeParse(mergedConfig);
       if (!result.success) {
         throw new ConfigError(
           `Invalid configuration: ${result.error.message}`,
           undefined,
           "INVALID_CONFIG_V2",
         );
       }

       return result.data;
     }

     private async loadFileConfig(configPath?: string): Promise<Partial<ConfigV2>> {
       const paths = configPath ? [configPath] : this.getDefaultPaths();

       for (const path of paths) {
         if (await fs.pathExists(path)) {
           const content = await fs.readFile(path, "utf-8");
           return yaml.parse(content);
         }
       }
       return {};
     }

     private loadEnvConfig(): Partial<ConfigV2> {
       // Convert env vars following existing pattern
       return {
         editor: {
           prefer: process.env.VSIX_EDITOR as any,
           "cursor-binary": process.env.VSIX_CURSOR_BIN,
           "vscode-binary": process.env.VSIX_VSCODE_BIN,
         },
         // ... other env mappings
       };
     }

     private getDefaultPaths(): string[] {
       return [
         path.join(process.cwd(), ".vsix.yml"),
         path.join(os.homedir(), ".vsix", "config.yml"),
       ];
     }
   }
   ```

3. **Create configuration migrator (reuse existing config types):**

   ```typescript
   // src/config/migrator.ts
   import { Config } from "./constants"; // Existing v1 config
   import { ConfigV2 } from "./schemaV2";

   export class ConfigMigrator {
     async migrateFromV1(oldConfig: Config): Promise<ConfigV2> {
       // Map existing config structure to new structure
       const newConfig = {
         editor: {
           prefer: this.mapEditor(oldConfig.editor),
           "cursor-binary": oldConfig.cursorBin,
           "vscode-binary": oldConfig.codeBin,
         },
         safety: {
           "check-compatibility": oldConfig.checkCompatibility ?? true,
           "auto-backup": true, // New feature, default enabled
           "verify-checksums": oldConfig.checksum ?? true,
         },
         performance: {
           "parallel-downloads": oldConfig.parallel || 3,
           "parallel-installs": oldConfig.installParallel || 1,
         },
         behavior: {
           "skip-installed": oldConfig.skipInstalled ? "always" : "ask",
           "update-check": "weekly", // New feature
           "auto-retry": oldConfig.installRetry > 0,
         },
       };

       // Validate migrated config
       return ConfigV2Schema.parse(newConfig);
     }

     private mapEditor(editor: string): "cursor" | "vscode" | "auto" {
       switch (editor?.toLowerCase()) {
         case "cursor":
           return "cursor";
         case "vscode":
         case "code":
           return "vscode";
         default:
           return "auto";
       }
     }

     async autoMigrateIfNeeded(): Promise<void> {
       // Check for old config file and migrate automatically
       const oldConfigPath = path.join(os.homedir(), ".vsix-config.json");
       const newConfigPath = path.join(os.homedir(), ".vsix", "config.yml");

       if ((await fs.pathExists(oldConfigPath)) && !(await fs.pathExists(newConfigPath))) {
         console.log("✅ Detected v1.x configuration");
         console.log("🔄 Migrating to v2.0 format...");

         const oldConfig = JSON.parse(await fs.readFile(oldConfigPath, "utf-8"));
         const newConfig = await this.migrateFromV1(oldConfig);

         await fs.ensureDir(path.dirname(newConfigPath));
         await fs.writeFile(newConfigPath, yaml.stringify(newConfig));
         await fs.copyFile(oldConfigPath, `${oldConfigPath}.backup`);

         console.log("✅ Migration complete!");
         console.log(`   Old config backed up: ${oldConfigPath}.backup`);
         console.log(`   New config: ${newConfigPath}`);
       }
     }
   }
   ```

**Files to Create:**

- [ ] `src/config/schemaV2.ts` - New configuration schema
- [ ] `src/config/loaderV2.ts` - Configuration loader
- [ ] `src/config/migrator.ts` - Migration utility
- [ ] `src/config/validator.ts` - Configuration validation
- [ ] Configuration templates and examples

**Deliverables:**

- [ ] New YAML-based configuration system
- [ ] Automatic migration from old configs
- [ ] Profile support
- [ ] Clear precedence rules (CLI > env > config > defaults)

#### Task 5.2: First-Run Setup Wizard

**Priority:** Medium  
**Estimated Time:** 2-3 days  
**Dependencies:** Task 5.1, Clack UI

**Implementation:**

1. **Create setup wizard:**

   ```typescript
   // src/core/setup/wizard.ts
   export class SetupWizard {
     async runFirstTimeSetup(): Promise<ConfigV2> {
       intro("👋 Welcome to VSIX Extension Manager v2.0!");

       const responses = await group({
         editor: () =>
           select({
             message: "Which editor do you use primarily?",
             options: [
               { value: "cursor", label: "Cursor" },
               { value: "vscode", label: "VS Code" },
               { value: "auto", label: "Both (auto-detect)" },
             ],
           }),

         safety: () =>
           confirm({
             message: "Enable safety features? (Recommended)",
             initialValue: true,
           }),

         performance: () =>
           text({
             message: "Parallel downloads (1-10):",
             initialValue: "3",
             validate: (value) => {
               const num = parseInt(value);
               if (isNaN(num) || num < 1 || num > 10) {
                 return "Please enter a number between 1 and 10";
               }
             },
           }),

         configLocation: () =>
           select({
             message: "Where should we save your configuration?",
             options: [
               { value: "home", label: "Home directory (~/.vsix/config.yml)" },
               { value: "project", label: "Current project (.vsix.yml)" },
               { value: "none", label: "Don't save (use defaults)" },
             ],
           }),
       });

       return this.generateConfig(responses);
     }
   }
   ```

**Files to Create:**

- [ ] Setup wizard implementation
- [ ] Configuration generation
- [ ] Welcome messaging
- [ ] First-run detection

**Deliverables:**

- [ ] Interactive first-run setup
- [ ] Configuration generation
- [ ] User-friendly onboarding
- [ ] Skip option for advanced users

### Week 6: Smart Retry & JSON Output

#### Task 6.1: Intelligent Retry System

**Priority:** High  
**Estimated Time:** 3-4 days  
**Dependencies:** Existing install services

**Implementation:**

1. **Create retry strategy system:**

   ```typescript
   // src/core/retry/strategies.ts
   export abstract class RetryStrategy {
     abstract name: string;
     abstract canHandle(error: Error, context: RetryContext): boolean;
     abstract attempt(task: Task, context: RetryContext): Promise<TaskResult>;
   }

   export class TimeoutIncreaseStrategy extends RetryStrategy {
     name = "timeout-increase";

     canHandle(error: Error): boolean {
       return error instanceof TimeoutError;
     }

     async attempt(task: Task, context: RetryContext): Promise<TaskResult> {
       const newTimeout = context.timeout * 2; // Double timeout
       return await task.run({ ...context, timeout: newTimeout });
     }
   }

   export class DirectInstallStrategy extends RetryStrategy {
     name = "direct-install";

     canHandle(error: Error): boolean {
       return error instanceof InstallError;
     }

     async attempt(task: Task, context: RetryContext): Promise<TaskResult> {
       // Try direct installation instead of CLI
       return await this.directInstallService.install(task.extension, context);
     }
   }
   ```

2. **Create smart retry orchestrator:**

   ```typescript
   // src/core/retry/smartRetry.ts
   export class SmartRetryService {
     private strategies: RetryStrategy[] = [
       new TimeoutIncreaseStrategy(),
       new DirectInstallStrategy(),
       new DownloadOnlyStrategy(),
       new ManualInterventionStrategy(),
     ];

     async executeWithRetry(task: Task, options: RetryOptions): Promise<TaskResult> {
       let lastError: Error;
       let attemptCount = 0;

       // Try initial attempt
       try {
         return await task.run(options);
       } catch (error) {
         lastError = error;
         attemptCount++;
       }

       // Try strategies in order
       for (const strategy of this.strategies) {
         if (!strategy.canHandle(lastError, { attemptCount, ...options })) {
           continue;
         }

         try {
           log.message(`Trying ${strategy.name} strategy...`);
           return await strategy.attempt(task, { attemptCount, ...options });
         } catch (error) {
           lastError = error;
           attemptCount++;

           if (!(await this.shouldContinue(error, strategy, attemptCount))) {
             break;
           }
         }
       }

       // All strategies failed
       return await this.handleAllStrategiesFailed(task, lastError, attemptCount);
     }
   }
   ```

**Files to Create:**

- [ ] Retry strategy framework
- [ ] Specific retry strategies
- [ ] Smart retry orchestrator
- [ ] User intervention handling

**Deliverables:**

- [ ] Automatic retry with escalation
- [ ] Multiple recovery strategies
- [ ] User intervention options
- [ ] Reduced failure rates

#### Task 6.2: Standardized JSON Output

**Priority:** Medium  
**Estimated Time:** 2-3 days  
**Dependencies:** All command implementations

**Implementation:**

1. **Create JSON output contract:**

   ```typescript
   // src/core/output/jsonContract.ts
   export interface CommandResult {
     status: "ok" | "error";
     command: string;
     summary: string;
     items: ResultItem[];
     errors: ErrorItem[];
     warnings: WarningItem[];
     totals: {
       success: number;
       failed: number;
       skipped: number;
       duration: number;
     };
     metadata?: Record<string, any>;
   }

   export interface ResultItem {
     id: string;
     version?: string;
     status: "success" | "failed" | "skipped";
     duration: number;
     details?: Record<string, any>;
   }
   ```

2. **Create output formatter:**

   ```typescript
   // src/core/output/formatter.ts
   export class OutputFormatter {
     formatForHuman(result: CommandResult): string {
       // Create beautiful human-readable output
     }

     formatForJSON(result: CommandResult): string {
       return JSON.stringify(result, null, 2);
     }

     formatForMachine(result: CommandResult): string {
       // Compact JSON for CI/scripts
       return JSON.stringify(result);
     }
   }
   ```

**Files to Create:**

- [ ] JSON output contracts
- [ ] Output formatters
- [ ] Consistent result types
- [ ] Documentation for API consumers

**Deliverables:**

- [ ] Standardized JSON API
- [ ] Consistent output across commands
- [ ] Machine-readable results
- [ ] API documentation

### Week 7: Update Notifications & Polish

#### Task 7.1: Background Update Checker

**Priority:** Low  
**Estimated Time:** 2-3 days  
**Dependencies:** None

**Implementation:**

1. **Create update checker service:**

   ```typescript
   // src/core/updates/checker.ts
   export class UpdateChecker {
     private cacheFile = path.join(os.homedir(), ".vsix", "update-cache.json");

     async checkForUpdates(force = false): Promise<UpdateInfo[]> {
       if (!force && !this.shouldCheck()) {
         return await this.getCachedResults();
       }

       const updates = await this.fetchUpdates();
       await this.cacheResults(updates);
       return updates;
     }

     private shouldCheck(): boolean {
       const lastCheck = this.getLastCheckTime();
       const interval = this.getCheckInterval(); // From config
       return Date.now() - lastCheck > interval;
     }

     async showUpdateNotification(updates: UpdateInfo[]): Promise<void> {
       if (updates.length === 0) return;

       log.info(`💡 ${updates.length} extension updates available`);
       log.info(`   Run 'vsix update' to review`);
       log.info(`   (Last checked ${this.formatLastCheck()})`);
     }
   }
   ```

**Files to Create:**

- [ ] Update checker service
- [ ] Cache management
- [ ] Non-blocking notifications
- [ ] Configuration integration

**Deliverables:**

- [ ] Passive update notifications
- [ ] Configurable check frequency
- [ ] Non-intrusive messaging
- [ ] No telemetry/tracking

#### Task 7.2: Consistent Prompting System

**Priority:** High  
**Estimated Time:** 2-3 days  
**Dependencies:** All command implementations

**Implementation:**

1. **Create prompt policy enforcer:**

   ```typescript
   // src/core/ui/promptPolicy.ts
   export class PromptPolicy {
     shouldPrompt(context: PromptContext): boolean {
       if (context.options.quiet || context.options.json) {
         return false;
       }

       if (context.options.yes) {
         return false; // Auto-confirm
       }

       return true; // Interactive mode
     }

     async handleRequiredInput(message: string, context: PromptContext): Promise<string> {
       if (this.shouldPrompt(context)) {
         return await text({ message });
       } else {
         throw new UserInputError(`${message} - Use --editor flag in quiet mode`);
       }
     }
   }
   ```

**Files to Update:**

- [ ] All command implementations
- [ ] Prompt policy enforcement
- [ ] Consistent error messages
- [ ] Mode-specific behavior

**Deliverables:**

- [ ] Consistent prompting behavior
- [ ] Clear mode distinctions
- [ ] Better error messages
- [ ] Predictable UX

### Week 8: Integration Testing & Bug Fixes

#### Task 8.1: Comprehensive Integration Testing

**Priority:** Critical  
**Estimated Time:** 4-5 days  
**Dependencies:** All Phase 2 tasks

**Test Categories:**

1. **Command Integration Tests:**

   ```typescript
   // tests/integration/commands.test.ts
   describe("Command Integration", () => {
     test("add command with URL", async () => {
       const result = await cli.run(["add", "https://marketplace.../python"]);
       expect(result.status).toBe("ok");
       expect(result.items).toHaveLength(1);
     });

     test("add command with file", async () => {
       const result = await cli.run(["add", "./test.vsix"]);
       expect(result.status).toBe("ok");
     });

     test("quiet mode never prompts", async () => {
       const result = await cli.run(["add", "ms-python.python", "--quiet", "--editor", "cursor"]);
       // Should not throw or prompt
       expect(result.status).toBe("ok");
     });
   });
   ```

2. **Configuration Tests:**

   ```typescript
   describe("Configuration System", () => {
     test("loads config with correct precedence", async () => {
       // Test CLI > env > config > defaults
     });

     test("migrates old config correctly", async () => {
       // Test v1 to v2 migration
     });
   });
   ```

**Deliverables:**

- [ ] Complete integration test suite
- [ ] All critical paths tested
- [ ] Configuration testing
- [ ] Error scenario testing

---

## Phase 3: Advanced Features (Weeks 9-14)

**Goal:** Team workflows and advanced features  
**Priority:** Medium - New capabilities for broader use cases

### Week 9-10: Workspace Management

#### Task 9.1: Workspace Configuration System

**Priority:** Medium  
**Estimated Time:** 4-5 days  
**Dependencies:** Configuration system

**Implementation:**

1. **Create workspace schema:**

   ```typescript
   // src/features/workspace/types.ts
   export interface WorkspaceConfig {
     name: string;
     description?: string;
     version?: string;
     extensions: {
       required: string[];
       recommended?: string[];
       disabled?: string[];
     };
     settings?: {
       "auto-install-required": boolean;
       "prompt-for-recommended": boolean;
     };
   }
   ```

2. **Create workspace service:**

   ```typescript
   // src/features/workspace/service.ts
   export class WorkspaceService {
     private configPath = path.join(process.cwd(), ".vsix", "workspace.yml");

     async initWorkspace(config: Partial<WorkspaceConfig>): Promise<void> {
       const fullConfig: WorkspaceConfig = {
         name: config.name || path.basename(process.cwd()),
         description: config.description,
         extensions: {
           required: [],
           recommended: [],
           disabled: [],
         },
         settings: {
           "auto-install-required": true,
           "prompt-for-recommended": true,
         },
         ...config,
       };

       await fs.ensureDir(path.dirname(this.configPath));
       await fs.writeFile(this.configPath, yaml.dump(fullConfig));
     }

     async installWorkspaceExtensions(): Promise<CommandResult> {
       const config = await this.loadWorkspaceConfig();

       // Install required extensions
       const results = await Promise.all([
         this.installRequired(config.extensions.required),
         this.promptForRecommended(config.extensions.recommended),
       ]);

       return this.combineResults(results);
     }
   }
   ```

**Files to Create:**

- [ ] `src/features/workspace/` directory
- [ ] Workspace configuration schema
- [ ] Workspace service implementation
- [ ] Workspace command implementation

#### Task 9.2: Workspace Commands

**Priority:** Medium  
**Estimated Time:** 2-3 days  
**Dependencies:** Task 9.1

**Implementation:**

1. **Create workspace commands:**

   ```typescript
   // src/commands/workspace/index.ts
   export class WorkspaceCommand extends BaseCommand {
     async execute(args: string[], options: GlobalOptions): Promise<CommandResult> {
       const subcommand = args[0];

       switch (subcommand) {
         case "init":
           return await this.initWorkspace(args.slice(1), options);
         case "install":
           return await this.installWorkspace(options);
         case "add":
           return await this.addToWorkspace(args.slice(1), options);
         case "remove":
           return await this.removeFromWorkspace(args.slice(1), options);
         default:
           throw new UserInputError(`Unknown workspace command: ${subcommand}`);
       }
     }
   }
   ```

**Files to Create:**

- [ ] Workspace command implementation
- [ ] Subcommand routing
- [ ] Workspace validation
- [ ] Documentation

**Deliverables:**

- [ ] Complete workspace system
- [ ] Project-specific extension management
- [ ] Team consistency tools
- [ ] Documentation

### Week 11-12: Template System

#### Task 11.1: Template Registry

**Priority:** Medium  
**Estimated Time:** 3-4 days  
**Dependencies:** None

**Implementation:**

1. **Create template structure:**

   ```
   templates/
   ├── registry.json           # Template index
   ├── web-frontend.yml        # Template definitions
   ├── web-backend.yml
   ├── python-data.yml
   ├── devops.yml
   ├── mobile.yml
   ├── minimal.yml
   └── README.md              # Contribution guide
   ```

2. **Create template schema:**

   ```typescript
   // src/features/templates/types.ts
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
     tags?: string[];
   }
   ```

3. **Create template service:**

   ```typescript
   // src/features/templates/service.ts
   export class TemplateService {
     private templatesDir = path.join(__dirname, "../../../templates");

     async listTemplates(): Promise<Template[]> {
       const registry = await this.loadRegistry();
       return Promise.all(registry.templates.map((t) => this.loadTemplate(t.file)));
     }

     async applyTemplate(templateId: string, options: ApplyOptions): Promise<CommandResult> {
       const template = await this.getTemplate(templateId);

       // Show template preview
       if (!options.yes) {
         const shouldContinue = await this.showTemplatePreview(template);
         if (!shouldContinue) return { status: "cancelled" };
       }

       // Apply template
       return await this.installTemplateExtensions(template, options);
     }
   }
   ```

**Files to Create:**

- [ ] Template directory structure
- [ ] Template definitions (YAML)
- [ ] Template service
- [ ] Registry management

#### Task 11.2: Template Commands

**Priority:** Medium  
**Estimated Time:** 2-3 days  
**Dependencies:** Task 11.1

**Implementation:**

1. **Create template commands:**

   ```typescript
   // src/commands/templates/index.ts
   export class TemplatesCommand extends BaseCommand {
     async execute(args: string[], options: GlobalOptions): Promise<CommandResult> {
       const subcommand = args[0];

       if (!subcommand) {
         return await this.listTemplates(options);
       }

       switch (subcommand) {
         case "use":
           return await this.useTemplate(args[1], options);
         case "list":
           return await this.listTemplates(options);
         case "info":
           return await this.showTemplateInfo(args[1], options);
         default:
           throw new UserInputError(`Unknown templates command: ${subcommand}`);
       }
     }
   }
   ```

**Files to Create:**

- [ ] Template commands
- [ ] Template preview system
- [ ] Template application logic
- [ ] Template documentation

**Deliverables:**

- [ ] Complete template system
- [ ] Curated extension packs
- [ ] Easy setup workflows
- [ ] Community contribution system

### Week 13: Search & Info Commands

#### Task 13.1: Marketplace Search

**Priority:** Low  
**Estimated Time:** 3-4 days  
**Dependencies:** Registry services

**Implementation:**

1. **Create search service:**

   ```typescript
   // src/features/search/service.ts
   export class SearchService {
     async searchMarketplace(query: string, options: SearchOptions): Promise<SearchResult[]> {
       const results = await Promise.all([
         this.searchVSMarketplace(query, options),
         this.searchOpenVSX(query, options),
       ]);

       return this.combineAndRankResults(results.flat());
     }

     private async searchVSMarketplace(
       query: string,
       options: SearchOptions,
     ): Promise<SearchResult[]> {
       // Use existing registry service
       return await this.registryService.search(query, { source: "marketplace", ...options });
     }
   }
   ```

2. **Create search command:**

   ```typescript
   // src/commands/search/index.ts
   export class SearchCommand extends BaseCommand {
     async execute(args: string[], options: SearchOptions): Promise<CommandResult> {
       const query = args.join(" ");
       if (!query) {
         throw new UserInputError("Search query required");
       }

       const results = await this.searchService.searchMarketplace(query, options);

       if (options.json) {
         console.log(JSON.stringify(results, null, 2));
       } else {
         this.displaySearchResults(results);
       }

       return { status: "ok", items: results };
     }
   }
   ```

**Files to Create:**

- [ ] Search service implementation
- [ ] Search command
- [ ] Result ranking algorithm
- [ ] Search result display

#### Task 13.2: Enhanced Info Command

**Priority:** Low  
**Estimated Time:** 2-3 days  
**Dependencies:** Task 13.1

**Implementation:**

1. **Enhance info command:**

   ```typescript
   // src/commands/info/index.ts
   export class InfoCommand extends BaseCommand {
     async execute(args: string[], options: InfoOptions): Promise<CommandResult> {
       const extensionId = args[0];
       if (!extensionId) {
         throw new UserInputError("Extension ID required");
       }

       const info = await this.getExtensionInfo(extensionId, options);

       if (options.json) {
         console.log(JSON.stringify(info, null, 2));
       } else {
         this.displayExtensionInfo(info);
       }

       return { status: "ok", extension: info };
     }

     private async getExtensionInfo(id: string, options: InfoOptions): Promise<ExtensionInfo> {
       // Get comprehensive extension information
       const [marketplaceInfo, installedInfo, versions] = await Promise.all([
         this.registryService.getExtensionInfo(id, "marketplace"),
         this.getInstalledInfo(id),
         this.registryService.getVersions(id),
       ]);

       return this.combineExtensionInfo(marketplaceInfo, installedInfo, versions);
     }
   }
   ```

**Files to Create:**

- [ ] Enhanced info command
- [ ] Extension information aggregation
- [ ] Rich information display
- [ ] Version comparison

**Deliverables:**

- [ ] Marketplace search functionality
- [ ] Enhanced extension information
- [ ] Better discoverability
- [ ] Rich command output

### Week 14: Final Polish & Documentation

#### Task 14.1: Command Aliases & Migration

**Priority:** Medium  
**Estimated Time:** 2-3 days  
**Dependencies:** All commands implemented

**Implementation:**

1. **Create alias system:**

   ```typescript
   // src/core/cli/aliases.ts
   export const COMMAND_ALIASES = {
     // User-friendly aliases
     get: "add",
     install: "add",
     upgrade: "update",

     // Migration helpers (show warnings)
     download: "add",
     "quick-install": "add",
     "from-list": "add",
     uninstall: "remove",
     "export-installed": "list",
   };

   export class AliasHandler {
     resolveCommand(command: string): { resolved: string; warning?: string } {
       const alias = COMMAND_ALIASES[command];
       if (!alias) return { resolved: command };

       const warning = this.getMigrationWarning(command, alias);
       return { resolved: alias, warning };
     }
   }
   ```

2. **Create migration warnings:**
   ```typescript
   // src/core/cli/migrationWarnings.ts
   export class MigrationWarnings {
     showCommandMigration(oldCommand: string, newCommand: string): void {
       log.warn(`⚠️  Command '${oldCommand}' is deprecated in v2.0`);
       log.info(`📚 Use '${newCommand}' instead`);
       log.info(`   See migration guide: https://github.com/.../MIGRATION.md`);
     }
   }
   ```

**Files to Create:**

- [ ] Alias system
- [ ] Migration warnings
- [ ] Help system updates
- [ ] Command routing

#### Task 14.2: Documentation & Migration Guide

**Priority:** High  
**Estimated Time:** 3-4 days  
**Dependencies:** All features complete

**Documentation to Create:**

1. **Migration Guide (`MIGRATION-v2.md`):**
   - Complete command mapping
   - Flag changes
   - Configuration changes
   - Breaking changes explanation
   - Step-by-step migration instructions

2. **Updated README:**
   - New command structure
   - New examples
   - Configuration documentation
   - Template system documentation

3. **API Documentation:**
   - JSON output contracts
   - Configuration schema
   - Template format
   - Workspace format

4. **Developer Documentation:**
   - Architecture overview
   - Extension guide
   - Contributing guide
   - Code structure

**Files to Create/Update:**

- [ ] `MIGRATION-v2.md`
- [ ] `README.md` (complete rewrite)
- [ ] `docs/` directory with comprehensive docs
- [ ] API documentation
- [ ] Configuration examples

**Deliverables:**

- [ ] Complete migration guide
- [ ] Updated documentation
- [ ] User-friendly examples
- [ ] Developer resources

#### Task 14.3: Final Integration & Bug Fixes

**Priority:** Critical  
**Estimated Time:** 2-3 days  
**Dependencies:** All development complete

**Final Tasks:**

- [ ] End-to-end testing
- [ ] Performance testing
- [ ] Bug fixes from testing
- [ ] Final code review
- [ ] Release preparation

---

## Testing Strategy

### Unit Testing

- **Coverage Target:** 90%+
- **Focus Areas:**
  - Input detection logic
  - Plan generation
  - Configuration loading
  - Error handling
  - Retry strategies

### Integration Testing

- **Test Scenarios:**
  - All command combinations
  - Flag combinations
  - Configuration precedence
  - Error recovery flows
  - Migration scenarios

### User Acceptance Testing

- **Test Groups:**
  - New users (never used v1)
  - Experienced users (migrating from v1)
  - CI/automation users
  - Team/workspace users

### Performance Testing

- **Benchmarks:**
  - Command startup time
  - Large list processing
  - Parallel download performance
  - Memory usage
  - Error handling overhead

---

## Migration & Release Strategy

### Pre-Release Testing

#### Beta Release (2 weeks before v2.0)

- [ ] Release `v2.0.0-beta.1` to npm with beta tag
- [ ] Recruit 50+ beta testers
- [ ] Collect feedback and bug reports
- [ ] Fix critical issues

#### Release Candidate (1 week before v2.0)

- [ ] Release `v2.0.0-rc.1`
- [ ] Final integration testing
- [ ] Documentation review
- [ ] Performance validation

### Release Communication

#### Documentation

- [ ] Detailed migration guide
- [ ] Breaking changes announcement
- [ ] New feature highlights
- [ ] Video tutorials for major workflows

#### Community Communication

- [ ] GitHub announcement
- [ ] Discord/community channels
- [ ] Blog post explaining changes
- [ ] Social media announcement

### Release Process

#### v2.0.0 Release

- [ ] Final code review
- [ ] Version bump and changelog
- [ ] Release to npm
- [ ] GitHub release with migration guide
- [ ] Monitor for issues and feedback

#### Post-Release Support

- [ ] Monitor GitHub issues
- [ ] Quick bug fixes in patch releases
- [ ] Community support
- [ ] Usage analytics (if available)

---

## Risk Management

### High-Risk Areas

#### 1. Input Detection Accuracy

- **Risk:** Misclassifying user inputs
- **Mitigation:**
  - Extensive test cases for edge cases
  - Clear error messages for ambiguous inputs
  - Plan preview shows detected type
  - Escape hatch for manual override

#### 2. Configuration Migration

- **Risk:** Losing user settings during migration
- **Mitigation:**
  - Always backup old config
  - Comprehensive migration testing
  - Rollback capability
  - Manual migration guide

#### 3. Performance Regression

- **Risk:** New features slow down common operations
- **Mitigation:**
  - Benchmarking against v1.16.0
  - Performance testing in CI
  - Optimization of critical paths
  - Parallel processing where possible

#### 4. User Adoption

- **Risk:** Users resist breaking changes
- **Mitigation:**
  - Clear communication of benefits
  - Comprehensive migration tooling
  - Helpful error messages for old commands
  - Community engagement and support

### Contingency Plans

#### Major Bug in Release

- [ ] Hot-fix process documented
- [ ] Rollback plan to previous version
- [ ] Quick patch release capability
- [ ] Community communication plan

#### Feature Removal

- [ ] Document any features that can't be migrated
- [ ] Provide alternatives or workarounds
- [ ] Clear timeline for deprecation
- [ ] User assistance for migration

---

## Technical Dependencies

### Available Packages (Already Installed)

```json
{
  "dependencies": {
    "@clack/prompts": "^0.7.0", // ✅ UI/Prompts
    "commander": "^11.1.0", // ✅ CLI parsing (use this, not yargs)
    "yaml": "^2.8.1", // ✅ Config files
    "fs-extra": "^11.2.0", // ✅ File operations
    "zod": "^4.1.5", // ✅ Schema validation (prefer over ajv)
    "axios": "^1.6.2", // ✅ HTTP requests
    "ajv": "^8.17.1" // ✅ JSON schema (fallback)
  }
}
```

### Architecture Strengths to Build On

- **Configuration System**: Existing precedence (CLI > ENV > FILE > DEFAULTS)
- **Error Handling**: `withConfigAndErrorHandling` wrapper
- **Type Safety**: Zod schemas for validation
- **Command Structure**: Commander with aliases and options

### Removed Packages

- Any old prompt libraries (if different from Clack)
- Unused CLI parsing libraries
- Deprecated utilities

### Build System

- Ensure TypeScript compilation works
- Update build scripts for new structure
- Verify all imports are correct
- Check for circular dependencies

---

## Success Criteria

### Quantitative Goals

- [ ] Command execution time: < 2 seconds for simple operations
- [ ] Error rate: < 5% in common workflows
- [ ] Test coverage: > 90%
- [ ] Documentation completeness: 100% API coverage
- [ ] Migration success rate: > 95%

### Qualitative Goals

- [ ] User feedback: "Easier to use than v1"
- [ ] Developer experience: Clear, maintainable code
- [ ] Documentation quality: Self-service for common issues
- [ ] Community adoption: Positive reception

### Launch Criteria

- [ ] All tests passing
- [ ] Documentation complete
- [ ] Migration guide tested
- [ ] Performance benchmarks met
- [ ] Security review complete
- [ ] Beta testing feedback addressed

---

## Timeline Summary

| Phase                 | Duration     | Key Deliverables                                   |
| --------------------- | ------------ | -------------------------------------------------- |
| Pre-Implementation    | 1 week       | Environment setup, planning                        |
| Phase 1: Foundation   | 4 weeks      | New command structure, smart routing, plan preview |
| Phase 2: Intelligence | 4 weeks      | Configuration system, retry logic, JSON output     |
| Phase 3: Advanced     | 6 weeks      | Workspace management, templates, search            |
| Testing & Release     | 2 weeks      | Final testing, documentation, release              |
| **Total**             | **17 weeks** | **Complete v2.0 refactor**                         |

---

## Next Steps

1. **Review and approve** this implementation plan
2. **Set up development environment** (Week 0)
3. **Begin Phase 1** with Task 1.1 (Command Framework)
4. **Regular check-ins** every 2 weeks to assess progress
5. **Adjust timeline** based on actual progress and feedback

---

**Document Status:** Living Document - Update as implementation progresses  
**Last Updated:** October 1, 2025  
**Next Review:** Start of each development phase
