/**
 * Add command executor - handles all input types using existing services
 * Consolidates logic from quickInstall, fromList, install, and download commands
 *
 * Integration Phase: Now uses CommandResultBuilder and SmartRetryService
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
import { CommandResultBuilder } from "../../core/output/CommandResultBuilder";
import { smartRetryService } from "../../core/retry";

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
   * Integration Phase: Uses CommandResultBuilder for consistent output
   */
  async execute(detection: DetectionResult, options: AddOptions): Promise<CommandResult> {
    try {
      switch (detection.type) {
        case "url":
          return await this.executeUrlFlow(detection.value, options);

        case "extension-id":
          return await this.executeExtensionIdFlow(detection.value, options);

        case "vsix-file":
          return await this.executeFileFlow(detection.value, options);

        case "vsix-directory":
          return await this.executeDirectoryFlow(detection.value, options);

        case "extension-list":
          return await this.executeListFlow(detection.value, options);

        default:
          throw new Error(`Unsupported input type: ${detection.type}`);
      }
    } catch (error) {
      return CommandResultBuilder.fromError(
        "add",
        error instanceof Error ? error : new Error(String(error)),
      );
    }
  }

  /**
   * Handle URL input (marketplace/open-vsx)
   * Refactored from quickInstall.ts
   * Integration Phase: Uses CommandResultBuilder + SmartRetryService
   */
  private async executeUrlFlow(url: string, options: AddOptions): Promise<CommandResult> {
    const builder = new CommandResultBuilder("add");
    const extensionId = parseExtensionUrl(url).itemName;

    // Create temp directory for download
    const tempDirName = `vsix-add-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const tempDir = path.join(os.tmpdir(), tempDirName);
    const outputDir = options.output || tempDir;

    await fs.ensureDir(outputDir);

    try {
      // Download extension with retry
      const downloadResult = await smartRetryService.executeWithRetry(
        {
          name: `Download ${extensionId}`,
          run: async (context) => {
            const request: SingleDownloadRequest = {
              url,
              requestedVersion: options.version || "latest",
              preferPreRelease: Boolean(options.preRelease),
              source: options.source,
              outputDir,
              fileExistsAction: options.force ? FileExistsAction.OVERWRITE : FileExistsAction.SKIP,
              quiet: Boolean(options.quiet),
            };
            return await downloadSingleExtension(request);
          },
        },
        {
          maxAttempts: options.retry || 3,
          timeout: options.timeout,
          metadata: { quiet: options.quiet },
        },
      );

      if (!downloadResult.success) {
        builder.addFailure({
          id: extensionId,
          name: extensionId,
        });
        builder.addError({
          code: "DOWNLOAD_FAILED",
          message: downloadResult.error?.message || "Download failed",
        });
        return builder.setSummary(`Failed to download ${extensionId}`).build();
      }

      const downloadData = downloadResult.data!;
      const downloadedPath =
        downloadData.filePath || path.join(downloadData.outputDir, downloadData.filename);

      // If download-only, stop here
      if (options.downloadOnly) {
        builder.addSuccess({
          id: extensionId,
          name: extensionId,
          version: downloadData.resolvedVersion,
          details: {
            path: downloadedPath,
          },
        });
        return builder.setSummary(`Downloaded ${downloadData.filename}`).build();
      }

      // Install extension with retry
      const installResult = await smartRetryService.executeWithRetry(
        {
          name: `Install ${extensionId}`,
          run: async (context) => {
            return await this.installSingleFile(downloadedPath, options);
          },
        },
        {
          maxAttempts: options.retry || 3,
          timeout: options.timeout,
          metadata: {
            quiet: options.quiet,
            supportsDownloadOnly: true,
            downloadedPath,
          },
        },
      );

      // Cleanup temp directory if used
      if (outputDir === tempDir) {
        await fs.remove(tempDir);
      }

      if (!installResult.success || !installResult.data?.success) {
        builder.addFailure({
          id: extensionId,
          name: extensionId,
          version: downloadData.resolvedVersion,
        });
        builder.addError({
          code: "INSTALL_FAILED",
          message: installResult.error?.message || installResult.data?.error || "Install failed",
        });
        return builder.setSummary(`Failed to install ${downloadData.filename}`).build();
      }

      builder.addSuccess({
        id: extensionId,
        name: extensionId,
        version: downloadData.resolvedVersion,
      });
      return builder.setSummary(`Installed ${downloadData.filename}`).build();
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
  ): Promise<CommandResult> {
    // Convert extension ID to marketplace URL
    const source = options.source || "marketplace";
    const url =
      source === "open-vsx"
        ? `https://open-vsx.org/extension/${extensionId.split(".")[0]}/${extensionId.split(".")[1]}`
        : `https://marketplace.visualstudio.com/items?itemName=${extensionId}`;

    return this.executeUrlFlow(url, options);
  }

  /**
   * Handle VSIX file input
   * Refactored from install.ts
   * Integration Phase: Uses CommandResultBuilder + SmartRetryService
   */
  private async executeFileFlow(filePath: string, options: AddOptions): Promise<CommandResult> {
    const builder = new CommandResultBuilder("add");
    const fileName = path.basename(filePath);

    if (options.downloadOnly) {
      builder.addSkipped({
        id: fileName,
        name: fileName,
      });
      return builder.setSummary("File already exists (download-only mode)").build();
    }

    // Install file with retry
    const installResult = await smartRetryService.executeWithRetry(
      {
        name: `Install ${fileName}`,
        run: async (context) => {
          return await this.installSingleFile(filePath, options);
        },
      },
      {
        maxAttempts: options.retry || 3,
        timeout: options.timeout,
        metadata: { quiet: options.quiet },
      },
    );

    if (!installResult.success || !installResult.data?.success) {
      builder.addFailure({
        id: fileName,
        name: fileName,
      });
      builder.addError({
        code: "INSTALL_FAILED",
        message: installResult.error?.message || installResult.data?.error || "Install failed",
      });
      return builder.setSummary(`Failed to install ${fileName}`).build();
    }

    builder.addSuccess({
      id: fileName,
      name: fileName,
    });
    return builder.setSummary(`Installed ${fileName}`).build();
  }

  /**
   * Handle directory with VSIX files
   * Refactored from install.ts
   * Integration Phase: Uses CommandResultBuilder (retry handled by bulk install service)
   */
  private async executeDirectoryFlow(dirPath: string, options: AddOptions): Promise<CommandResult> {
    const builder = new CommandResultBuilder("add");

    // Scan directory for VSIX files
    const scanner = getVsixScanner();
    const scanResult: ScanResult = await scanner.scanDirectory(dirPath, { recursive: false });

    if (scanResult.validVsixFiles.length === 0) {
      builder.addError({
        code: "NO_FILES",
        message: "No valid VSIX files found in directory",
      });
      return builder.setSummary("No valid VSIX files found").build();
    }

    if (options.downloadOnly) {
      scanResult.validVsixFiles.forEach((file) => {
        builder.addSkipped({
          id: path.basename(file.path),
          name: path.basename(file.path),
        });
      });
      return builder
        .setSummary(`Found ${scanResult.validVsixFiles.length} VSIX files (download-only mode)`)
        .build();
    }

    // Install all VSIX files (bulk install service has its own retry logic)
    const installService = getInstallService();
    const editorInfo = await this.resolveEditor(options);

    const tasks = scanResult.validVsixFiles.map((f) => ({
      vsixFile: f,
    }));

    const results = await installService.installBulkVsix(editorInfo.binaryPath, tasks, {
      parallel: options.parallel || 1,
      timeout: options.timeout || 30000,
      dryRun: options.dryRun || false,
    });

    // Add results to builder
    (results.results || []).forEach((r: any) => {
      if (r.success) {
        builder.addSuccess({
          id: path.basename(r.vsixPath),
          name: path.basename(r.vsixPath),
        });
      } else {
        builder.addFailure({
          id: path.basename(r.vsixPath),
          name: path.basename(r.vsixPath),
        });
        builder.addError({
          code: "INSTALL_FAILED",
          message: r.error || "Unknown error",
          item: path.basename(r.vsixPath),
        });
      }
    });

    return builder
      .setSummary(
        `Installed ${results.successful} of ${scanResult.validVsixFiles.length} extensions`,
      )
      .build();
  }

  /**
   * Handle extension list input
   * Refactored from fromList.ts
   * Integration Phase: Uses CommandResultBuilder (retry handled by bulk services)
   */
  private async executeListFlow(listPath: string, options: AddOptions): Promise<CommandResult> {
    const builder = new CommandResultBuilder("add");
    const installFromListService = getInstallFromListService();
    const editorInfo = await this.resolveEditor(options);

    // Call installFromList with proper parameters (has built-in retry for downloads and installs)
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

    // Note: InstallFromListResult doesn't expose individual extension results
    // We can only report aggregate counts
    const successful = options.downloadOnly
      ? result.downloadResult?.successful || 0
      : result.installResult?.successful || 0;
    const failed = options.downloadOnly
      ? result.downloadResult?.failed || 0
      : result.installResult?.failed || 0;
    const skipped = result.installResult?.skipped || 0;

    // Add a single aggregate item to represent the batch operation
    if (successful > 0) {
      builder.addSuccess({
        id: path.basename(listPath),
        name: `${successful} extensions from list`,
      });
    }

    if (failed > 0) {
      builder.addFailure({
        id: path.basename(listPath),
        name: `${failed} extensions failed`,
      });
    }

    const summary = options.downloadOnly
      ? `Downloaded ${successful} of ${successful + failed} extensions`
      : `Installed ${successful} of ${successful + failed} extensions`;

    return builder.setSummary(summary).build();
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
