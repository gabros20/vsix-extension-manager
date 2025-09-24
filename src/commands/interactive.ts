import * as p from "@clack/prompts";
import type { Config } from "../config/constants";

export async function runInteractive(config: Config) {
  console.clear();
  p.intro("🔽 VSIX Extension Manager");

  // Main menu loop to handle back navigation
  while (true) {
    const category = await showMainMenu();

    if (p.isCancel(category) || category === "quit") {
      p.cancel("Operation cancelled.");
      process.exit(0);
    }

    // Handle category selection
    const shouldExit = await handleCategorySelection(category as string, config);
    if (shouldExit) {
      break;
    }
  }
}

/**
 * Show the main category selection menu
 */
async function showMainMenu(): Promise<string | symbol> {
  return await p.select({
    message: "What do you want to do?",
    options: [
      { value: "install", label: "Install", hint: "Install extensions or VSIX files" },
      { value: "download", label: "Download", hint: "Download VSIX files" },
      { value: "update", label: "Update", hint: "Update installed extensions" },
      { value: "export", label: "Export", hint: "Export extension lists" },
      { value: "version", label: "Version", hint: "Check extension versions" },
      { value: "quit", label: "Quit", hint: "Exit the application" },
    ],
  });
}

/**
 * Handle the selected category and show appropriate sub-menu
 */
async function handleCategorySelection(category: string, config: Config): Promise<boolean> {
  switch (category) {
    case "install":
      return await showInstallMenu(config);
    case "download":
      return await showDownloadMenu(config);
    case "update":
      return await showUpdateMenu(config);
    case "export":
      return await showExportMenu(config);
    case "version":
      return await showVersionMenu(config);
    default:
      return false;
  }
}

/**
 * Show Install sub-menu
 */
async function showInstallMenu(config: Config): Promise<boolean> {
  const choice = await p.select({
    message: "Install Options:",
    options: [
      {
        value: "quick-install",
        label: "Quick install by URL",
        hint: "Temp download → install → cleanup",
      },
      {
        value: "install-vsix-single",
        label: "Install single VSIX file",
        hint: "Install one .vsix file into VS Code/Cursor",
      },
      {
        value: "install-vsix-dir",
        label: "Install from directory",
        hint: "Install all VSIX files from a folder",
      },
      {
        value: "install-list",
        label: "Install from list",
        hint: "Install from .txt or extensions.json file",
      },
      { value: "back", label: "Back to main menu" },
    ],
  });

  if (p.isCancel(choice)) {
    return false; // Go Back to main menu
  }

  if (choice === "back") {
    return false; // Go Back to main menu
  }

  // Execute the selected install command
  await executeInstallCommand(choice as string, config);
  return false; // Return to main menu after command execution
}

/**
 * Show Download sub-menu
 */
async function showDownloadMenu(config: Config): Promise<boolean> {
  const choice = await p.select({
    message: "Download Options:",
    options: [
      {
        value: "single",
        label: "Download single extension",
        hint: "Download from marketplace URL",
      },
      {
        value: "bulk",
        label: "Download multiple extensions",
        hint: "Bulk download from JSON collection",
      },
      {
        value: "from-list",
        label: "Download from list",
        hint: "Download from .txt or extensions.json file",
      },
      { value: "back", label: "Back to main menu" },
    ],
  });

  if (p.isCancel(choice)) {
    return false; // Go Back to main menu
  }

  if (choice === "back") {
    return false; // Go Back to main menu
  }

  // Execute the selected download command
  await executeDownloadCommand(choice as string, config);
  return false; // Return to main menu after command execution
}

/**
 * Show Update sub-menu
 */
async function showUpdateMenu(config: Config): Promise<boolean> {
  const choice = await p.select({
    message: "Update Options:",
    options: [
      {
        value: "update-installed",
        label: "Update installed extensions",
        hint: "Update to latest versions with backup",
      },
      { value: "back", label: "Back to main menu" },
    ],
  });

  if (p.isCancel(choice)) {
    return false; // Go Back to main menu
  }

  if (choice === "back") {
    return false; // Go Back to main menu
  }

  // Execute the selected update command
  await executeUpdateCommand(choice as string, config);
  return false; // Return to main menu after command execution
}

/**
 * Show Export sub-menu
 */
async function showExportMenu(config: Config): Promise<boolean> {
  const choice = await p.select({
    message: "Export Options:",
    options: [
      {
        value: "export",
        label: "Export installed extensions",
        hint: "Export to .txt or extensions.json format",
      },
      { value: "back", label: "Back to main menu" },
    ],
  });

  if (p.isCancel(choice)) {
    return false; // Go Back to main menu
  }

  if (choice === "back") {
    return false; // Go Back to main menu
  }

  // Execute the selected export command
  await executeExportCommand(choice as string, config);
  return false; // Return to main menu after command execution
}

/**
 * Show Version sub-menu
 */
async function showVersionMenu(config: Config): Promise<boolean> {
  const choice = await p.select({
    message: "Version Options:",
    options: [
      {
        value: "versions",
        label: "Show extension versions",
        hint: "List available versions for an extension",
      },
      { value: "back", label: "Back to main menu" },
    ],
  });

  if (p.isCancel(choice)) {
    return false; // Go Back to main menu
  }

  if (choice === "back") {
    return false; // Go Back to main menu
  }

  // Execute the selected version command
  await executeVersionCommand(choice as string, config);
  return false; // Return to main menu after command execution
}

/**
 * Execute install commands
 */
async function executeInstallCommand(command: string, config: Config): Promise<void> {
  switch (command) {
    case "quick-install": {
      const { runQuickInstallUI } = await import("./quickInstall");
      await runQuickInstallUI({ ...config });
      break;
    }
    case "install-vsix-single": {
      const { runInstallVsixUI } = await import("./install");
      await runInstallVsixUI({ ...config });
      break;
    }
    case "install-vsix-dir": {
      const { runInstallVsixDirUI } = await import("./install");
      await runInstallVsixDirUI({ ...config });
      break;
    }
    case "install-list": {
      const { runInstallFromListUI } = await import("./install");
      await runInstallFromListUI({ ...config });
      break;
    }
  }
}

/**
 * Execute download commands
 */
async function executeDownloadCommand(command: string, config: Config): Promise<void> {
  switch (command) {
    case "single": {
      const { runSingleDownloadUI } = await import("./download");
      await runSingleDownloadUI({ ...config });
      break;
    }
    case "bulk": {
      const { runBulkJsonDownloadUI } = await import("./download");
      await runBulkJsonDownloadUI({ ...config });
      break;
    }
    case "from-list": {
      const { fromList } = await import("./fromList");
      await fromList({ ...config });
      break;
    }
  }
}

/**
 * Execute update commands
 */
async function executeUpdateCommand(command: string, config: Config): Promise<void> {
  switch (command) {
    case "update-installed": {
      const { runUpdateInstalledUI } = await import("./updateInstalled");
      await runUpdateInstalledUI({ ...config });
      break;
    }
  }
}

/**
 * Execute export commands
 */
async function executeExportCommand(command: string, config: Config): Promise<void> {
  switch (command) {
    case "export": {
      const { exportInstalled } = await import("./exportInstalled");
      await exportInstalled({ ...config });
      break;
    }
  }
}

/**
 * Execute version commands
 */
async function executeVersionCommand(command: string, config: Config): Promise<void> {
  switch (command) {
    case "versions": {
      const { listVersions } = await import("./versions");
      await listVersions({ ...config });
      break;
    }
  }
}
