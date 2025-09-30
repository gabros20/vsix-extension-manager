// Download feature main exports
export { downloadSingleExtension } from "./services/singleDownloadService";
export { downloadBulkExtensions } from "./services/bulkDownloadService";
export { downloadWithFallback } from "./services/downloadWithFallback";

// Type exports
export type { BulkOptions } from "../../core/types";
export type { SingleDownloadRequest, SingleDownloadResult } from "./services/singleDownloadService";
export type {
  BulkExtensionItem,
  BulkValidationResult,
  BulkDownloadResult,
} from "./services/bulkDownloadService";
