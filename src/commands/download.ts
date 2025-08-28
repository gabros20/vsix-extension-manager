import * as p from "@clack/prompts";
import path from "path";
import { downloadFile } from "../utils/downloader";
import {
  constructDownloadUrl,
  getDisplayNameFromUrl,
  constructOpenVsxDownloadUrl,
  parseExtensionUrl,
  inferSourceFromUrl,
} from "../utils/urlParser";
import { createDownloadDirectory, FileExistsAction, handleFileExists } from "../utils/fileManager";
import { downloadBulkExtensions, BulkOptions } from "../utils/bulkDownloader";
import { resolveVersion } from "../utils/extensionRegistry";
import {
  generateFilename,
  DEFAULT_FILENAME_TEMPLATE,
  validateTemplate,
} from "../utils/filenameTemplate";
import {
  generateSHA256,
  verifySHA256,
  isValidSHA256,
  formatHashForDisplay,
} from "../utils/checksum";
import {
  ProgressInfo,
  formatBytes,
  formatSpeed,
  createProgressBar,
} from "../utils/progressTracker";

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
}

export async function downloadVsix(options: DownloadOptions) {
  console.clear();

  p.intro("🔽 VSIX Downloader");

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
          label: "📦 Single Extension",
          hint: "Download one extension interactively",
        },
        {
          value: "bulk",
          label: "📚 Bulk Download",
          hint: "Download multiple extensions from JSON file",
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

  // Parse URL to extract extension info
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
      message: "Enter the extension version (or 'latest'):",
      placeholder: "e.g., 1.2.3 or latest",
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

  // Resolve version if 'latest'
  const resolvedVersion = await resolveVersion(
    extensionInfo.itemName,
    version as string,
    Boolean(options.preRelease),
    effectiveSource as "marketplace" | "open-vsx" | "auto",
  );

  // Construct download URL by source
  const downloadUrl =
    effectiveSource === "open-vsx"
      ? constructOpenVsxDownloadUrl(extensionInfo, resolvedVersion)
      : constructDownloadUrl(extensionInfo, resolvedVersion);

  // Generate filename using template
  const filenameTemplate = options.filenameTemplate || DEFAULT_FILENAME_TEMPLATE;

  // Validate template
  const templateValidation = validateTemplate(filenameTemplate);
  if (!templateValidation.isValid) {
    throw new Error(`Invalid filename template: ${templateValidation.error}`);
  }

  const filename = generateFilename(filenameTemplate, {
    name: extensionInfo.itemName,
    version: resolvedVersion,
    source: effectiveSource,
    publisher: extensionInfo.itemName.split(".")[0],
  });

  // Determine output directory (cache-dir takes precedence)
  let outputDir: string;
  if (options.cacheDir) {
    outputDir = options.cacheDir;
  } else if (options.output) {
    outputDir = options.output;
  } else {
    const outputInput = await p.text({
      message: "Enter output directory:",
      placeholder: "./downloads",
      initialValue: "./downloads",
    });

    if (p.isCancel(outputInput)) {
      p.cancel("Operation cancelled.");
      process.exit(0);
    }

    outputDir = (outputInput as string).trim() || "./downloads";
  }

  await createDownloadDirectory(outputDir);

  const filePath = path.join(outputDir, filename);

  // Determine file exists action
  let fileExistsAction: FileExistsAction;
  if (options.skipExisting) {
    fileExistsAction = FileExistsAction.SKIP;
  } else if (options.overwrite) {
    fileExistsAction = FileExistsAction.OVERWRITE;
  } else {
    fileExistsAction = FileExistsAction.PROMPT;
  }

  // Check if file exists and handle accordingly
  const shouldProceedWithDownload = await handleFileExists(filePath, fileExistsAction, async () => {
    // Prompt callback for interactive mode
    const result = await p.confirm({
      message: `File ${filename} already exists. Overwrite?`,
      initialValue: false,
    });

    if (p.isCancel(result)) {
      p.cancel("Operation cancelled.");
      process.exit(0);
    }

    return result as boolean;
  });

  if (!shouldProceedWithDownload) {
    p.note(`Skipped existing file: ${filename}`, "Download Skipped");
    return;
  }

  // Truncate URL for display (keep first 30 chars + ... + last 10 chars)
  const displayUrl =
    downloadUrl.length > 50
      ? `${downloadUrl.slice(0, 30)}...${downloadUrl.slice(-10)}`
      : downloadUrl;

  p.note(
    `Filename: ${filename}\nOutput: ${outputDir}\nResolved Version: ${resolvedVersion}\nTemplate: ${filenameTemplate}\nURL: ${displayUrl}`,
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

  // Download the file with progress tracking
  const downloadSpinner = p.spinner();
  let lastProgressUpdate = Date.now();

  const progressCallback = (progress: ProgressInfo) => {
    const now = Date.now();
    // Update every 100ms to avoid overwhelming the terminal
    if (now - lastProgressUpdate >= 100) {
      const progressBar = createProgressBar(progress.percentage, 30);
      const downloaded = formatBytes(progress.downloaded);
      const total = formatBytes(progress.total);
      const speed = formatSpeed(progress.speed);

      downloadSpinner.message(`${progressBar} ${downloaded}/${total} @ ${speed}`);
      lastProgressUpdate = now;
    }
  };

  downloadSpinner.start(`Downloading ${filename}...`);

  try {
    const downloadedFilePath = await downloadFile(
      downloadUrl,
      outputDir,
      filename,
      options.quiet ? undefined : progressCallback,
    );
    downloadSpinner.stop(`Downloaded successfully!`);

    // Get file size for display
    const fs = await import("fs-extra");
    const stats = await fs.stat(downloadedFilePath);
    const sizeInKB = Math.round(stats.size / 1024);

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
      `File: ${filename}\nLocation: ${downloadedFilePath}\nSize: ${sizeInKB} KB${checksumInfo}${verificationInfo}`,
      "Download Complete",
    );

    p.outro(`🎉 Successfully downloaded VSIX extension!`);
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
      initialValue: "./downloads",
    });

    if (p.isCancel(outputInput)) {
      p.cancel("Operation cancelled.");
      process.exit(0);
    }

    outputDir = (outputInput as string).trim() || "./downloads";
  }

  // Start bulk download process
  if (!options.quiet) {
    p.log.info("🔍 Reading and validating JSON file...");
  }

  const bulkOptions: BulkOptions = {
    parallel: options.parallel ? Number(options.parallel) : undefined,
    retry: options.retry ? Number(options.retry) : undefined,
    retryDelay: options.retryDelay ? Number(options.retryDelay) : undefined,
    quiet: options.quiet,
    json: options.json,
    summaryPath: options.summary,
    filenameTemplate: options.filenameTemplate,
    cacheDir: options.cacheDir,
    skipExisting: options.skipExisting,
    overwrite: options.overwrite,
    checksum: options.checksum,
    verifyChecksum: options.verifyChecksum,
  };

  await downloadBulkExtensions(jsonPathStr as string, outputDir as string, bulkOptions);
}
