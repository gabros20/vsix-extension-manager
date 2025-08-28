import * as p from "@clack/prompts";
import { parseMarketplaceUrl, getDisplayNameFromUrl } from "../utils/urlParser";
import { fetchExtensionVersions } from "../utils/extensionRegistry";

interface VersionsOptions {
  url?: string;
  json?: boolean;
}

export async function listVersions(options: VersionsOptions) {
  try {
    // Get URL
    let url = options.url as string | undefined;
    if (!url) {
      const res = await p.text({
        message: "Enter the VS Code extension marketplace URL:",
        validate: (input: string) => (!input.trim() ? "Please enter a valid URL" : undefined),
      });
      if (p.isCancel(res)) {
        p.cancel("Operation cancelled.");
        process.exit(0);
      }
      url = res as string;
    }

    const info = parseMarketplaceUrl(url);
    const displayName = getDisplayNameFromUrl(url);
    const spinner = p.spinner();
    spinner.start(`Fetching versions for ${displayName}...`);
    const versions = await fetchExtensionVersions(info.itemName);
    spinner.stop(`Found ${versions.length} version(s)`);

    if (options.json) {
      console.log(JSON.stringify(versions, null, 2));
      return;
    }

    p.note(
      versions.map((v) => `${v.version}${v.published ? `  (${v.published})` : ""}`).join("\n"),
      `Versions for ${displayName}`,
    );
  } catch (error) {
    p.log.error("❌ Error: " + (error instanceof Error ? error.message : String(error)));
    process.exit(1);
  }
}
