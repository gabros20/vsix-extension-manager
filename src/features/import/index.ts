// Import feature - import/install extensions TO editors
export {
  parseExtensionsList,
  parseExtensionsListDetailed,
} from "./services/extensionListParserService";

// Type exports
export type { VSCodeExtensionsJson, ParseResult } from "./services/extensionListParserService";
export type { ExportFormat } from "../../core/types";
