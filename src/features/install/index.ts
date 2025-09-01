// Install feature main exports
export { EditorCliService, getEditorService } from "./services/editorCliService";
export type { EditorInfo, InstalledExtension, InstallResult } from "./services/editorCliService";

export { VsixScannerService, getVsixScanner } from "./services/vsixScannerService";
export type { VsixFile, ScanResult } from "./services/vsixScannerService";

export { InstallService, getInstallService } from "./services/installService";
export type {
  InstallOptions,
  InstallTask,
  InstallTaskResult,
  BulkInstallResult,
} from "./services/installService";

export {
  InstallFromListService,
  getInstallFromListService,
} from "./services/installFromListService";
export type {
  InstallFromListOptions,
  InstallFromListResult,
} from "./services/installFromListService";
