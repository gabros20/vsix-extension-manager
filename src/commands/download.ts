import * as p from "@clack/prompts";
import path from "path";
import {
  constructDownloadUrl,
  getDisplayNameFromUrl,
  constructOpenVsxDownloadUrl,
  parseExtensionUrl,
  inferSourceFromUrl,
  resolveVersion,
} from "../core/registry";
import { FileExistsAction, generateFilename, DEFAULT_FILENAME_TEMPLATE } from "../core/filesystem";
import {
  downloadBulkExtensions,
  downloadSingleExtension as performSingleDownload,
} from "../features/download";
import type { BulkOptions, SingleDownloadRequest } from "../features/download";
import {
  generateSHA256,
  verifySHA256,
  isValidSHA256,
  formatHashForDisplay,
} from "../core/filesystem";
import { ProgressInfo, formatBytes, createProgressBar } from "../core/ui/progress";
import { truncateText, buildBulkOptionsFromCli, shouldUpdateProgress } from "../core/helpers";
import { DEFAULT_OUTPUT_DIR } from "../config/constants";

// duplicated helper removed in favor of core/helpers

interface DownloadOptions {
  url?: string;
  version?: string;
  output?: string;
  file?: string; // bulk JSON path (non-interactive)
  parallel?: number | string;
  retry?: number | string;
  retryDelay?: number | string;
  skipExisting?: boolean;
  overwrite?: boolean;
  quiet?: boolean;
  json?: boolean;
  summary?: string;
  preRelease?: boolean;
  source?: string;
  filenameTemplate?: string;
  cacheDir?: string;
  checksum?: boolean;
  verifyChecksum?: string;
  installAfter?: boolean;
}

export async function downloadVsix(options: DownloadOptions) {
  console.clear();

  p.intro("🔽 VSIX Extension Manager");

  try {
    // If a bulk file is provided, run bulk mode non-interactively
    if (options.file) {
      await downloadBulkFromJson(options);
      return;
    }

    // If command line options for single are provided, skip mode selection and go straight to single download
    if (options.url || options.version) {
      await downloadSingleExtension(options);
      return;
    }

    // Ask user to choose download mode
    const downloadMode = await p.select({
      message: "Choose download mode:",
      options: [
        {
          value: "single",
          label: "Download single extension from marketplace URL",
          hint: "Provide extension URL and version (or latest)",
        },
        {
          value: "bulk",
          label: "Download multiple extensions from JSON collection (URLs + versions)",
          hint: "Provide a JSON file of { url, version, source? } entries",
        },
      ],
    });

    if (p.isCancel(downloadMode)) {
      p.cancel("Operation cancelled.");
      process.exit(0);
    }

    if (downloadMode === "single") {
      await downloadSingleExtension(options);
    } else {
      await downloadBulkFromJson(options);
    }
  } catch (error) {
    p.log.error("❌ Error: " + (error instanceof Error ? error.message : String(error)));
    process.exit(1);
  }
}

async function downloadSingleExtension(options: DownloadOptions) {
  // Get marketplace URL
  let marketplaceUrl = options.url;
  if (!marketplaceUrl) {
    const urlResult = await p.text({
      message: "Enter the extension URL (Marketplace or OpenVSX):",
      validate: (input: string) => {
        if (!input.trim()) {
          return "Please enter a valid URL";
        }
        return undefined;
      },
    });

    if (p.isCancel(urlResult)) {
      p.cancel("Operation cancelled.");
      process.exit(0);
    }

    marketplaceUrl = urlResult as string;
  }

  // Parse URL to extract extension info (for display only)
  const parseSpinner = p.spinner();
  parseSpinner.start("Parsing extension URL...");
  let extensionInfo;
  try {
    extensionInfo = parseExtensionUrl(marketplaceUrl as string);
    parseSpinner.stop("Extension info extracted");
  } catch (error) {
    parseSpinner.stop("Failed to parse extension URL", 1);
    throw error;
  }

  const displayName = getDisplayNameFromUrl(marketplaceUrl as string);
  p.note(`${displayName}`, "Extension");

  // Get version
  let version = options.version;
  if (!version) {
    const versionResult = await p.text({
      message: "Enter the extension version (or use version number):",
      placeholder: "e.g., 1.2.3 or latest",
      initialValue: "latest",
      validate: (input: string) => {
        if (!input.trim()) {
          return "Please enter a version number";
        }
        const v = input.trim().toLowerCase();
        if (v === "latest") return undefined;
        // Basic semver validation (allow optional prerelease)
        if (!/^\d+\.\d+\.\d+(?:-.+)?$/.test(v)) {
          return "Enter a valid version (e.g., 1.2.3) or 'latest'";
        }
        return undefined;
      },
    });

    if (p.isCancel(versionResult)) {
      p.cancel("Operation cancelled.");
      process.exit(0);
    }

    version = (versionResult as string).trim();
  }

  // Source selection (interactive with default inference)
  let effectiveSource = (
    options.source || inferSourceFromUrl(marketplaceUrl as string)
  ).toLowerCase();
  if (!options.source) {
    const pick = await p.select({
      message: "Select source registry:",
      options: [
        { value: "marketplace", label: "Visual Studio Marketplace" },
        { value: "open-vsx", label: "OpenVSX" },
      ],
      initialValue: effectiveSource,
    });
    if (p.isCancel(pick)) {
      p.cancel("Operation cancelled.");
      process.exit(0);
    }
    effectiveSource = (pick as string).toLowerCase();
  }

  // Determine file exists behavior
  let fileExistsAction: FileExistsAction;
  if (options.skipExisting) fileExistsAction = FileExistsAction.SKIP;
  else if (options.overwrite) fileExistsAction = FileExistsAction.OVERWRITE;
  else fileExistsAction = FileExistsAction.PROMPT;

  // Prepare params for core single download
  const filenameTemplate = options.filenameTemplate || DEFAULT_FILENAME_TEMPLATE;
  const outputDirInput = options.cacheDir
    ? options.cacheDir
    : options.output
      ? options.output
      : ((await p.text({
          message: "Enter output directory:",
          placeholder: DEFAULT_OUTPUT_DIR,
          initialValue: DEFAULT_OUTPUT_DIR,
        })) as string);

  if (p.isCancel(outputDirInput)) {
    p.cancel("Operation cancelled.");
    process.exit(0);
  }

  const resolvedOutput = (outputDirInput as string).trim() || DEFAULT_OUTPUT_DIR;

  const progressWrapper = (progress: ProgressInfo) => {
    const now = Date.now();
    if (shouldUpdateProgress(lastProgressUpdate, now)) {
      const progressBar = createProgressBar(progress.percentage, 30);
      const downloaded = formatBytes(progress.downloaded);
      const total = formatBytes(progress.total);
      downloadSpinner.message(`${progressBar} ${downloaded}/${total}`);
      lastProgressUpdate = now;
    }
  };

  const confirmOverwrite = async () => {
    const result = await p.confirm({
      message: `File already exists. Overwrite?`,
      initialValue: false,
    });
    if (p.isCancel(result)) {
      p.cancel("Operation cancelled.");
      process.exit(0);
    }
    return Boolean(result);
  };

  // Start spinner and perform download via core service
  const downloadSpinner = p.spinner();
  let lastProgressUpdate = Date.now();
  downloadSpinner.start(`Downloading ${truncateText("pending...")}`);

  // First resolve final file details for pretty note
  // We repeat minimal parse here to build display URL post-download
  const resolvedVersion = await resolveVersion(
    extensionInfo.itemName,
    version as string,
    Boolean(options.preRelease),
    effectiveSource as "marketplace" | "open-vsx" | "auto",
  );
  const downloadUrl =
    effectiveSource === "open-vsx"
      ? constructOpenVsxDownloadUrl(extensionInfo, resolvedVersion)
      : constructDownloadUrl(extensionInfo, resolvedVersion);
  const filename = generateFilename(filenameTemplate, {
    name: extensionInfo.itemName,
    version: resolvedVersion,
    source: effectiveSource,
    publisher: extensionInfo.itemName.split(".")[0],
  });
  const displayUrl =
    downloadUrl.length > 50
      ? `${downloadUrl.slice(0, 30)}...${downloadUrl.slice(-10)}`
      : downloadUrl;

  p.note(
    `Filename: ${filename}\nOutput: ${resolvedOutput}\nResolved Version: ${resolvedVersion}\nTemplate: ${filenameTemplate}\nURL: ${displayUrl}`,
    "Download Details",
  );

  // Confirm download (only if not already confirmed via overwrite prompt)
  if (fileExistsAction !== FileExistsAction.PROMPT) {
    const shouldProceed = await p.confirm({
      message: `Download ${filename}?`,
      initialValue: true,
    });

    if (p.isCancel(shouldProceed) || !shouldProceed) {
      p.cancel("Download cancelled.");
      return;
    }
  }

  // Validate checksum format if provided
  if (options.verifyChecksum && !isValidSHA256(options.verifyChecksum)) {
    throw new Error("Invalid SHA256 hash format. Expected 64 hexadecimal characters.");
  }

  // Update spinner to actual filename now that details are known
  downloadSpinner.message(`Downloading ${truncateText(filename)}...`);

  try {
    const downloadRequest: SingleDownloadRequest = {
      url: marketplaceUrl as string,
      requestedVersion: version as string,
      preferPreRelease: Boolean(options.preRelease),
      source: effectiveSource as "marketplace" | "open-vsx" | "auto",
      filenameTemplate,
      cacheDir: options.cacheDir,
      outputDir: resolvedOutput,
      fileExistsAction,
      promptOverwrite: fileExistsAction === FileExistsAction.PROMPT ? confirmOverwrite : undefined,
      quiet: options.quiet,
      progressCallback: options.quiet ? undefined : progressWrapper,
    };

    const result = await performSingleDownload(downloadRequest);
    const downloadedFilePath = result.filePath || path.join(resolvedOutput, filename);
    downloadSpinner.stop(`Downloaded successfully!`);

    // Get file size for display
    const fs = await import("fs-extra");
    const stats = await fs.stat(downloadedFilePath);
    const formattedSize = formatBytes(stats.size);

    let checksumInfo = "";
    let verificationInfo = "";

    // Generate checksum if requested
    if (options.checksum) {
      const checksumSpinner = p.spinner();
      checksumSpinner.start("Generating SHA256 checksum...");

      try {
        const hash = await generateSHA256(downloadedFilePath);
        checksumSpinner.stop("Checksum generated");
        checksumInfo = `\nSHA256: ${hash}`;
      } catch (error) {
        checksumSpinner.stop("Checksum generation failed", 1);
        p.log.warn(
          `⚠️  Failed to generate checksum: ${error instanceof Error ? error.message : "Unknown error"}`,
        );
      }
    }

    // Verify checksum if provided
    if (options.verifyChecksum) {
      const verifySpinner = p.spinner();
      verifySpinner.start("Verifying checksum...");

      try {
        const isValid = await verifySHA256(downloadedFilePath, options.verifyChecksum);
        if (isValid) {
          verifySpinner.stop("✅ Checksum verification passed");
          verificationInfo = `\nVerification: ✅ PASSED (${formatHashForDisplay(options.verifyChecksum)})`;
        } else {
          verifySpinner.stop("❌ Checksum verification failed", 1);
          const actualHash = await generateSHA256(downloadedFilePath);
          verificationInfo = `\nVerification: ❌ FAILED\nExpected: ${options.verifyChecksum}\nActual: ${actualHash}`;
          p.log.error("❌ File integrity check failed! The downloaded file may be corrupted.");
        }
      } catch (error) {
        verifySpinner.stop("Checksum verification failed", 1);
        p.log.warn(
          `⚠️  Failed to verify checksum: ${error instanceof Error ? error.message : "Unknown error"}`,
        );
      }
    }

    p.note(
      `File: ${filename}\nLocation: ${downloadedFilePath}\nSize: ${formattedSize}${checksumInfo}${verificationInfo}`,
      "Download Complete",
    );

    // Install after download if requested
    if (options.installAfter) {
      if (!options.quiet) {
        p.log.info("🔧 Installing downloaded extension...");
      }

      try {
        const { getInstallService, getEditorService } = await import("../features/install");
        const installService = getInstallService();
        const editorService = getEditorService();

        // Auto-detect editor
        const availableEditors = await editorService.getAvailableEditors();
        if (availableEditors.length === 0) {
          p.log.warn(
            "⚠️ No editors found for installation. Extension downloaded but not installed.",
          );
        } else {
          // Prefer Cursor, fallback to VS Code
          const editor = availableEditors.find((e) => e.name === "cursor") || availableEditors[0];
          const binPath = editor.binaryPath;

          const installResult = await installService.installSingleVsix(
            binPath,
            downloadedFilePath,
            {
              dryRun: false,
              forceReinstall: false,
              timeout: 30000,
            },
          );

          if (installResult.success) {
            p.log.success(`✅ Extension installed successfully into ${editor.displayName}!`);
          } else {
            p.log.warn(`⚠️ Installation failed: ${installResult.error || "Unknown error"}`);
          }
        }
      } catch (error) {
        p.log.warn(
          `⚠️ Installation failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    p.outro(
      options.installAfter
        ? `🎉 Download and install completed!`
        : `🎉 Successfully downloaded VSIX extension!`,
    );
  } catch (error) {
    downloadSpinner.stop("Download failed", 1);
    throw error;
  }
}

async function downloadBulkFromJson(options: DownloadOptions) {
  // Get JSON file path
  let jsonPathStr = options.file as string | undefined;
  if (!jsonPathStr) {
    const jsonPath = await p.text({
      message: "Enter the path to your JSON file:",
      placeholder: "e.g., ./list.json or /path/to/extensions.json",
      validate: (input: string) => {
        if (!input.trim()) {
          return "Please enter a valid file path";
        }
        if (!input.endsWith(".json")) {
          return "File must have .json extension";
        }
        return undefined;
      },
    });

    if (p.isCancel(jsonPath)) {
      p.cancel("Operation cancelled.");
      process.exit(0);
    }
    jsonPathStr = jsonPath as string;
  }

  // Determine output directory (cache-dir takes precedence, then output, then prompt)
  let outputDir: string;
  if (options.cacheDir) {
    outputDir = options.cacheDir;
  } else if (options.output) {
    outputDir = options.output;
  } else {
    const outputInput = await p.text({
      message: "Enter output directory:",
      placeholder: "./downloads",
      initialValue: DEFAULT_OUTPUT_DIR,
    });

    if (p.isCancel(outputInput)) {
      p.cancel("Operation cancelled.");
      process.exit(0);
    }

    outputDir = (outputInput as string).trim() || DEFAULT_OUTPUT_DIR;
  }

  // Start bulk download process
  if (!options.quiet) {
    p.log.info("🔍 Reading and validating JSON file...");
  }

  // Interactive bulk (no --file provided initially) should run sequentially
  const isInteractive = !options.file;
  const bulkOptions: BulkOptions = buildBulkOptionsFromCli(
    options,
    isInteractive ? { parallel: 1, retry: 2, retryDelay: 1000 } : undefined,
  );

  await downloadBulkExtensions(jsonPathStr as string, outputDir as string, bulkOptions);

  // Install after bulk download if requested
  if (options.installAfter) {
    if (!options.quiet) {
      p.log.info("🔧 Installing downloaded extensions...");
    }

    try {
      const { getInstallService, getEditorService, getVsixScanner } = await import(
        "../features/install"
      );
      const installService = getInstallService();
      const editorService = getEditorService();

      // Auto-detect editor
      const availableEditors = await editorService.getAvailableEditors();
      if (availableEditors.length === 0) {
        p.log.warn(
          "⚠️ No editors found for installation. Extensions downloaded but not installed.",
        );
      } else {
        // Prefer Cursor, fallback to VS Code
        const editor = availableEditors.find((e) => e.name === "cursor") || availableEditors[0];
        const binPath = editor.binaryPath;

        // Install all VSIX files from the output directory
        const vsixScanner = getVsixScanner();
        const scanResult = await vsixScanner.scanDirectory(outputDir);

        if (scanResult.validVsixFiles.length > 0) {
          const installTasks = scanResult.validVsixFiles.map((vsixFile) => ({
            vsixFile,
            extensionId: vsixFile.extensionId,
            targetVersion: vsixFile.version,
          }));

          const installResult = await installService.installBulkVsix(binPath, installTasks, {
            dryRun: false,
            skipInstalled: true,
            parallel: 1,
            retry: Number(options.retry) || 2,
            retryDelay: Number(options.retryDelay) || 1000,
            quiet: options.quiet,
          });

          if (!options.quiet) {
            p.note(
              `Downloaded: ${scanResult.validVsixFiles.length}\nInstalled: ${installResult.successful}\nSkipped: ${installResult.skipped}\nFailed: ${installResult.failed}`,
              "Download & Install Summary",
            );
          }
        } else {
          p.log.warn("⚠️ No valid VSIX files found for installation.");
        }
      }
    } catch (error) {
      p.log.warn(
        `⚠️ Installation failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}

// Lightweight UI entrypoints for interactive launcher
export async function runSingleDownloadUI(options: DownloadOptions) {
  await downloadSingleExtension(options);
}

export async function runBulkJsonDownloadUI(options: DownloadOptions) {
  await downloadBulkFromJson(options);
}
