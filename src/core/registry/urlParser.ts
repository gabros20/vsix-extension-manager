export interface ExtensionInfo {
  itemName: string;
}

/**
 * Parse Visual Studio Marketplace URL to extract extension information
 * Expected URL format: https://marketplace.visualstudio.com/items?itemName=publisher.extension
 */
export function parseMarketplaceUrl(url: string): ExtensionInfo {
  try {
    const parsedUrl = new URL(url);

    if (!parsedUrl.hostname.includes("marketplace.visualstudio.com")) {
      throw new Error("Invalid marketplace URL. Must be from marketplace.visualstudio.com");
    }

    const itemName = parsedUrl.searchParams.get("itemName");
    if (!itemName) {
      throw new Error("Invalid URL. Missing itemName parameter");
    }

    const parts = itemName.split(".");
    if (parts.length !== 2) {
      throw new Error("Invalid itemName format. Expected format: publisher.extension");
    }

    const [publisher, extension] = parts;

    if (!publisher || !extension) {
      throw new Error("Invalid extension name format");
    }

    return {
      itemName,
    };
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error("Failed to parse marketplace URL");
  }
}

/**
 * Infer source registry from URL
 */
export function inferSourceFromUrl(url: string): "marketplace" | "open-vsx" {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes("open-vsx.org")) return "open-vsx";
    return "marketplace";
  } catch {
    return "marketplace";
  }
}

/**
 * Parse either Marketplace or OpenVSX URLs to extract `publisher.extension` as itemName
 * Supported formats:
 * - Marketplace: https://marketplace.visualstudio.com/items?itemName=publisher.extension
 * - OpenVSX API: https://open-vsx.org/api/publisher/extension/[...]
 * - OpenVSX Web: https://open-vsx.org/extension/publisher/extension
 */
export function parseExtensionUrl(url: string): ExtensionInfo {
  const source = inferSourceFromUrl(url);
  if (source === "marketplace") {
    return parseMarketplaceUrl(url);
  }
  // open-vsx parsing
  try {
    const parsedUrl = new URL(url);
    const segments = parsedUrl.pathname.split("/").filter(Boolean);
    // Accept both /api/publisher/extension/... and /extension/publisher/extension
    let publisher: string | undefined;
    let extension: string | undefined;
    if (segments[0] === "api" && segments.length >= 3) {
      publisher = segments[1];
      extension = segments[2];
    } else if (segments[0] === "extension" && segments.length >= 3) {
      publisher = segments[1];
      extension = segments[2];
    }
    if (!publisher || !extension) {
      throw new Error("Invalid OpenVSX URL format");
    }
    return { itemName: `${publisher}.${extension}` };
  } catch (error) {
    if (error instanceof Error) throw error;
    throw new Error("Failed to parse extension URL");
  }
}

/**
 * Construct the download URL for VSIX file
 * Based on the pattern from the original script:
 * https://[publisher].gallery.vsassets.io/_apis/public/gallery/publisher/[publisher]/extension/[extension]/[version]/assetbyname/Microsoft.VisualStudio.Services.VSIXPackage
 */
export function constructDownloadUrl(extensionInfo: ExtensionInfo, version: string): string {
  const [publisher, extension] = extensionInfo.itemName.split(".");

  // Validate components
  if (!publisher || !extension) {
    throw new Error(`Invalid extension itemName: ${extensionInfo.itemName}`);
  }
  if (!version || version.trim() === "") {
    throw new Error(`Invalid version: ${version}`);
  }

  // Sanitize to prevent injection (URL encode special characters)
  const safePublisher = encodeURIComponent(publisher);
  const safeExtension = encodeURIComponent(extension);
  const safeVersion = encodeURIComponent(version);

  const url = `https://${safePublisher}.gallery.vsassets.io/_apis/public/gallery/publisher/${safePublisher}/extension/${safeExtension}/${safeVersion}/assetbyname/Microsoft.VisualStudio.Services.VSIXPackage`;

  // Validate constructed URL
  try {
    new URL(url);
  } catch {
    throw new Error(
      `Failed to construct valid download URL for ${extensionInfo.itemName}@${version}`,
    );
  }

  return url;
}

export type SourceRegistry = "marketplace" | "open-vsx";

/**
 * Construct download URL for OpenVSX
 * https://open-vsx.org/api/<publisher>/<extension>/<version>/file/<publisher>.<extension>-<version>.vsix
 */
export function constructOpenVsxDownloadUrl(extensionInfo: ExtensionInfo, version: string): string {
  const [publisher, extension] = extensionInfo.itemName.split(".");

  // Validate components
  if (!publisher || !extension) {
    throw new Error(`Invalid extension itemName: ${extensionInfo.itemName}`);
  }
  if (!version || version.trim() === "") {
    throw new Error(`Invalid version: ${version}`);
  }

  // Sanitize to prevent injection
  const safePublisher = encodeURIComponent(publisher);
  const safeExtension = encodeURIComponent(extension);
  const safeVersion = encodeURIComponent(version);

  const url = `https://open-vsx.org/api/${safePublisher}/${safeExtension}/${safeVersion}/file/${safePublisher}.${safeExtension}-${safeVersion}.vsix`;

  // Validate constructed URL
  try {
    new URL(url);
  } catch {
    throw new Error(
      `Failed to construct valid OpenVSX download URL for ${extensionInfo.itemName}@${version}`,
    );
  }

  return url;
}

/**
 * Validate if the URL looks like a valid marketplace URL
 */
export function isValidMarketplaceUrl(url: string): boolean {
  try {
    parseMarketplaceUrl(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get a human-friendly display name from a marketplace URL
 * Example: publisher.extension -> "publisher - extension"
 */
export function getDisplayNameFromUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes("marketplace.visualstudio.com")) {
      const itemName = parsed.searchParams.get("itemName");
      if (itemName) {
        return itemName.replace(".", " - ");
      }
    } else if (parsed.hostname.includes("open-vsx.org")) {
      const segments = parsed.pathname.split("/").filter(Boolean);
      let publisher: string | undefined;
      let extension: string | undefined;
      if (segments[0] === "api" && segments.length >= 3) {
        publisher = segments[1];
        extension = segments[2];
      } else if (segments[0] === "extension" && segments.length >= 3) {
        publisher = segments[1];
        extension = segments[2];
      }
      if (publisher && extension) {
        return `${publisher} - ${extension}`;
      }
    }
    return "Unknown Extension";
  } catch {
    return "Unknown Extension";
  }
}
