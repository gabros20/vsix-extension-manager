import path from "path";
import { downloadFile } from "../../../core/http/downloader";
import {
  parseExtensionUrl,
  constructDownloadUrl,
  constructOpenVsxDownloadUrl,
  inferSourceFromUrl,
  resolveVersion,
} from "../../../core/registry";
import {
  createDownloadDirectory,
  FileExistsAction,
  handleFileExists,
  resolveOutputDirectory,
  generateFilename,
  DEFAULT_FILENAME_TEMPLATE,
  validateTemplate,
} from "../../../core/filesystem";
import type { ProgressCallback } from "../../../core/ui/progress";
import type { SourceRegistry } from "../../../core/types";

export interface SingleDownloadRequest {
  url: string;
  requestedVersion: string; // may be "latest"
  preferPreRelease?: boolean;
  source?: SourceRegistry; // marketplace | open-vsx | auto
  filenameTemplate?: string;
  cacheDir?: string;
  outputDir?: string;
  fileExistsAction: FileExistsAction;
  promptOverwrite?: () => Promise<boolean>;
  quiet?: boolean;
  progressCallback?: ProgressCallback;
}

export interface SingleDownloadResult {
  status: "downloaded" | "skipped";
  downloadUrl: string;
  filename: string;
  resolvedVersion: string;
  outputDir: string;
  filePath?: string;
}

/**
 * Download a single VSIX extension with full configuration support
 */
export async function downloadSingleExtension(
  request: SingleDownloadRequest,
): Promise<SingleDownloadResult> {
  const {
    url,
    requestedVersion,
    preferPreRelease = false,
    source = inferSourceFromUrl(url),
    filenameTemplate = DEFAULT_FILENAME_TEMPLATE,
    cacheDir,
    outputDir,
    fileExistsAction,
    promptOverwrite,
    quiet,
    progressCallback,
  } = request;

  // Parse extension info
  const extensionInfo = parseExtensionUrl(url);

  // Resolve version
  const resolvedVersion = await resolveVersion(
    extensionInfo.itemName,
    requestedVersion,
    Boolean(preferPreRelease),
    source,
  );

  // Construct download URL by source
  const downloadUrl =
    source === "open-vsx"
      ? constructOpenVsxDownloadUrl(extensionInfo, resolvedVersion)
      : constructDownloadUrl(extensionInfo, resolvedVersion);

  // Validate template
  const templateValidation = validateTemplate(filenameTemplate);
  if (!templateValidation.isValid) {
    throw new Error(`Invalid filename template: ${templateValidation.error}`);
  }

  // Generate filename
  const filename = generateFilename(filenameTemplate, {
    name: extensionInfo.itemName,
    version: resolvedVersion,
    source: source,
    publisher: extensionInfo.itemName.split(".")[0],
  });

  // Resolve output directory (cacheDir wins)
  const effectiveOutputDir = resolveOutputDirectory(cacheDir, outputDir);
  await createDownloadDirectory(effectiveOutputDir);

  const filePath = path.join(effectiveOutputDir, filename);

  // File existence handling
  const shouldProceed = await handleFileExists(filePath, fileExistsAction, promptOverwrite);
  if (!shouldProceed) {
    return {
      status: "skipped",
      downloadUrl,
      filename,
      resolvedVersion,
      outputDir: effectiveOutputDir,
    };
  }

  // Perform download
  const pathOnDisk = await downloadFile(
    downloadUrl,
    effectiveOutputDir,
    filename,
    quiet ? undefined : progressCallback,
  );

  return {
    status: "downloaded",
    downloadUrl,
    filename,
    resolvedVersion,
    outputDir: effectiveOutputDir,
    filePath: pathOnDisk,
  };
}
