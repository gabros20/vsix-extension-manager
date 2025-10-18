/**
 * Interactive mode for VSIX Extension Manager v2.0
 * Beautiful, task-oriented menus using Clack
 */

import * as p from "@clack/prompts";
import type { GlobalOptions } from "./base/types";
import { loadCommand } from "./registry";
import { configLoaderV2 } from "../config/loaderV2";

/**
 * Helper: Select editor with config preference (Approach 1)
 *
 * Always offers choice if multiple editors available,
 * but indicates which is the configured default.
 *
 * This allows users to:
 * - Quickly select their configured default (1 click)
 * - Override and choose non-default editor (1 click)
 */
async function selectEditorWithPreference(): Promise<"vscode" | "cursor"> {
  // Load config to get preference
  const config = await configLoaderV2.loadConfig();

  const { getEditorService } = await import("../features/install");
  const editorService = getEditorService();
  const availableEditors = await editorService.getAvailableEditors();

  if (availableEditors.length === 0) {
    p.log.error("No editors found. Please install VS Code or Cursor.");
    throw new Error("No editors found. Please install VS Code or Cursor.");
  }

  // Single editor - no choice needed
  if (availableEditors.length === 1) {
    const editor = availableEditors[0];
    p.log.info(`Using ${editor.displayName}`);
    return editor.name;
  }

  // Multiple editors available
  const hasExplicitPreference = config.editor.prefer !== "auto";
  const preferredEditor = availableEditors.find((e) => e.name === config.editor.prefer);

  // Build options with default indication
  const options = availableEditors.map((e) => {
    const isDefault = hasExplicitPreference && e.name === config.editor.prefer;
    const isRecommended = !hasExplicitPreference && e.name === "cursor";

    let hint: string | undefined;
    if (isDefault) {
      hint = "Default (configured)";
    } else if (isRecommended) {
      hint = "Recommended";
    }

    return {
      value: e.name,
      label: e.displayName,
      hint,
    };
  });

  // CRITICAL: Always prompt, even with configured preference
  // This allows users to choose non-default editor when needed
  const message =
    hasExplicitPreference && preferredEditor
      ? `Select editor (default: ${preferredEditor.displayName}):`
      : "Select target editor:";

  const editorChoice = await p.select({
    message,
    options,
  });

  if (p.isCancel(editorChoice)) {
    throw new Error("Editor selection cancelled");
  }

  const selectedEditor = editorChoice as "vscode" | "cursor";

  // Log if user chose non-default
  if (hasExplicitPreference && selectedEditor !== config.editor.prefer) {
    p.log.info(`Using ${selectedEditor === "cursor" ? "Cursor" : "VS Code"} (overriding default)`);
  }

  return selectedEditor;
}

/**
 * Group extensions by publisher for statistics
 */
function groupExtensionsByPublisher(extensions: Array<{ publisher: string; id: string }>) {
  return extensions.reduce(
    (acc, ext) => {
      if (!acc[ext.publisher]) {
        acc[ext.publisher] = [];
      }
      acc[ext.publisher].push(ext);
      return acc;
    },
    {} as Record<string, Array<{ publisher: string; id: string }>>,
  );
}

/**
 * Handle remove all extensions with warning
 */
async function handleRemoveAll(
  installed: Array<{ id: string; publisher: string; displayName: string }>,
): Promise<string[]> {
  const groupByPublisher = groupExtensionsByPublisher(installed);
  const topPublishers = Object.entries(groupByPublisher)
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 5);

  p.note(
    `You have ${installed.length} extensions from ${Object.keys(groupByPublisher).length} publishers\n\n` +
      `Top publishers:\n` +
      topPublishers.map(([pub, exts]) => `• ${pub}: ${exts.length} extensions`).join("\n"),
    "⚠️ Warning: This will remove ALL extensions",
  );

  const confirmed = await p.confirm({
    message: `Are you absolutely sure you want to remove all ${installed.length} extensions?`,
    initialValue: false,
  });

  if (p.isCancel(confirmed)) {
    return [];
  }

  return confirmed ? installed.map((e) => e.id) : [];
}

/**
 * Smart multiselect - handles small lists directly
 */
async function selectFromList(
  items: Array<{ id: string; displayName: string; version: string }>,
  message: string,
): Promise<string[]> {
  const selected = await p.multiselect({
    message,
    options: items.map((ext) => ({
      value: ext.id,
      label: `${ext.displayName || ext.id} (v${ext.version})`,
    })),
    required: false,
  });

  if (p.isCancel(selected)) {
    return [];
  }

  return selected as string[];
}

/**
 * Handle large filtered set (> 30 items)
 */
async function handleLargeFilteredSet(
  filtered: Array<{ id: string; displayName: string; version: string; publisher: string }>,
): Promise<string[]> {
  const action = await p.select({
    message: `Found ${filtered.length} matches (still a large list):`,
    options: [
      { value: "refine", label: "🔍 Refine search", hint: "Search again" },
      { value: "paginate", label: "📋 Browse pages", hint: "Paginated view" },
      { value: "all", label: `🗑️ Remove all ${filtered.length} matches`, hint: "Remove all" },
      { value: "cancel", label: "❌ Cancel" },
    ],
  });

  if (p.isCancel(action) || action === "cancel") {
    return [];
  }

  if (action === "refine") {
    return await handleSearchRemove(filtered);
  } else if (action === "paginate") {
    return await handleBrowseRemove(filtered);
  } else if (action === "all") {
    return await handleRemoveAll(filtered);
  }

  return [];
}

/**
 * Handle search-based removal
 */
async function handleSearchRemove(
  installed: Array<{ id: string; displayName: string; version: string; publisher: string }>,
): Promise<string[]> {
  const query = await p.text({
    message: "Search extensions:",
    placeholder: "name, publisher, or keyword",
    validate: (val) => (val.length < 2 ? "Enter at least 2 characters" : undefined),
  });

  if (p.isCancel(query)) {
    return [];
  }

  const lowerQuery = query.toLowerCase();
  const filtered = installed.filter(
    (ext) =>
      ext.id.toLowerCase().includes(lowerQuery) ||
      ext.displayName.toLowerCase().includes(lowerQuery) ||
      ext.publisher.toLowerCase().includes(lowerQuery),
  );

  if (filtered.length === 0) {
    p.log.warning(`No extensions match "${query}"`);
    return [];
  }

  p.log.info(`Found ${filtered.length} matching extension(s)`);

  if (filtered.length > 30) {
    return await handleLargeFilteredSet(filtered);
  }

  return await selectFromList(filtered, `Select from ${filtered.length} matches`);
}

/**
 * Handle paginated browsing for large lists
 */
async function handleBrowseRemove(
  installed: Array<{ id: string; displayName: string; version: string; publisher: string }>,
): Promise<string[]> {
  const PAGE_SIZE = 15;
  const totalPages = Math.ceil(installed.length / PAGE_SIZE);

  if (installed.length <= 20) {
    return await selectFromList(installed, "Select extensions to remove");
  }

  const selected = new Set<string>();
  let currentPage = 0;

  while (true) {
    const pageItems = installed.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);

    const action = await p.select({
      message: `Page ${currentPage + 1}/${totalPages} | ${selected.size} selected | Choose action:`,
      options: [
        {
          value: "select",
          label: `📋 Select from this page (${pageItems.length} items)`,
          hint: "Use Space to toggle",
        },
        {
          value: "next",
          label: "➡️ Next page",
          hint: currentPage < totalPages - 1 ? undefined : "(last page)",
        },
        {
          value: "prev",
          label: "⬅️ Previous page",
          hint: currentPage > 0 ? undefined : "(first page)",
        },
        { value: "jump", label: "🎯 Jump to page..." },
        { value: "search", label: "🔍 Switch to search mode" },
        {
          value: "done",
          label: "✅ Done selecting",
          hint: selected.size > 0 ? `${selected.size} to remove` : "None selected",
        },
        { value: "cancel", label: "❌ Cancel" },
      ],
    });

    if (p.isCancel(action) || action === "cancel") {
      return [];
    }

    if (action === "select") {
      const pageIds = pageItems.map((ext) => ext.id);
      const initiallySelected = pageIds.filter((id) => selected.has(id));

      const pageSelection = await p.multiselect({
        message: `Select extensions (Page ${currentPage + 1}/${totalPages}) - Ctrl+C to go back:`,
        options: pageItems.map((ext) => ({
          value: ext.id,
          label: `${ext.displayName || ext.id} (v${ext.version})`,
        })),
        initialValues: initiallySelected,
        required: false,
      });

      if (!p.isCancel(pageSelection)) {
        pageIds.forEach((id) => selected.delete(id));
        (pageSelection as string[]).forEach((id) => selected.add(id));
      }
    } else if (action === "next" && currentPage < totalPages - 1) {
      currentPage++;
    } else if (action === "prev" && currentPage > 0) {
      currentPage--;
    } else if (action === "jump") {
      const pageNum = await p.text({
        message: `Jump to page (1-${totalPages}):`,
        validate: (val) => {
          const num = Number.parseInt(val);
          if (Number.isNaN(num) || num < 1 || num > totalPages) {
            return `Enter a number between 1 and ${totalPages}`;
          }
        },
      });

      if (!p.isCancel(pageNum)) {
        currentPage = Number.parseInt(pageNum) - 1;
      }
    } else if (action === "search") {
      return await handleSearchRemove(installed);
    } else if (action === "done") {
      break;
    }
  }

  return Array.from(selected);
}

/**
 * Handle search-based update selection
 */
async function handleSearchUpdate(
  installed: Array<{ id: string; displayName: string; version: string; publisher: string }>,
): Promise<string[]> {
  const query = await p.text({
    message: "Search extensions to update:",
    placeholder: "name, publisher, or keyword",
    validate: (val) => (val.length < 2 ? "Enter at least 2 characters" : undefined),
  });

  if (p.isCancel(query)) {
    return [];
  }

  const lowerQuery = query.toLowerCase();
  const filtered = installed.filter(
    (ext) =>
      ext.id.toLowerCase().includes(lowerQuery) ||
      ext.displayName.toLowerCase().includes(lowerQuery) ||
      ext.publisher.toLowerCase().includes(lowerQuery),
  );

  if (filtered.length === 0) {
    p.log.warning(`No extensions match "${query}"`);
    return [];
  }

  p.log.info(`Found ${filtered.length} matching extension(s)`);

  if (filtered.length > 30) {
    return await handleLargeFilteredSetForUpdate(filtered);
  }

  return await selectFromListForUpdate(filtered, `Select from ${filtered.length} matches`);
}

/**
 * Handle large filtered set for update (> 30 items)
 */
async function handleLargeFilteredSetForUpdate(
  filtered: Array<{ id: string; displayName: string; version: string; publisher: string }>,
): Promise<string[]> {
  const action = await p.select({
    message: `Found ${filtered.length} matches (still a large list):`,
    options: [
      { value: "refine", label: "🔍 Refine search", hint: "Search again" },
      { value: "paginate", label: "📋 Browse pages", hint: "Paginated view" },
      { value: "all", label: `🔄 Update all ${filtered.length} matches`, hint: "Update all" },
      { value: "cancel", label: "❌ Cancel" },
    ],
  });

  if (p.isCancel(action) || action === "cancel") {
    return [];
  }

  if (action === "refine") {
    return await handleSearchUpdate(filtered);
  } else if (action === "paginate") {
    return await handleBrowseUpdate(filtered);
  } else if (action === "all") {
    return filtered.map((e) => e.id);
  }

  return [];
}

/**
 * Smart multiselect for update - handles small lists directly
 */
async function selectFromListForUpdate(
  items: Array<{ id: string; displayName: string; version: string }>,
  message: string,
): Promise<string[]> {
  const selected = await p.multiselect({
    message,
    options: items.map((ext) => ({
      value: ext.id,
      label: `${ext.displayName || ext.id} (v${ext.version})`,
    })),
    required: false,
  });

  if (p.isCancel(selected)) {
    return [];
  }

  return selected as string[];
}

/**
 * Handle paginated browsing for update (large lists)
 */
async function handleBrowseUpdate(
  installed: Array<{ id: string; displayName: string; version: string; publisher: string }>,
): Promise<string[]> {
  const PAGE_SIZE = 15;
  const totalPages = Math.ceil(installed.length / PAGE_SIZE);

  if (installed.length <= 20) {
    return await selectFromListForUpdate(installed, "Select extensions to update");
  }

  const selected = new Set<string>();
  let currentPage = 0;

  while (true) {
    const pageItems = installed.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);

    const action = await p.select({
      message: `Page ${currentPage + 1}/${totalPages} | ${selected.size} selected | Choose action:`,
      options: [
        {
          value: "select",
          label: `📋 Select from this page (${pageItems.length} items)`,
          hint: "Use Space to toggle",
        },
        {
          value: "next",
          label: "➡️ Next page",
          hint: currentPage < totalPages - 1 ? undefined : "(last page)",
        },
        {
          value: "prev",
          label: "⬅️ Previous page",
          hint: currentPage > 0 ? undefined : "(first page)",
        },
        { value: "jump", label: "🎯 Jump to page..." },
        { value: "search", label: "🔍 Switch to search mode" },
        {
          value: "done",
          label: "✅ Done selecting",
          hint: selected.size > 0 ? `${selected.size} to update` : "None selected",
        },
        { value: "cancel", label: "❌ Cancel" },
      ],
    });

    if (p.isCancel(action) || action === "cancel") {
      return [];
    }

    if (action === "select") {
      const pageIds = pageItems.map((ext) => ext.id);
      const initiallySelected = pageIds.filter((id) => selected.has(id));

      const pageSelection = await p.multiselect({
        message: `Select extensions (Page ${currentPage + 1}/${totalPages}) - Ctrl+C to go back:`,
        options: pageItems.map((ext) => ({
          value: ext.id,
          label: `${ext.displayName || ext.id} (v${ext.version})`,
        })),
        initialValues: initiallySelected,
        required: false,
      });

      if (!p.isCancel(pageSelection)) {
        pageIds.forEach((id) => selected.delete(id));
        (pageSelection as string[]).forEach((id) => selected.add(id));
      }
    } else if (action === "next" && currentPage < totalPages - 1) {
      currentPage++;
    } else if (action === "prev" && currentPage > 0) {
      currentPage--;
    } else if (action === "jump") {
      const pageNum = await p.text({
        message: `Jump to page (1-${totalPages}):`,
        validate: (val) => {
          const num = Number.parseInt(val);
          if (Number.isNaN(num) || num < 1 || num > totalPages) {
            return `Enter a number between 1 and ${totalPages}`;
          }
          return undefined;
        },
      });

      if (!p.isCancel(pageNum)) {
        currentPage = Number.parseInt(pageNum as string) - 1;
      }
    } else if (action === "search") {
      return await handleSearchUpdate(installed);
    } else if (action === "done") {
      break;
    }
  }

  return Array.from(selected);
}

/**
 * Main interactive menu - Quick actions for common tasks
 */
export async function runInteractive() {
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

  // Select editor with config preference (Approach 1: Always offer choice with default indicated)
  const selectedEditor = await selectEditorWithPreference();

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
      editor: selectedEditor, // Pass selected editor
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

  // Select editor with config preference (Approach 1: Always offer choice with default indicated)
  const selectedEditor = await selectEditorWithPreference();

  const { getInstalledExtensions } = await import("../features/export");
  const installed = await getInstalledExtensions(selectedEditor);

  if (installed.length === 0) {
    p.log.warning("No extensions found");
    return;
  }

  const updateMode = await p.select({
    message: `What would you like to update? (${installed.length} installed):`,
    options: [
      { value: "all", label: "🔄 Update all extensions", hint: "Check and update all" },
      {
        value: "search",
        label: "🔍 Search and select",
        hint: "Filter by name/publisher/keyword",
      },
      {
        value: "browse",
        label: "📋 Browse and select",
        hint: installed.length > 30 ? "Paginated view" : "Full list",
      },
    ],
  });

  if (p.isCancel(updateMode)) return;

  let toUpdate: string[] = [];

  switch (updateMode) {
    case "all":
      // Don't set toUpdate - let the update command handle all
      break;
    case "search":
      toUpdate = await handleSearchUpdate(installed);
      break;
    case "browse":
      toUpdate = await handleBrowseUpdate(installed);
      break;
  }

  if (updateMode !== "all" && toUpdate.length === 0) {
    p.log.info("No extensions selected for update");
    return;
  }

  try {
    const updateCommand = await loadCommand("update");
    const options: GlobalOptions = {
      quiet: false,
      yes: false,
      editor: selectedEditor,
    };

    // Update command manages its own progress display
    const result = await updateCommand.execute(toUpdate, options);

    if (result.status === "ok") {
      p.log.success(result.summary);
    } else {
      p.log.error(result.summary);
    }
  } catch (error) {
    p.log.error(`Update failed: ${error instanceof Error ? error.message : String(error)}`);
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
      if (result.items && result.items.some((item) => item.status === "failed")) {
        const shouldFix = await p.confirm({
          message: "Would you like to auto-fix issues?",
          initialValue: true,
        });

        if (!p.isCancel(shouldFix) && shouldFix) {
          s.start("Applying fixes...");

          // Run doctor with --fix flag
          const fixOptions: GlobalOptions = {
            quiet: false,
            yes: false,
            fix: true,
          };
          const fixResult = await doctorCommand.execute([], fixOptions);

          s.stop("Done!");

          if (fixResult.status === "ok") {
            p.log.success("Fixes applied successfully");
          } else {
            p.log.error("Some fixes could not be applied");
          }
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

  // Select editor with config preference (Approach 1: Always offer choice with default indicated)
  const selectedEditor = await selectEditorWithPreference();

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
    // Type-safe options that satisfy both GlobalOptions and list command requirements
    const options: GlobalOptions & {
      format?: "table" | "json" | "yaml" | "txt" | "csv";
      output?: string;
    } = {
      quiet: false,
      editor: selectedEditor, // Pass selected editor
      format: format as "table" | "json" | "yaml" | "txt" | "csv",
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
 * Handle removing extensions (enhanced with pagination and search)
 */
async function handleRemoveExtensions() {
  p.log.step("Remove Extensions");

  const selectedEditor = await selectEditorWithPreference();

  const { getInstalledExtensions } = await import("../features/export");
  const installed = await getInstalledExtensions(selectedEditor);

  if (installed.length === 0) {
    p.log.warning("No extensions found");
    return;
  }

  const mode = await p.select({
    message: `Choose removal method (${installed.length} installed):`,
    options: [
      {
        value: "all",
        label: `🗑️ Remove all ${installed.length} extensions`,
        hint: "Clean slate",
      },
      {
        value: "search",
        label: "🔍 Search and select",
        hint: "Filter by name/publisher/keyword",
      },
      {
        value: "browse",
        label: "📋 Browse and select",
        hint: installed.length > 30 ? "Paginated view" : "Full list",
      },
    ],
  });

  if (p.isCancel(mode)) return;

  let toRemove: string[] = [];

  switch (mode) {
    case "all":
      toRemove = await handleRemoveAll(installed);
      break;
    case "search":
      toRemove = await handleSearchRemove(installed);
      break;
    case "browse":
      toRemove = await handleBrowseRemove(installed);
      break;
  }

  if (toRemove.length === 0) {
    p.log.info("No extensions selected for removal");
    return;
  }

  const confirm = await p.confirm({
    message: `Remove ${toRemove.length} extension(s) from ${selectedEditor === "cursor" ? "Cursor" : "VS Code"}?`,
    initialValue: false,
  });

  if (p.isCancel(confirm) || !confirm) {
    p.log.info("Removal cancelled");
    return;
  }

  const s = p.spinner();
  s.start(`Removing ${toRemove.length} extension(s)...`);

  try {
    const removeCommand = await loadCommand("remove");

    const options: GlobalOptions = {
      quiet: false,
      yes: true,
      editor: selectedEditor,
    };

    const result = await removeCommand.execute(toRemove, options);

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
  • Run 'vsix-extension-manager <command> --help' for details

Documentation: https://github.com/gabros20/vsix-extension-manager`,
    "VSIX Extension Manager v2.0",
  );
}
