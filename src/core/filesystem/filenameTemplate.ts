import { sanitizeFilename } from "./fileManager";

/**
 * Variables available for filename template substitution
 */
export interface TemplateVariables {
  name: string; // Extension name/itemName
  version: string; // Version number
  source: string; // marketplace/open-vsx
  publisher?: string; // Publisher name (if available)
  displayName?: string; // Display name (if available)
}

/**
 * Default filename template
 */
export const DEFAULT_FILENAME_TEMPLATE = "{name}-{version}.vsix";

/**
 * Generate filename from template with variable substitution
 */
export function generateFilename(template: string, variables: TemplateVariables): string {
  if (!template || template.trim() === "") {
    template = DEFAULT_FILENAME_TEMPLATE;
  }

  let result = template;

  // Replace all template variables
  Object.entries(variables).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      const regex = new RegExp(`\\{${key}\\}`, "g");
      result = result.replace(regex, String(value));
    }
  });

  // Ensure .vsix extension if not present
  if (!result.toLowerCase().endsWith(".vsix")) {
    result += ".vsix";
  }

  // Sanitize the filename for filesystem safety
  return sanitizeFilename(result);
}

/**
 * Validate filename template format
 */
export function validateTemplate(template: string): { isValid: boolean; error?: string } {
  if (!template || template.trim() === "") {
    return { isValid: true }; // Empty template is valid (will use default)
  }

  // Check for required variables
  const hasName = template.includes("{name}");
  const hasVersion = template.includes("{version}");

  if (!hasName && !hasVersion) {
    return {
      isValid: false,
      error: "Template must include at least {name} or {version} variable",
    };
  }

  // Check for invalid characters that could cause filesystem issues
  const invalidChars = ["<", ">", ":", '"', "|", "?", "*"];
  const templateWithoutVars = template.replace(/\{[^}]+\}/g, "");

  for (const char of invalidChars) {
    if (templateWithoutVars.includes(char)) {
      return {
        isValid: false,
        error: `Template contains invalid character: ${char}`,
      };
    }
  }

  return { isValid: true };
}

/**
 * Get available template variables for documentation/help
 */
export function getAvailableVariables(): Array<{ name: string; description: string }> {
  return [
    { name: "name", description: "Extension name/identifier" },
    { name: "version", description: "Version number" },
    { name: "source", description: "Source registry (marketplace/open-vsx)" },
    { name: "publisher", description: "Publisher name (when available)" },
    { name: "displayName", description: "Display name (when available)" },
  ];
}

/**
 * Generate example filenames for different templates
 */
export function generateExamples(template: string): string[] {
  const examples: TemplateVariables[] = [
    {
      name: "ms-python.python",
      version: "2023.1.0",
      source: "marketplace",
      publisher: "ms-python",
      displayName: "Python",
    },
    {
      name: "rust-lang.rust-analyzer",
      version: "0.3.1234",
      source: "open-vsx",
      publisher: "rust-lang",
      displayName: "rust-analyzer",
    },
  ];

  return examples.map((vars) => generateFilename(template, vars));
}
