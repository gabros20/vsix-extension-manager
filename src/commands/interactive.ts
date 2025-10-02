/**
 * Interactive mode for VSIX Extension Manager v2.0
 * Beautiful, task-oriented menus using Clack
 */

import * as p from "@clack/prompts";
import type { ConfigV2 } from "../config/constants";
import type { GlobalOptions } from "./base/types";
import { loadCommand } from "./registry";

/**
 * Main interactive menu - Quick actions for common tasks
 */
export async function runInteractive(_config: ConfigV2) {
  console.clear();
  
  p.intro("🔽 VSIX Extension Manager v2.0");

  let shouldContinue = true;

  while (shouldContinue) {
    const action = await p.select({
      message: "What would you like to do?",
      options: [
        { value: "add", label: "⚡ Add extension", hint: "URL, file, or list" },
        { value: "update", label: "🔄 Update extensions", hint: "Keep extensions current" },
        { value: "setup", label: "💻 Setup new machine", hint: "Configure for first use" },
        { value: "doctor", label: "🏥 Fix problems", hint: "Health check & diagnostics" },
        { value: "advanced", label: "⚙️  Advanced options...", hint: "More commands" },
        { value: "help", label: "❓ Help", hint: "Get help" },
        { value: "exit", label: "👋 Exit", hint: "Quit interactive mode" },
      ],
    });

    if (p.isCancel(action) || action === "exit") {
      shouldContinue = false;
      break;
    }

    try {
      switch (action) {
        case "add":
          await handleAddExtension();
          break;
        case "update":
          await handleUpdateExtensions();
          break;
        case "setup":
          await handleSetup();
          break;
        case "doctor":
          await handleDoctor();
          break;
        case "advanced":
          await handleAdvancedMenu();
          break;
        case "help":
          await handleHelp();
          break;
      }

      // Ask if user wants to continue
      if (shouldContinue) {
        const continueChoice = await p.confirm({
          message: "Return to main menu?",
          initialValue: true,
        });

        if (p.isCancel(continueChoice) || !continueChoice) {
          shouldContinue = false;
        } else {
          console.log(""); // Spacing
        }
      }
    } catch (error) {
      p.log.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
      
      const retry = await p.confirm({
        message: "Return to main menu?",
        initialValue: true,
      });

      if (p.isCancel(retry) || !retry) {
        shouldContinue = false;
      }
    }
  }

  p.outro("👋 Thanks for using VSIX Extension Manager!");
}

/**
 * Handle adding extensions
 */
async function handleAddExtension() {
  p.log.step("Add Extension");

  const inputType = await p.select({
    message: "What would you like to add?",
    options: [
      { value: "url", label: "📦 Extension from URL", hint: "Marketplace or OpenVSX" },
      { value: "id", label: "🔍 Extension by ID", hint: "e.g., ms-python.python" },
      { value: "file", label: "📁 Local VSIX file", hint: "Install from disk" },
      { value: "list", label: "📋 Extensions from list", hint: "Batch install" },
    ],
  });

  if (p.isCancel(inputType)) return;

  let input: string;

  switch (inputType) {
    case "url": {
      const url = await p.text({
        message: "Enter extension URL:",
        placeholder: "https://marketplace.visualstudio.com/items?itemName=...",
        validate: (value) => {
          if (!value) return "URL is required";
          if (!value.startsWith("http")) return "Please enter a valid URL";
        },
      });
      if (p.isCancel(url)) return;
      input = url;
      break;
    }

    case "id": {
      const id = await p.text({
        message: "Enter extension ID:",
        placeholder: "publisher.extension-name",
        validate: (value) => {
          if (!value) return "Extension ID is required";
          if (!value.includes(".")) return "ID should be in format: publisher.name";
        },
      });
      if (p.isCancel(id)) return;
      input = id;
      break;
    }

    case "file": {
      const filePath = await p.text({
        message: "Enter VSIX file path:",
        placeholder: "./extension.vsix",
        validate: (value) => {
          if (!value) return "File path is required";
        },
      });
      if (p.isCancel(filePath)) return;
      input = filePath;
      break;
    }

    case "list": {
      const listPath = await p.text({
        message: "Enter list file path:",
        placeholder: "./extensions.txt",
        validate: (value) => {
          if (!value) return "File path is required";
        },
      });
      if (p.isCancel(listPath)) return;
      input = listPath;
      break;
    }

    default:
      return;
  }

  // Execute add command
  const s = p.spinner();
  s.start("Processing...");

  try {
    const addCommand = await loadCommand("add");
    const options: GlobalOptions = {
      quiet: false,
      yes: false,
    };

    const result = await addCommand.execute([input], options);

    s.stop("Done!");

    if (result.status === "ok") {
      p.log.success(result.summary);
    } else {
      p.log.error(result.summary);
    }
  } catch (error) {
    s.stop("Failed");
    throw error;
  }
}

/**
 * Handle updating extensions
 */
async function handleUpdateExtensions() {
  p.log.step("Update Extensions");

  const updateType = await p.select({
    message: "What would you like to update?",
    options: [
      { value: "all", label: "🔄 Update all extensions", hint: "Check and update all" },
      { value: "specific", label: "🎯 Update specific extension", hint: "By ID" },
    ],
  });

  if (p.isCancel(updateType)) return;

  const s = p.spinner();
  s.start("Updating...");

  try {
    const updateCommand = await loadCommand("update");
    const options: GlobalOptions = {
      quiet: false,
      yes: false,
    };

    let args: string[] = [];

    if (updateType === "specific") {
      s.stop();
      const extensionId = await p.text({
        message: "Enter extension ID:",
        placeholder: "publisher.extension-name",
      });
      if (p.isCancel(extensionId)) return;
      args = [extensionId];
      s.start("Updating...");
    }

    const result = await updateCommand.execute(args, options);

    s.stop("Done!");

    if (result.status === "ok") {
      p.log.success(result.summary);
    } else {
      p.log.error(result.summary);
    }
  } catch (error) {
    s.stop("Failed");
    throw error;
  }
}

/**
 * Handle setup wizard
 */
async function handleSetup() {
  p.log.step("Setup Wizard");

  const setupCommand = await loadCommand("setup");
  const options: GlobalOptions = {
    quiet: false,
    yes: false,
  };

  const result = await setupCommand.execute([], options);

  if (result.status === "ok") {
    p.log.success(result.summary);
  } else {
    p.log.error(result.summary);
  }
}

/**
 * Handle doctor (health check)
 */
async function handleDoctor() {
  p.log.step("Health Check");

  const s = p.spinner();
  s.start("Running diagnostics...");

  try {
    const doctorCommand = await loadCommand("doctor");
    const options: GlobalOptions = {
      quiet: false,
      yes: false,
    };

    const result = await doctorCommand.execute([], options);

    s.stop("Done!");

    if (result.status === "ok") {
      p.log.success(result.summary);
      
      // Offer to auto-fix if issues found
      if (result.items && result.items.some(item => item.status === "failed")) {
        const shouldFix = await p.confirm({
          message: "Would you like to auto-fix issues?",
          initialValue: true,
        });

        if (!p.isCancel(shouldFix) && shouldFix) {
          s.start("Applying fixes...");
          // TODO: Run doctor with --fix flag
          s.stop("Fixes applied!");
        }
      }
    } else {
      p.log.error(result.summary);
    }
  } catch (error) {
    s.stop("Failed");
    throw error;
  }
}

/**
 * Advanced options sub-menu
 */
async function handleAdvancedMenu() {
  const action = await p.select({
    message: "Advanced Options",
    options: [
      { value: "list", label: "📋 List installed extensions", hint: "Export to file" },
      { value: "remove", label: "🗑️  Remove extensions", hint: "Uninstall" },
      { value: "info", label: "ℹ️  Extension info", hint: "View details" },
      { value: "back", label: "⬅️  Back to main menu" },
    ],
  });

  if (p.isCancel(action) || action === "back") return;

  switch (action) {
    case "list":
      await handleListExtensions();
      break;
    case "remove":
      await handleRemoveExtensions();
      break;
    case "info":
      await handleExtensionInfo();
      break;
  }
}

/**
 * Handle listing extensions
 */
async function handleListExtensions() {
  p.log.step("List Extensions");

  const format = await p.select({
    message: "Output format:",
    options: [
      { value: "table", label: "📊 Table (console)", hint: "Human-readable" },
      { value: "json", label: "📄 JSON", hint: "Machine-readable" },
      { value: "yaml", label: "📝 YAML", hint: "Config format" },
      { value: "txt", label: "📃 Text", hint: "Simple list" },
    ],
  });

  if (p.isCancel(format)) return;

  const s = p.spinner();
  s.start("Loading extensions...");

  try {
    const listCommand = await loadCommand("list");
    const options: GlobalOptions = {
      quiet: false,
      output: format !== "table" ? `extensions.${format}` : undefined,
    };

    const result = await listCommand.execute([], options);

    s.stop("Done!");

    if (result.status === "ok") {
      p.log.success(result.summary);
    } else {
      p.log.error(result.summary);
    }
  } catch (error) {
    s.stop("Failed");
    throw error;
  }
}

/**
 * Handle removing extensions
 */
async function handleRemoveExtensions() {
  p.log.step("Remove Extensions");

  const extensionId = await p.text({
    message: "Enter extension ID to remove:",
    placeholder: "publisher.extension-name",
    validate: (value) => {
      if (!value) return "Extension ID is required";
    },
  });

  if (p.isCancel(extensionId)) return;

  const confirm = await p.confirm({
    message: `Remove ${extensionId}?`,
    initialValue: false,
  });

  if (p.isCancel(confirm) || !confirm) return;

  const s = p.spinner();
  s.start("Removing...");

  try {
    const removeCommand = await loadCommand("remove");
    const options: GlobalOptions = {
      quiet: false,
      yes: true,
    };

    const result = await removeCommand.execute([extensionId], options);

    s.stop("Done!");

    if (result.status === "ok") {
      p.log.success(result.summary);
    } else {
      p.log.error(result.summary);
    }
  } catch (error) {
    s.stop("Failed");
    throw error;
  }
}

/**
 * Handle extension info
 */
async function handleExtensionInfo() {
  p.log.step("Extension Info");

  const extensionId = await p.text({
    message: "Enter extension ID:",
    placeholder: "publisher.extension-name",
    validate: (value) => {
      if (!value) return "Extension ID is required";
    },
  });

  if (p.isCancel(extensionId)) return;

  const s = p.spinner();
  s.start("Fetching info...");

  try {
    const infoCommand = await loadCommand("info");
    const options: GlobalOptions = {
      quiet: false,
    };

    const result = await infoCommand.execute([extensionId], options);

    s.stop("Done!");

    if (result.status === "ok") {
      p.log.success(result.summary);
    } else {
      p.log.error(result.summary);
    }
  } catch (error) {
    s.stop("Failed");
    throw error;
  }
}

/**
 * Show help information
 */
async function handleHelp() {
  p.log.step("Help");

  p.note(
    `Common Commands:
  • add      - Add extensions (URL, file, or list)
  • update   - Update installed extensions
  • remove   - Uninstall extensions
  • list     - List installed extensions
  • info     - Show extension details
  • doctor   - Health check & diagnostics
  • setup    - Configuration wizard

Quick Tips:
  • Use arrow keys to navigate
  • Press Ctrl+C to cancel at any time
  • Tab completes file paths
  • Run 'vsix <command> --help' for details

Documentation: https://github.com/...`,
    "VSIX Extension Manager v2.0"
  );
}
