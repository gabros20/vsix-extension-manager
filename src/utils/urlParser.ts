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
 * Construct the download URL for VSIX file
 * Based on the pattern from the original script:
 * https://[publisher].gallery.vsassets.io/_apis/public/gallery/publisher/[publisher]/extension/[extension]/[version]/assetbyname/Microsoft.VisualStudio.Services.VSIXPackage
 */
export function constructDownloadUrl(extensionInfo: ExtensionInfo, version: string): string {
  const [publisher, extension] = extensionInfo.itemName.split(".");

  return `https://${publisher}.gallery.vsassets.io/_apis/public/gallery/publisher/${publisher}/extension/${extension}/${version}/assetbyname/Microsoft.VisualStudio.Services.VSIXPackage`;
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
    const itemName = new URL(url).searchParams.get("itemName");
    if (itemName) {
      return itemName.replace(".", " - ");
    }
    return "Unknown Extension";
  } catch {
    return "Unknown Extension";
  }
}
