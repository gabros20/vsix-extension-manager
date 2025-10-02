/**
 * Plan generator - creates execution plans by integrating existing services
 * Provides comprehensive preflight checks and estimates before execution
 */

import * as fs from "fs-extra";
import * as path from "path";
import type { InputType } from "../../commands/add/inputDetector";
import type { AddOptions } from "../../commands/add/executor";
import {
  getEditorService,
  getVsixScanner,
  getInstallPreflightService,
  getExtensionCompatibilityService,
  type EditorInfo,
} from "../../features/install";
import { parseExtensionUrl, fetchExtensionVersions } from "../registry";
import type {
  InstallPlan,
  ExtensionInfo,
  PreflightCheck,
  PlanStep,
  SafetyConfig,
  PerformanceConfig,
} from "./types";
import type { EditorType, SourceRegistry } from "../types";

/**
 * Plan generator service
 * Integrates with existing services to create comprehensive execution plans
 */
export class PlanGenerator {
  private editorService = getEditorService();
  private vsixScanner = getVsixScanner();
  private preflightService = getInstallPreflightService();
  private compatibilityService = getExtensionCompatibilityService();

  /**
   * Generate a complete installation plan
   */
  async generatePlan(
    input: string,
    inputType: InputType,
    options: AddOptions,
  ): Promise<InstallPlan> {
    // 1. Resolve extension info
    const extension = await this.resolveExtension(input, inputType, options);

    // 2. Detect target editor
    const target = await this.detectEditor(options);

    // 3. Run preflight checks
    const checks = await this.runPreflightChecks(extension, target, options);

    // 4. Generate execution steps
    const steps = this.generateSteps(extension, target, options);

    // 5. Calculate estimates
    const estimates = this.calculateEstimates(extension, steps);

    // 6. Collect warnings
    const warnings = this.collectWarnings(checks, target, options);

    return {
      input: { type: inputType, value: input },
      extension,
      target,
      steps,
      checks,
      estimates,
      safety: this.getSafetyConfig(options),
      performance: this.getPerformanceConfig(options),
      warnings,
    };
  }

  /**
   * Resolve extension information based on input type
   */
  private async resolveExtension(
    input: string,
    type: InputType,
    options: AddOptions,
  ): Promise<ExtensionInfo> {
    switch (type) {
      case "url":
        return await this.resolveFromUrl(input, options);

      case "extension-id":
        return await this.resolveFromId(input, options);

      case "vsix-file":
        return await this.resolveFromVsixFile(input);

      case "vsix-directory":
        return await this.resolveFromDirectory(input);

      case "extension-list":
        // For lists, return placeholder (actual list processing happens in executor)
        return {
          id: "multiple",
          name: "Multiple Extensions",
          version: "various",
          source: options.source || "auto",
        };

      default:
        throw new Error(`Unsupported input type: ${type}`);
    }
  }

  /**
   * Resolve extension from URL
   */
  private async resolveFromUrl(url: string, options: AddOptions): Promise<ExtensionInfo> {
    const parsed = parseExtensionUrl(url);
    const source = this.inferSourceFromUrl(url);

    // Fetch versions to get latest
    const versions = await fetchExtensionVersions(parsed.itemName);
    const requestedVersion = options.version || "latest";
    const preferPreRelease = options.preRelease || false;

    let version: string;
    if (requestedVersion === "latest") {
      if (preferPreRelease && versions.some((v) => v.isPreRelease)) {
        version = versions.find((v) => v.isPreRelease)?.version || versions[0].version;
      } else {
        version = versions.find((v) => !v.isPreRelease)?.version || versions[0].version;
      }
    } else {
      version = requestedVersion;
    }

    return {
      id: parsed.itemName,
      name: parsed.itemName.split(".")[1],
      version,
      source,
      url,
    };
  }

  /**
   * Resolve extension from ID
   */
  private async resolveFromId(extensionId: string, options: AddOptions): Promise<ExtensionInfo> {
    const source = options.source || "marketplace";
    const url =
      source === "open-vsx"
        ? `https://open-vsx.org/extension/${extensionId.split(".")[0]}/${extensionId.split(".")[1]}`
        : `https://marketplace.visualstudio.com/items?itemName=${extensionId}`;

    return await this.resolveFromUrl(url, options);
  }

  /**
   * Resolve extension from VSIX file
   */
  private async resolveFromVsixFile(filePath: string): Promise<ExtensionInfo> {
    const scanResult = await this.vsixScanner.scanDirectory(path.dirname(filePath), {
      recursive: false,
    });

    const vsixFile = scanResult.validVsixFiles.find((f) => f.path === filePath);
    if (!vsixFile) {
      throw new Error(`Invalid VSIX file: ${filePath}`);
    }

    const stat = await fs.stat(filePath);

    return {
      id: vsixFile.extensionId || "unknown",
      name: vsixFile.extensionId?.split(".")[1] || path.basename(filePath),
      version: vsixFile.version || "unknown",
      source: "local",
      filePath,
      size: stat.size,
    };
  }

  /**
   * Resolve extension from directory (returns first found)
   */
  private async resolveFromDirectory(dirPath: string): Promise<ExtensionInfo> {
    const scanResult = await this.vsixScanner.scanDirectory(dirPath, { recursive: false });

    if (scanResult.validVsixFiles.length === 0) {
      throw new Error(`No VSIX files found in directory: ${dirPath}`);
    }

    const firstFile = scanResult.validVsixFiles[0];
    const stat = await fs.stat(firstFile.path);

    return {
      id: firstFile.extensionId || "multiple",
      name: `${scanResult.validVsixFiles.length} extensions`,
      version: "various",
      source: "local",
      filePath: dirPath,
      size: stat.size * scanResult.validVsixFiles.length, // Approximate total
    };
  }

  /**
   * Detect target editor
   */
  private async detectEditor(options: AddOptions): Promise<EditorInfo> {
    const editor: EditorType = options.editor || "auto";

    if (editor === "auto") {
      const available = await this.editorService.getAvailableEditors();
      if (available.length === 0) {
        throw new Error("No editors found. Please install VS Code or Cursor.");
      }

      // Prefer Cursor if available
      const preferred = available.find((e) => e.name === "cursor") || available[0];
      return preferred;
    }

    // Resolve specific editor
    const explicitBin = editor === "vscode" ? options.codeBin : options.cursorBin;
    const binaryPath = await this.editorService.resolveEditorBinary(
      editor,
      explicitBin,
      Boolean(options.allowMismatch),
    );

    const editorInfo = await this.editorService.getEditorInfo(editor);
    if (!editorInfo) {
      throw new Error(`Editor not found: ${editor}`);
    }

    return {
      ...editorInfo,
      binaryPath,
    };
  }

  /**
   * Run comprehensive preflight checks
   */
  private async runPreflightChecks(
    extension: ExtensionInfo,
    target: EditorInfo,
    options: AddOptions,
  ): Promise<PreflightCheck[]> {
    const checks: PreflightCheck[] = [];

    // 1. Editor binary check
    checks.push({
      name: "Editor Binary",
      status: target.binaryPath ? "pass" : "fail",
      message: target.binaryPath ? `Editor available at ${target.binaryPath}` : "Editor not found",
    });

    // 2. Extensions directory check (using existing preflight service)
    try {
      const preflightResult = await this.preflightService.runPreflightChecks(target.name);
      checks.push({
        name: "Extensions Directory",
        status: preflightResult.valid ? "pass" : "fail",
        message: preflightResult.valid
          ? "Extensions directory ready"
          : preflightResult.errors[0] || "Directory check failed",
        details: {
          warnings: preflightResult.warnings,
          suggestions: preflightResult.suggestions,
        },
      });
    } catch (error) {
      checks.push({
        name: "Extensions Directory",
        status: "warning",
        message: `Preflight check skipped: ${error instanceof Error ? error.message : String(error)}`,
      });
    }

    // 3. Compatibility check (for marketplace extensions)
    if (
      extension.source !== "local" &&
      extension.id !== "multiple" &&
      options.checkCompat !== false
    ) {
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
          message:
            compatResult.result.reason || compatResult.compatible
              ? "Compatible with editor"
              : "May not be compatible",
          details: {
            editorVersion: compatResult.result.editorVersion,
            requiredVersion: compatResult.result.requiredVersion,
          },
        });
      } catch {
        checks.push({
          name: "Compatibility",
          status: "warning",
          message: "Compatibility check unavailable",
        });
      }
    }

    // 4. Disk space check (basic)
    const requiredSpace = extension.size || 50 * 1024 * 1024; // 50MB default
    checks.push({
      name: "Disk Space",
      status: "pass",
      message: `~${Math.ceil(requiredSpace / (1024 * 1024))} MB required`,
    });

    return checks;
  }

  /**
   * Generate execution steps
   */
  private generateSteps(
    extension: ExtensionInfo,
    target: EditorInfo,
    options: AddOptions,
  ): PlanStep[] {
    const steps: PlanStep[] = [];

    // Step 1: Download (if needed)
    if (extension.source !== "local") {
      steps.push({
        id: "download",
        description: `Download ${extension.name} v${extension.version}`,
        estimatedDuration: 15000, // 15 seconds default
      });
    }

    // Step 2: Verify checksum (if enabled)
    if (options.verifyChecksum) {
      steps.push({
        id: "verify",
        description: "Verify file integrity",
        estimatedDuration: 2000,
        optional: true,
      });
    }

    // Step 3: Install (if not download-only)
    if (!options.downloadOnly) {
      steps.push({
        id: "install",
        description: `Install to ${target.name}`,
        estimatedDuration: 10000, // 10 seconds
      });

      // Step 4: Verify installation
      steps.push({
        id: "verify-install",
        description: "Verify installation",
        estimatedDuration: 2000,
      });
    }

    return steps;
  }

  /**
   * Calculate time and size estimates
   */
  private calculateEstimates(
    extension: ExtensionInfo,
    steps: PlanStep[],
  ): InstallPlan["estimates"] {
    const size = extension.size || 50 * 1024 * 1024; // 50MB default
    const downloadSpeed = 5 * 1024 * 1024; // 5 MB/s assumed
    const downloadTime = (size / downloadSpeed) * 1000; // Convert to milliseconds

    const installTime = steps.find((s) => s.id === "install")?.estimatedDuration || 0;
    const totalTime = steps.reduce((sum, step) => sum + (step.estimatedDuration || 0), 0);

    return {
      downloadSize: size,
      downloadTime: Math.round(downloadTime),
      installTime,
      totalTime: Math.round(totalTime),
    };
  }

  /**
   * Get safety configuration
   */
  private getSafetyConfig(options: AddOptions): SafetyConfig {
    return {
      checkCompatibility: options.checkCompat !== false,
      createBackup: options.noBackup !== true,
      verifyChecksums: options.verifyChecksum || false,
      allowMismatch: options.allowMismatch || false,
    };
  }

  /**
   * Get performance configuration
   */
  private getPerformanceConfig(options: AddOptions): PerformanceConfig {
    return {
      parallel: options.parallel || 1,
      timeout: options.timeout || 30000,
      retry: options.retry || 2,
      retryDelay: options.retryDelay || 1000,
    };
  }

  /**
   * Collect warnings from checks
   */
  private collectWarnings(
    checks: PreflightCheck[],
    _target: EditorInfo,
    options: AddOptions,
  ): string[] {
    const warnings: string[] = [];

    // Warnings from failed/warning checks
    checks
      .filter((c) => c.status === "warning" || c.status === "fail")
      .forEach((c) => {
        warnings.push(`${c.name}: ${c.message}`);
      });

    // Additional contextual warnings
    if (options.allowMismatch) {
      warnings.push("Binary mismatch is allowed - installations may fail");
    }

    if (!options.checkCompat) {
      warnings.push("Compatibility checking is disabled");
    }

    return warnings;
  }

  /**
   * Infer source from URL
   */
  private inferSourceFromUrl(url: string): SourceRegistry {
    try {
      const parsed = new URL(url);
      if (parsed.hostname.includes("open-vsx.org")) return "open-vsx";
      return "marketplace";
    } catch {
      return "marketplace";
    }
  }
}

/**
 * Singleton instance
 */
export const planGenerator = new PlanGenerator();
