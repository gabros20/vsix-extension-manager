import * as p from "@clack/prompts";
import type { ConfigV2 } from "../config/constants";

export async function runInteractive(config: ConfigV2) {
  console.clear();
  p.intro("🔽 VSIX Extension Manager v2.0");

  // Interactive mode temporarily disabled during v2.0 migration
  p.log.warning("Interactive mode is being redesigned for v2.0");
  p.log.info("\nAvailable v2.0 commands:");
  p.log.message(`
  vsix add <url|file|directory|list|id>  - Add extensions (universal entry point)
  vsix remove <extension-id>             - Remove extensions
  vsix update [extension-id]             - Update extensions
  vsix list [--format json|yaml|txt]     - List installed extensions
  vsix info <extension-id>               - Show extension details
  vsix doctor                            - Health check & diagnostics
  vsix setup                             - Configuration wizard
  vsix rollback                          - Rollback to previous state
  `);
  p.log.info("Use --help with any command for more options");

  p.outro("Interactive menu will return in a future update");
  return;
}

// All legacy menu functions removed - interactive mode will be redesigned for v2.0
