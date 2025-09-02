import * as p from "@clack/prompts";
import type { Config } from "../config/constants";

export async function runInteractive(config: Config) {
  console.clear();
  p.intro("🔽 VSIX Extension Manager");

  const choice = await p.select({
    message: "What do you want to do?",
    options: [
      { value: "quick-install", label: "Quick install by URL (temp download → install → cleanup)" },
      { value: "single", label: "Download single extension from marketplace URL" },
      {
        value: "bulk",
        label: "Download multiple extensions from JSON collection (URLs + versions)",
      },
      { value: "from-list", label: "Download from exported list (txt / extensions.json)" },
      { value: "install-vsix-single", label: "Install single VSIX file into VS Code/Cursor" },
      { value: "install-vsix-dir", label: "Install all VSIX files from directory" },
      { value: "install-list", label: "Install extensions from list into VS Code/Cursor" },
      { value: "export", label: "Export installed extensions to (txt / extensions.json)" },
      { value: "versions", label: "Show extension versions for extension URL" },
      { value: "quit", label: "Quit" },
    ],
  });

  if (p.isCancel(choice) || choice === "quit") {
    p.cancel("Operation cancelled.");
    process.exit(0);
  }

  switch (choice) {
    case "quick-install": {
      const { runQuickInstallUI } = await import("./quickInstall");
      await runQuickInstallUI({ ...config });
      break;
    }
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
    case "export": {
      const { exportInstalled } = await import("./exportInstalled");
      await exportInstalled({ ...config });
      break;
    }
    case "versions": {
      const { listVersions } = await import("./versions");
      await listVersions({ ...config });
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
