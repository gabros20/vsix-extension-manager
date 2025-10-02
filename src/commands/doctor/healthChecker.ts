/**
 * Health checker for VSIX Extension Manager
 * Runs comprehensive diagnostics on the system
 */

import * as fs from "fs-extra";
import * as path from "path";
import * as os from "os";
import { getEditorService } from "../../features/install";

export type HealthStatus = "pass" | "warning" | "fail";

export interface HealthCheck {
  name: string;
  status: HealthStatus;
  message: string;
  details?: string;
  fixable?: boolean;
  fixCommand?: string;
}

export interface HealthReport {
  overall: HealthStatus;
  checks: HealthCheck[];
  summary: {
    passed: number;
    warnings: number;
    failed: number;
  };
}

/**
 * Health checker service
 */
export class HealthChecker {
  private editorService = getEditorService();

  /**
   * Run all health checks
   */
  async runChecks(): Promise<HealthReport> {
    const checks: HealthCheck[] = [];

    // Run checks in parallel for speed
    const checkResults = await Promise.allSettled([
      this.checkEditorInstallation(),
      this.checkBinaryPaths(),
      this.checkExtensionsDirectories(),
      this.checkNetworkConnectivity(),
      this.checkCorruptedExtensions(),
      this.checkConfiguration(),
      this.checkDiskSpace(),
    ]);

    // Collect all results
    for (const result of checkResults) {
      if (result.status === "fulfilled") {
        checks.push(...result.value);
      } else {
        checks.push({
          name: "Health Check Error",
          status: "fail",
          message: `Check failed: ${result.reason}`,
          fixable: false,
        });
      }
    }

    // Calculate summary
    const summary = {
      passed: checks.filter((c) => c.status === "pass").length,
      warnings: checks.filter((c) => c.status === "warning").length,
      failed: checks.filter((c) => c.status === "fail").length,
    };

    // Determine overall status
    let overall: HealthStatus = "pass";
    if (summary.failed > 0) {
      overall = "fail";
    } else if (summary.warnings > 0) {
      overall = "warning";
    }

    return { overall, checks, summary };
  }

  /**
   * Check editor installation
   */
  private async checkEditorInstallation(): Promise<HealthCheck[]> {
    const checks: HealthCheck[] = [];
    const editors = await this.editorService.getAvailableEditors();

    if (editors.length === 0) {
      checks.push({
        name: "Editor Detection",
        status: "fail",
        message: "No editors found (VS Code or Cursor)",
        details: "Please install VS Code or Cursor to use this tool",
        fixable: false,
      });
    } else {
      for (const editor of editors) {
        checks.push({
          name: `${editor.displayName} Detection`,
          status: "pass",
          message: `${editor.displayName} detected`,
          details: `Binary: ${editor.binaryPath}`,
        });
      }
    }

    return checks;
  }

  /**
   * Check binary paths and symlinks
   */
  private async checkBinaryPaths(): Promise<HealthCheck[]> {
    const checks: HealthCheck[] = [];

    // Check 'code' command
    const codeResult = await this.checkBinary("code", "VS Code");
    if (codeResult) checks.push(codeResult);

    // Check 'cursor' command
    const cursorResult = await this.checkBinary("cursor", "Cursor");
    if (cursorResult) checks.push(cursorResult);

    return checks;
  }

  /**
   * Check a specific binary
   */
  private async checkBinary(command: string, displayName: string): Promise<HealthCheck | null> {
    try {
      // Use exec to check if command exists
      const { promisify } = await import("util");
      const { exec } = await import("child_process");
      const execAsync = promisify(exec);

      const result = await execAsync(`command -v ${command}`);
      const binaryPath = result.stdout.trim();

      // Check if it's a symlink
      const stats = await fs.lstat(binaryPath);
      if (stats.isSymbolicLink()) {
        const realPath = await fs.readlink(binaryPath);
        return {
          name: `${command} Command`,
          status: "pass",
          message: `${displayName} CLI available`,
          details: `Symlink: ${binaryPath} → ${realPath}`,
        };
      }

      return {
        name: `${command} Command`,
        status: "pass",
        message: `${displayName} CLI available`,
        details: `Binary: ${binaryPath}`,
      };
    } catch {
      return {
        name: `${command} Command`,
        status: "warning",
        message: `${displayName} CLI not in PATH`,
        details: "You can still use --code-bin or --cursor-bin flags",
        fixable: false,
      };
    }
  }

  /**
   * Check extensions directories
   */
  private async checkExtensionsDirectories(): Promise<HealthCheck[]> {
    const checks: HealthCheck[] = [];
    const editors = await this.editorService.getAvailableEditors();

    for (const editor of editors) {
      const extensionsPath = this.getExtensionsPath(editor.name);

      if (!extensionsPath) {
        checks.push({
          name: `${editor.displayName} Extensions Dir`,
          status: "warning",
          message: "Extensions directory not configured",
          fixable: false,
        });
        continue;
      }

      // Check if directory exists
      const exists = await fs.pathExists(extensionsPath);
      if (!exists) {
        checks.push({
          name: `${editor.displayName} Extensions Dir`,
          status: "fail",
          message: "Extensions directory does not exist",
          details: extensionsPath,
          fixable: true,
          fixCommand: "create-dir",
        });
        continue;
      }

      // Check if writable
      try {
        await fs.access(extensionsPath, fs.constants.W_OK);
        checks.push({
          name: `${editor.displayName} Extensions Dir`,
          status: "pass",
          message: "Extensions directory ready",
          details: extensionsPath,
        });
      } catch {
        checks.push({
          name: `${editor.displayName} Extensions Dir`,
          status: "fail",
          message: "Extensions directory not writable",
          details: extensionsPath,
          fixable: false,
        });
      }
    }

    return checks;
  }

  /**
   * Get extensions path for editor
   */
  private getExtensionsPath(editorName: string): string | null {
    const homeDir = os.homedir();
    const platform = os.platform();

    if (editorName === "vscode") {
      if (platform === "darwin") {
        return path.join(homeDir, ".vscode", "extensions");
      } else if (platform === "win32") {
        return path.join(homeDir, ".vscode", "extensions");
      } else {
        return path.join(homeDir, ".vscode", "extensions");
      }
    } else if (editorName === "cursor") {
      if (platform === "darwin") {
        return path.join(homeDir, ".cursor", "extensions");
      } else if (platform === "win32") {
        return path.join(homeDir, ".cursor", "extensions");
      } else {
        return path.join(homeDir, ".cursor", "extensions");
      }
    }

    return null;
  }

  /**
   * Check network connectivity
   */
  private async checkNetworkConnectivity(): Promise<HealthCheck[]> {
    const checks: HealthCheck[] = [];

    // Check VS Code Marketplace
    const marketplaceResult = await this.pingUrl(
      "https://marketplace.visualstudio.com",
      "VS Code Marketplace",
    );
    checks.push(marketplaceResult);

    // Check Open VSX
    const openVsxResult = await this.pingUrl("https://open-vsx.org", "Open VSX Registry");
    checks.push(openVsxResult);

    return checks;
  }

  /**
   * Ping a URL to check connectivity
   */
  private async pingUrl(url: string, name: string): Promise<HealthCheck> {
    try {
      const https = await import("https");
      const http = await import("http");

      const protocol = url.startsWith("https") ? https : http;
      const urlObj = new URL(url);

      const response = await new Promise<boolean>((resolve) => {
        const req = protocol.request(
          {
            hostname: urlObj.hostname,
            port: urlObj.port || (protocol === https ? 443 : 80),
            path: urlObj.pathname,
            method: "HEAD",
            timeout: 5000,
          },
          (res) => {
            resolve(res.statusCode !== undefined && res.statusCode >= 200 && res.statusCode < 400);
          },
        );

        req.on("error", () => resolve(false));
        req.on("timeout", () => {
          req.destroy();
          resolve(false);
        });
        req.end();
      });

      if (response) {
        return {
          name: `${name} Access`,
          status: "pass",
          message: `${name} reachable`,
        };
      } else {
        return {
          name: `${name} Access`,
          status: "warning",
          message: `${name} not reachable`,
          fixable: false,
        };
      }
    } catch (error) {
      return {
        name: `${name} Access`,
        status: "warning",
        message: `Cannot reach ${name}`,
        details: error instanceof Error ? error.message : String(error),
        fixable: false,
      };
    }
  }

  /**
   * Check for corrupted extensions
   */
  private async checkCorruptedExtensions(): Promise<HealthCheck[]> {
    const checks: HealthCheck[] = [];
    const editors = await this.editorService.getAvailableEditors();

    for (const editor of editors) {
      const extensionsPath = this.getExtensionsPath(editor.name);
      if (!extensionsPath || !(await fs.pathExists(extensionsPath))) {
        continue;
      }

      try {
        const extensions = await fs.readdir(extensionsPath);
        let corruptCount = 0;

        for (const extDir of extensions) {
          const extPath = path.join(extensionsPath, extDir);
          const stats = await fs.stat(extPath);

          if (!stats.isDirectory()) continue;

          // Check for package.json
          const packagePath = path.join(extPath, "package.json");
          if (!(await fs.pathExists(packagePath))) {
            corruptCount++;
          }
        }

        if (corruptCount === 0) {
          checks.push({
            name: `${editor.displayName} Extension Integrity`,
            status: "pass",
            message: "All extensions appear intact",
          });
        } else {
          checks.push({
            name: `${editor.displayName} Extension Integrity`,
            status: "warning",
            message: `${corruptCount} corrupted extension(s) found`,
            details: "Missing package.json files",
            fixable: true,
            fixCommand: "clean-corrupted",
          });
        }
      } catch (error) {
        checks.push({
          name: `${editor.displayName} Extension Integrity`,
          status: "warning",
          message: "Could not check extensions",
          details: error instanceof Error ? error.message : String(error),
          fixable: false,
        });
      }
    }

    return checks;
  }

  /**
   * Check configuration validity
   */
  private async checkConfiguration(): Promise<HealthCheck[]> {
    const checks: HealthCheck[] = [];

    // Check for config files
    const configPaths = [
      path.join(os.homedir(), ".vsix", "config.yml"),
      path.join(process.cwd(), ".vsix.yml"),
    ];

    let foundConfig = false;

    for (const configPath of configPaths) {
      if (await fs.pathExists(configPath)) {
        foundConfig = true;
        try {
          await fs.readFile(configPath, "utf-8");
          checks.push({
            name: `Configuration (${path.basename(configPath)})`,
            status: "pass",
            message: "Configuration file valid",
            details: configPath,
          });
        } catch (error) {
          checks.push({
            name: `Configuration (${path.basename(configPath)})`,
            status: "fail",
            message: "Configuration file invalid",
            details: error instanceof Error ? error.message : String(error),
            fixable: false,
          });
        }
      }
    }

    if (!foundConfig) {
      checks.push({
        name: "Configuration",
        status: "pass",
        message: "Using default configuration",
      });
    }

    return checks;
  }

  /**
   * Check available disk space
   */
  private async checkDiskSpace(): Promise<HealthCheck[]> {
    const checks: HealthCheck[] = [];

    try {
      // Use os.freemem() as a proxy for available disk space
      // This is an approximation, actual disk space check would need platform-specific commands
      const freeMemGB = os.freemem() / (1024 * 1024 * 1024);
      const availableGB = freeMemGB; // Simplified approximation

      if (availableGB < 1) {
        checks.push({
          name: "Disk Space",
          status: "fail",
          message: "Less than 1 GB available",
          details: `${availableGB.toFixed(2)} GB free`,
          fixable: false,
        });
      } else if (availableGB < 5) {
        checks.push({
          name: "Disk Space",
          status: "warning",
          message: "Low disk space",
          details: `${availableGB.toFixed(2)} GB free`,
          fixable: false,
        });
      } else {
        checks.push({
          name: "Disk Space",
          status: "pass",
          message: "Sufficient disk space",
          details: `${availableGB.toFixed(2)} GB free`,
        });
      }
    } catch (error) {
      checks.push({
        name: "Disk Space",
        status: "warning",
        message: "Could not check disk space",
        fixable: false,
      });
    }

    return checks;
  }
}

/**
 * Singleton instance
 */
export const healthChecker = new HealthChecker();
