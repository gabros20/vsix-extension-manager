import * as p from "@clack/prompts";
import type { Config } from "../config/constants";

export async function runInteractive(config: Config) {
  console.clear();
  p.intro("🔽 VSIX Extension Manager");

  const choice = await p.select({
    message: "What do you want to do?",
    options: [
      { value: "single", label: "📦 Single download" },
      { value: "bulk", label: "📚 Bulk download (JSON file)" },
      { value: "from-list", label: "📥 Download from list (txt/json/extensions.json)" },
      { value: "export", label: "📤 Export installed extensions" },
      { value: "versions", label: "🔢 List available versions" },
      { value: "quit", label: "Quit" },
    ],
  });

  if (p.isCancel(choice) || choice === "quit") {
    p.cancel("Operation cancelled.");
    process.exit(0);
  }

  switch (choice) {
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
  }
}
