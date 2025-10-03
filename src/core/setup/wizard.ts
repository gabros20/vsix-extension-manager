/**
 * First-Run Setup Wizard
 * Interactive configuration wizard for new users
 */

import * as fs from "fs-extra";
import * as path from "path";
import * as yaml from "yaml";
import { ui } from "../ui";
import type { ConfigV2 } from "../../config/schemaV2";
import { DEFAULT_CONFIG_V2 } from "../../config/schemaV2";
import { configLoaderV2 } from "../../config/loaderV2";

/**
 * Setup wizard options
 */
export interface SetupWizardOptions {
  skipWelcome?: boolean;
  outputPath?: string;
  forceOverwrite?: boolean;
}

/**
 * Setup wizard responses
 */
interface SetupResponses {
  editor: "cursor" | "vscode" | "auto";
  safety: boolean;
  parallelDownloads: string;
  configLocation: "home" | "project" | "none";
}

/**
 * First-run setup wizard
 */
export class SetupWizard {
  /**
   * Check if first-run setup is needed
   */
  async isFirstRun(): Promise<boolean> {
    return !(await configLoaderV2.configExists());
  }

  /**
   * Run first-time setup wizard
   */
  async run(options: SetupWizardOptions = {}): Promise<ConfigV2 | null> {
    // Check if config already exists
    if (!options.forceOverwrite) {
      const exists = await configLoaderV2.configExists(options.outputPath);
      if (exists) {
        ui.log.info("Configuration already exists. Use --force to overwrite.");
        return null;
      }
    }

    // Show welcome message
    if (!options.skipWelcome) {
      this.showWelcome();
    }

    // Gather configuration through interactive prompts
    const responses = await this.gatherResponses();

    // Generate configuration from responses
    const config = this.generateConfig(responses);

    // Save configuration if requested
    if (responses.configLocation !== "none") {
      const configPath = await this.saveConfig(
        config,
        responses.configLocation,
        options.outputPath,
      );

      if (configPath) {
        ui.log.success(`✓ Configuration saved to: ${configPath}`);

        // Show next steps
        this.showNextSteps(configPath);
      }
    } else {
      ui.log.info("Configuration not saved (you can create it later)");
    }

    ui.outro("Setup complete! You're ready to go.");

    return config;
  }

  /**
   * Show welcome message
   */
  private showWelcome(): void {
    ui.intro("👋 Welcome to VSIX Extension Manager v2.0!");

    console.log("");
    ui.log.message("Let's set up your configuration (takes ~2 minutes)");
    ui.log.message("You can always change these settings later in your config file");
    console.log("");
  }

  /**
   * Gather configuration through interactive prompts
   */
  private async gatherResponses(): Promise<SetupResponses> {
    const responses = await ui.group({
      editor: () =>
        ui.select({
          message: "Which editor do you use primarily?",
          options: [
            {
              value: "auto",
              label: "Auto-detect (recommended)",
              hint: "Automatically detect Cursor or VS Code",
            },
            { value: "cursor", label: "Cursor", hint: "Use Cursor exclusively" },
            { value: "vscode", label: "VS Code", hint: "Use VS Code exclusively" },
          ],
        }),

      safety: () => ui.confirm("Enable safety features? (Recommended)", true),

      parallelDownloads: () =>
        ui.text({
          message: "How many parallel downloads? (1-10)",
          placeholder: "3",
          defaultValue: "3",
          validate: (value) => {
            const num = parseInt(value);
            if (isNaN(num) || num < 1 || num > 10) {
              return "Please enter a number between 1 and 10";
            }
          },
        }),

      configLocation: () =>
        ui.select({
          message: "Where should we save your configuration?",
          options: [
            {
              value: "home",
              label: "Home directory (~/.vsix/config.yml)",
              hint: "Global configuration",
            },
            { value: "project", label: "Current project (.vsix.yml)", hint: "Project-specific" },
            { value: "none", label: "Don't save (use defaults)", hint: "No configuration file" },
          ],
        }),
    });

    return {
      editor: responses.editor as "cursor" | "vscode" | "auto",
      safety: responses.safety as boolean,
      parallelDownloads: responses.parallelDownloads as string,
      configLocation: responses.configLocation as "home" | "project" | "none",
    };
  }

  /**
   * Generate configuration from responses
   */
  private generateConfig(responses: SetupResponses): ConfigV2 {
    const parallelDownloads = parseInt(responses.parallelDownloads) || 3;

    const config: ConfigV2 = {
      ...DEFAULT_CONFIG_V2,
      editor: {
        prefer: responses.editor,
      },
      safety: {
        "check-compatibility": responses.safety,
        "auto-backup": responses.safety,
        "verify-checksums": responses.safety,
        "allow-mismatch": false,
      },
      performance: {
        "parallel-downloads": parallelDownloads,
        "parallel-installs": 1,
        timeout: 30000,
        retry: 2,
        "retry-delay": 1000,
      },
      behavior: {
        "skip-installed": "ask",
        "update-check": "weekly",
        "auto-retry": true,
        "download-dir": "./downloads",
      },
    };

    return config;
  }

  /**
   * Save configuration to file
   */
  private async saveConfig(
    config: ConfigV2,
    location: "home" | "project",
    customPath?: string,
  ): Promise<string | null> {
    try {
      const configPath = customPath || this.getConfigPath(location);

      // Ensure directory exists
      await fs.ensureDir(path.dirname(configPath));

      // Add helpful comments to the config
      const configWithComments = this.addComments(config);

      // Write YAML file
      await fs.writeFile(configPath, configWithComments);

      return configPath;
    } catch (error) {
      ui.log.error(
        `Failed to save configuration: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }

  /**
   * Get configuration file path
   */
  private getConfigPath(location: "home" | "project"): string {
    const homeDir = process.env.HOME || process.env.USERPROFILE || "~";

    if (location === "home") {
      return path.join(homeDir, ".vsix", "config.yml");
    } else {
      return path.join(process.cwd(), ".vsix.yml");
    }
  }

  /**
   * Add helpful comments to configuration
   */
  private addComments(config: ConfigV2): string {
    const header = `# VSIX Extension Manager v2.0 Configuration
# Generated by setup wizard
# See: https://github.com/username/vsix-extension-manager/docs/configuration

`;

    // Convert to YAML
    const yamlContent = yaml.stringify(config);

    return header + yamlContent;
  }

  /**
   * Show next steps after setup
   */
  private showNextSteps(configPath: string): void {
    console.log("");
    ui.note(
      `To get started:

1. Install extensions:
   vsix add <url|id|file>

2. Run health check:
   vsix doctor

3. View your config:
   cat ${configPath}

4. Edit your config:
   edit ${configPath}`,
      "Next Steps",
    );
  }

  /**
   * Run quick setup with minimal prompts
   */
  async runQuick(outputPath?: string): Promise<ConfigV2 | null> {
    ui.intro("⚡ Quick Setup");

    const editor = await ui.select({
      message: "Which editor?",
      options: [
        { value: "auto", label: "Auto-detect" },
        { value: "cursor", label: "Cursor" },
        { value: "vscode", label: "VS Code" },
      ],
    });

    const config: ConfigV2 = {
      ...DEFAULT_CONFIG_V2,
      editor: {
        prefer: editor as "auto" | "cursor" | "vscode",
      },
    };

    const configPath = outputPath || this.getConfigPath("home");
    await fs.ensureDir(path.dirname(configPath));
    await fs.writeFile(configPath, yaml.stringify(config));

    ui.log.success(`✓ Configuration saved to: ${configPath}`);
    ui.outro("Quick setup complete!");

    return config;
  }

  /**
   * Run setup in non-interactive mode with defaults
   */
  async runNonInteractive(
    options: {
      editor?: "cursor" | "vscode" | "auto";
      safety?: boolean;
      parallelDownloads?: number;
      outputPath?: string;
    } = {},
  ): Promise<ConfigV2> {
    const config: ConfigV2 = {
      ...DEFAULT_CONFIG_V2,
      editor: {
        prefer: options.editor || "auto",
      },
      safety: {
        "check-compatibility": options.safety ?? true,
        "auto-backup": options.safety ?? true,
        "verify-checksums": options.safety ?? true,
        "allow-mismatch": false,
      },
      performance: {
        "parallel-downloads": options.parallelDownloads || 3,
        "parallel-installs": 1,
        timeout: 30000,
        retry: 2,
        "retry-delay": 1000,
      },
    };

    if (options.outputPath) {
      await fs.ensureDir(path.dirname(options.outputPath));
      await fs.writeFile(options.outputPath, yaml.stringify(config));
    }

    return config;
  }
}

/**
 * Singleton instance
 */
export const setupWizard = new SetupWizard();

/**
 * Convenience function to run setup wizard
 */
export async function runSetupWizard(options?: SetupWizardOptions): Promise<ConfigV2 | null> {
  return await setupWizard.run(options);
}
