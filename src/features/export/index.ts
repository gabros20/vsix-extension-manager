// Export feature - export installed extensions FROM editors
export {
  getInstalledExtensions,
  formatExtensions,
  findWorkspaceExtensionsJson,
  getExtensionsPath,
} from "./services/installedExtensionsService";

// Type exports
export type {
  InstalledExtension,
  VSCodeExtensionsJson,
} from "./services/installedExtensionsService";
export type { ExportFormat, EditorType } from "../../core/types";
