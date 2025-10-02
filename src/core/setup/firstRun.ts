/**
 * First-run detection and wizard trigger
 * Automatically prompts for setup on first use
 */

import { setupWizard } from "./wizard";
import { configLoaderV2 } from "../../config/loaderV2";
import { ui } from "../ui";

/**
 * First-run detection options
 */
export interface FirstRunOptions {
  force?: boolean;
  skip?: boolean;
  quiet?: boolean;
}

/**
 * Check and handle first-run scenario
 * Returns true if wizard was run, false otherwise
 */
export async function handleFirstRun(options: FirstRunOptions = {}): Promise<boolean> {
  // Skip if explicitly disabled
  if (options.skip || options.quiet) {
    return false;
  }

  // Check if this is first run
  const isFirstRun = await setupWizard.isFirstRun();

  if (!isFirstRun && !options.force) {
    return false;
  }

  // Show prompt to run setup wizard
  console.log(""); // Empty line
  ui.log.info("👋 Welcome to VSIX Extension Manager v2.0!");
  console.log(""); // Empty line

  const shouldSetup = await ui.confirm(
    "Would you like to run the setup wizard? (Recommended for first-time users)",
    true,
  );

  if (!shouldSetup) {
    ui.log.info("You can run setup later with: vsix-extension-manager setup");
    return false;
  }

  // Run setup wizard
  await setupWizard.run({ skipWelcome: true });

  return true;
}

/**
 * Show first-run hints without running wizard
 */
export function showFirstRunHints(): void {
  console.log("");
  ui.note(
    `Quick start guide:

1. Run setup wizard:
   vsix-extension-manager setup

2. Add an extension:
   vsix-extension-manager add <url|id|file>

3. List installed extensions:
   vsix-extension-manager list

4. Get help:
   vsix-extension-manager --help`,
    "Getting Started",
  );
}

// Migration code removed - v2.0 is a clean slate without v1.x compatibility
