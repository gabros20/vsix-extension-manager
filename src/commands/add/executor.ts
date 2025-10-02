/**
 * Add command executor - handles all input types using existing services
 * Consolidates logic from quickInstall, fromList, install, and download commands
 */

import * as fs from "fs-extra";
import * as path from "path";
import * as os from "os";
import type { CommandResult } from "../base/types";
import type { DetectionResult } from "./inputDetector";
import {
  downloadSingleExtension,
  type SingleDownloadRequest,
  type SingleDownloadResult,
} from "../../features/download";
import {
  getEditorService,
  getInstallService,
  getVsixScanner,
  getInstallFromListService,
  type EditorInfo,
  type ScanResult,
} from "../../features/install";
import { FileExistsAction } from "../../core/filesystem";
import type { EditorType, SourceRegistry } from "../../core/types";
import { parseExtensionUrl } from "../../core/registry";

/**
 * Options for the add command
 */
export interface AddOptions {
  // Editor options
  editor?: EditorType;
  codeBin?: string;
  cursorBin?: string;
  allowMismatch?: boolean;

  // Source and version
  source?: SourceRegistry;
  version?: string;
  preRelease?: boolean;

  // Behavior
  downloadOnly?: boolean;
  skipInstalled?: boolean;
  force?: boolean;
  output?: string;

  // Performance
  parallel?: number;
  timeout?: number;
  retry?: number;
  retryDelay?: number;

  // Safety
  checkCompat?: boolean;
  noBackup?: boolean;
  verifyChecksum?: boolean;

  // Output modes
  quiet?: boolean;
  json?: boolean;
  yes?: boolean;
  dryRun?: boolean;
}

/**
 * Add command executor
 */
export class AddExecutor {
  /**
   * Execute add command based on detected input type
   */
  async execute(detection: DetectionResult, options: AddOptions): Promise<CommandResult> {
    const startTime = Date.now();

    try {
      switch (detection.type) {
        case "url":
          return await this.executeUrlFlow(detection.value, options, startTime);

        case "extension-id":
          return await this.executeExtensionIdFlow(detection.value, options, startTime);

        case "vsix-file":
          return await this.executeFileFlow(detection.value, options, startTime);

        case "vsix-directory":
          return await this.executeDirectoryFlow(detection.value, options, startTime);

        case "extension-list":
          return await this.executeListFlow(detection.value, options, startTime);

        default:
          throw new Error(`Unsupported input type: ${detection.type}`);
      }
    } catch (error) {
      return {
        status: "error",
        command: "add",
        summary: `Failed: ${error instanceof Error ? error.message : String(error)}`,
        errors: [
          {
            code: "EXECUTION_FAILED",
            message: error instanceof Error ? error.message : String(error),
          },
        ],
        totals: {
          success: 0,
          failed: 1,
          skipped: 0,
          duration: Date.now() - startTime,
        },
      };
    }
  }

  /**
   * Handle URL input (marketplace/open-vsx)
   * Refactored from quickInstall.ts
   */
  private async executeUrlFlow(
    url: string,
    options: AddOptions,
    startTime: number,
  ): Promise<CommandResult> {
    // Create temp directory for download
    const tempDirName = `vsix-add-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const tempDir = path.join(os.tmpdir(), tempDirName);
    const outputDir = options.output || tempDir;

    await fs.ensureDir(outputDir);

    try {
      // Download extension
      const request: SingleDownloadRequest = {
        url,
        requestedVersion: options.version || "latest",
        preferPreRelease: Boolean(options.preRelease),
        source: options.source,
        outputDir,
        fileExistsAction: options.force ? FileExistsAction.OVERWRITE : FileExistsAction.SKIP,
        quiet: Boolean(options.quiet),
      };

      const downloadResult: SingleDownloadResult = await downloadSingleExtension(request);
      const downloadedPath =
        downloadResult.filePath || path.join(downloadResult.outputDir, downloadResult.filename);

      // If download-only, stop here
      if (options.downloadOnly) {
        return {
          status: "ok",
          command: "add",
          summary: `Downloaded ${downloadResult.filename}`,
          items: [
            {
              id: parseExtensionUrl(url).itemName,
              version: downloadResult.resolvedVersion,
              status: "success",
              duration: Date.now() - startTime,
              details: {
                path: downloadedPath,
              },
            },
          ],
          totals: {
            success: 1,
            failed: 0,
            skipped: 0,
            duration: Date.now() - startTime,
          },
        };
      }

      // Install extension
      const installResult = await this.installSingleFile(downloadedPath, options);

      // Cleanup temp directory if used
      if (outputDir === tempDir) {
        await fs.remove(tempDir);
      }

      return {
        status: "ok",
        command: "add",
        summary: `Installed ${downloadResult.filename}`,
        items: [
          {
            id: parseExtensionUrl(url).itemName,
            version: downloadResult.resolvedVersion,
            status: installResult.success ? "success" : "failed",
            duration: Date.now() - startTime,
          },
        ],
        errors: installResult.success
          ? []
          : [{ code: "INSTALL_FAILED", message: installResult.error || "Unknown error" }],
        totals: {
          success: installResult.success ? 1 : 0,
          failed: installResult.success ? 0 : 1,
          skipped: 0,
          duration: Date.now() - startTime,
        },
      };
    } finally {
      // Ensure cleanup even on error
      if (outputDir === tempDir && (await fs.pathExists(tempDir))) {
        await fs.remove(tempDir);
      }
    }
  }

  /**
   * Handle extension ID input (publisher.name)
   * Converts to marketplace URL and uses URL flow
   */
  private async executeExtensionIdFlow(
    extensionId: string,
    options: AddOptions,
    startTime: number,
  ): Promise<CommandResult> {
    // Convert extension ID to marketplace URL
    const source = options.source || "marketplace";
    const url =
      source === "open-vsx"
        ? `https://open-vsx.org/extension/${extensionId.split(".")[0]}/${extensionId.split(".")[1]}`
        : `https://marketplace.visualstudio.com/items?itemName=${extensionId}`;

    return this.executeUrlFlow(url, options, startTime);
  }

  /**
   * Handle VSIX file input
   * Refactored from install.ts
   */
  private async executeFileFlow(
    filePath: string,
    options: AddOptions,
    startTime: number,
  ): Promise<CommandResult> {
    if (options.downloadOnly) {
      return {
        status: "ok",
        command: "add",
        summary: "File already exists (download-only mode)",
        items: [
          {
            id: path.basename(filePath),
            status: "skipped",
            duration: 0,
          },
        ],
        totals: {
          success: 0,
          failed: 0,
          skipped: 1,
          duration: Date.now() - startTime,
        },
      };
    }

    const installResult = await this.installSingleFile(filePath, options);

    return {
      status: installResult.success ? "ok" : "error",
      command: "add",
      summary: installResult.success
        ? `Installed ${path.basename(filePath)}`
        : `Failed to install ${path.basename(filePath)}`,
      items: [
        {
          id: path.basename(filePath),
          status: installResult.success ? "success" : "failed",
          duration: Date.now() - startTime,
        },
      ],
      errors: installResult.success
        ? []
        : [{ code: "INSTALL_FAILED", message: installResult.error || "Unknown error" }],
      totals: {
        success: installResult.success ? 1 : 0,
        failed: installResult.success ? 0 : 1,
        skipped: 0,
        duration: Date.now() - startTime,
      },
    };
  }

  /**
   * Handle directory with VSIX files
   * Refactored from install.ts
   */
  private async executeDirectoryFlow(
    dirPath: string,
    options: AddOptions,
    startTime: number,
  ): Promise<CommandResult> {
    // Scan directory for VSIX files
    const scanner = getVsixScanner();
    const scanResult: ScanResult = await scanner.scanDirectory(dirPath, { recursive: false });

    if (scanResult.validVsixFiles.length === 0) {
      return {
        status: "error",
        command: "add",
        summary: "No valid VSIX files found",
        errors: [{ code: "NO_FILES", message: "No valid VSIX files found in directory" }],
        totals: {
          success: 0,
          failed: 0,
          skipped: 0,
          duration: Date.now() - startTime,
        },
      };
    }

    if (options.downloadOnly) {
      return {
        status: "ok",
        command: "add",
        summary: `Found ${scanResult.validVsixFiles.length} VSIX files (download-only mode)`,
        items: scanResult.validVsixFiles.map((file) => ({
          id: path.basename(file.path),
          status: "skipped" as const,
          duration: 0,
        })),
        totals: {
          success: 0,
          failed: 0,
          skipped: scanResult.validVsixFiles.length,
          duration: Date.now() - startTime,
        },
      };
    }

    // Install all VSIX files
    const installService = getInstallService();
    const editorInfo = await this.resolveEditor(options);

    const tasks = scanResult.validVsixFiles.map((f) => ({
      vsixFile: f, // InstallTask requires vsixFile property
    }));

    const results = await installService.installBulkVsix(editorInfo.binaryPath, tasks, {
      parallel: options.parallel || 1,
      timeout: options.timeout || 30000,
      dryRun: options.dryRun || false,
    });

    return {
      status: "ok",
      command: "add",
      summary: `Installed ${results.successful} of ${scanResult.validVsixFiles.length} extensions`,
      items: (results.results || []).map((r: any) => ({
        id: path.basename(r.vsixPath),
        status: r.success ? ("success" as const) : ("failed" as const),
        duration: r.duration || 0,
      })),
      errors: Array.isArray(results.failed)
        ? results.failed.map((r: any) => ({
            code: "INSTALL_FAILED",
            message: r.error || "Unknown error",
            item: path.basename(r.vsixPath),
          }))
        : [],
      totals: {
        success: results.successful,
        failed: Array.isArray(results.failed) ? results.failed.length : results.failed,
        skipped: results.skipped,
        duration: Date.now() - startTime,
      },
    };
  }

  /**
   * Handle extension list input
   * Refactored from fromList.ts
   */
  private async executeListFlow(
    listPath: string,
    options: AddOptions,
    startTime: number,
  ): Promise<CommandResult> {
    const installFromListService = getInstallFromListService();
    const editorInfo = await this.resolveEditor(options);

    // Note: installFromList takes complex nested options structure
    // Options are configured directly in the call below

    // Call installFromList with proper parameters
    const result = await installFromListService.installFromList(
      editorInfo.binaryPath,
      listPath,
      [options.output || "./downloads"],
      {
        downloadMissing: !options.downloadOnly,
        downloadOptions: {
          parallel: options.parallel || 3,
          source: options.source as any,
          preRelease: options.preRelease || false,
        },
        installOptions: {
          parallel: 1,
          timeout: options.timeout || 30000,
          retry: options.retry || 2,
          dryRun: options.dryRun || false,
        },
      },
    );

    return {
      status: "ok",
      command: "add",
      summary: options.downloadOnly
        ? `Downloaded ${result.downloadResult?.successful || 0} extensions`
        : `Installed ${result.installResult?.successful || 0} extensions`,
      items: [], // TODO: InstallFromListResult doesn't have extensions array to map
      totals: {
        success: options.downloadOnly
          ? result.downloadResult?.successful || 0
          : result.installResult?.successful || 0,
        failed: options.downloadOnly
          ? result.downloadResult?.failed || 0
          : result.installResult?.failed || 0,
        skipped: result.installResult?.skipped || 0,
        duration: Date.now() - startTime,
      },
    };
  }

  /**
   * Install a single VSIX file
   * Common logic extracted from multiple flows
   */
  private async installSingleFile(
    vsixPath: string,
    options: AddOptions,
  ): Promise<{ success: boolean; error?: string }> {
    const installService = getInstallService();
    const editorInfo = await this.resolveEditor(options);

    const result = await installService.installSingleVsix(editorInfo.binaryPath, vsixPath, {
      dryRun: options.dryRun,
      forceReinstall: options.force,
      timeout: options.timeout || 30000,
    });

    return result;
  }

  /**
   * Resolve target editor
   * Common logic extracted from multiple flows
   */
  private async resolveEditor(options: AddOptions): Promise<EditorInfo> {
    const editorService = getEditorService();
    const editor = options.editor || "auto";

    if (editor === "auto") {
      // Auto-detect: prefer Cursor if available
      const available = await editorService.getAvailableEditors();
      if (available.length === 0) {
        throw new Error("No editors found. Please install VS Code or Cursor.");
      }
      const preferred = available.find((e) => e.name === "cursor") || available[0];
      return preferred;
    }

    // Resolve specific editor
    const explicitBin = editor === "vscode" ? options.codeBin : options.cursorBin;
    const binaryPath = await editorService.resolveEditorBinary(
      editor,
      explicitBin,
      Boolean(options.allowMismatch),
    );

    const editorInfo = await editorService.getEditorInfo(editor);
    if (!editorInfo) {
      throw new Error(`Editor not found: ${editor}`);
    }

    return {
      ...editorInfo,
      binaryPath,
    };
  }
}

/**
 * Singleton instance
 */
export const addExecutor = new AddExecutor();
