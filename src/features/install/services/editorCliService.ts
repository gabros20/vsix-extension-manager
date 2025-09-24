import { spawn, spawnSync } from "child_process";
import fs from "fs-extra";
import os from "os";
import { InstallError } from "../../../core/errors";

export interface EditorInfo {
  name: "vscode" | "cursor";
  displayName: string;
  binaryPath: string;
  isAvailable: boolean;
}

export interface InstalledExtension {
  id: string;
  version: string;
  displayName?: string;
}

export interface InstallResult {
  success: boolean;
  extensionId?: string;
  error?: string;
  stdout?: string;
  stderr?: string;
  exitCode: number;
}

/**
 * Service for managing VS Code/Cursor CLI operations
 */
export class EditorCliService {
  private editors: Map<string, EditorInfo> = new Map();
  private initialized = false;

  constructor() {
    // Don't initialize editors immediately - make it lazy
  }

  /**
   * Initialize available editors by searching common installation paths
   */
  private async initializeEditors(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;
    const platform = os.platform();
    const homeDir = os.homedir();

    // Define search paths for each platform
    const searchPaths = this.getEditorSearchPaths(platform, homeDir);

    for (const [editorName, paths] of Object.entries(searchPaths)) {
      const binaryPath = this.findEditorBinary(editorName as "vscode" | "cursor", paths);
      const isAvailable = binaryPath ? await this.verifyEditorBinaryAsync(binaryPath) : false;

      this.editors.set(editorName, {
        name: editorName as "vscode" | "cursor",
        displayName: editorName === "vscode" ? "VS Code" : "Cursor",
        binaryPath: binaryPath || "",
        isAvailable,
      });
    }
  }

  /**
   * Get search paths for editors on different platforms
   */
  private getEditorSearchPaths(platform: string, homeDir: string): Record<string, string[]> {
    const paths: Record<string, string[]> = {
      vscode: [],
      cursor: [],
    };

    if (platform === "darwin") {
      // macOS paths
      paths.vscode = [
        "/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code",
        `${homeDir}/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code`,
        "/usr/local/bin/code",
        "/opt/homebrew/bin/code",
      ];
      paths.cursor = [
        "/Applications/Cursor.app/Contents/Resources/app/bin/cursor",
        `${homeDir}/Applications/Cursor.app/Contents/Resources/app/bin/cursor`,
        "/usr/local/bin/cursor",
        "/opt/homebrew/bin/cursor",
      ];
    } else if (platform === "win32") {
      // Windows paths
      const programFiles = process.env.PROGRAMFILES || "C:\\Program Files";
      const programFilesX86 = process.env["PROGRAMFILES(X86)"] || "C:\\Program Files (x86)";
      const localAppData = process.env.LOCALAPPDATA || `${homeDir}\\AppData\\Local`;

      paths.vscode = [
        `${programFiles}\\Microsoft VS Code\\bin\\code.cmd`,
        `${programFilesX86}\\Microsoft VS Code\\bin\\code.cmd`,
        `${localAppData}\\Programs\\Microsoft VS Code\\bin\\code.cmd`,
      ];
      paths.cursor = [
        `${localAppData}\\Programs\\cursor\\resources\\app\\bin\\cursor.cmd`,
        `${programFiles}\\Cursor\\resources\\app\\bin\\cursor.cmd`,
      ];
    } else {
      // Linux and others
      paths.vscode = [
        "/usr/bin/code",
        "/usr/local/bin/code",
        "/snap/bin/code",
        `${homeDir}/.local/bin/code`,
      ];
      paths.cursor = [
        "/usr/bin/cursor",
        "/usr/local/bin/cursor",
        "/snap/bin/cursor",
        `${homeDir}/.local/bin/cursor`,
      ];
    }

    return paths;
  }

  /**
   * Find editor binary by checking search paths
   */
  private findEditorBinary(editor: "vscode" | "cursor", searchPaths: string[]): string | null {
    // 1) Prefer well-known explicit paths for the target editor
    for (const searchPath of searchPaths) {
      if (fs.existsSync(searchPath)) {
        const real = this.resolveRealPath(searchPath);
        const identity = this.detectEditorIdentityFromPath(real);
        if (identity === editor) {
          return real;
        }
      }
    }

    // 2) Fallback to PATH command, but validate identity
    const commandName = editor === "vscode" ? "code" : "cursor";
    const absFromPath = this.resolveCommandAbsolutePath(commandName);
    if (absFromPath) {
      const real = this.resolveRealPath(absFromPath);
      const identity = this.detectEditorIdentityFromPath(real);
      if (identity === editor) {
        return real;
      }
    }

    return null;
  }

  /**
   * Check if a command is available in PATH
   */
  private isCommandAvailable(command: string): boolean {
    try {
      const result = spawnSync(command, ["--version"], {
        stdio: "pipe",
        timeout: 15000, // Increased to handle slower editors like Cursor
      });
      return result.status === 0 && !result.signal;
    } catch {
      return false;
    }
  }

  /**
   * Resolve command name to absolute path using PATH search
   */
  private resolveCommandAbsolutePath(command: string): string | null {
    // If already looks like a path, return realpath
    if (/[\\/]/.test(command)) {
      return this.resolveRealPath(command);
    }

    const pathEnv: string = process.env.PATH || "";
    const pathSep = process.platform === "win32" ? ";" : ":";
    const exts = process.platform === "win32" ? [".cmd", ".bat", ".exe", ""] : [""];
    for (const dir of pathEnv.split(pathSep)) {
      if (!dir) continue;
      for (const ext of exts) {
        const candidate = `${dir}${dir.endsWith("/") || dir.endsWith("\\") ? "" : process.platform === "win32" ? "\\" : "/"}${command}${ext}`;
        try {
          if (fs.existsSync(candidate)) {
            return this.resolveRealPath(candidate);
          }
        } catch {
          // ignore
        }
      }
    }
    return null;
  }

  private resolveRealPath(p: string): string {
    try {
      return fs.realpathSync(p);
    } catch {
      return p;
    }
  }

  /**
   * Best-effort identity detection by installation path
   */
  private detectEditorIdentityFromPath(p: string): "vscode" | "cursor" | "unknown" {
    const lower = p.toLowerCase();
    // macOS application bundles
    if (lower.includes("cursor.app")) return "cursor";
    if (lower.includes("visual studio code.app")) return "vscode";

    // Windows
    if (lower.endsWith("\\cursor.cmd") || lower.includes("\\cursor\\resources\\app\\bin\\"))
      return "cursor";
    if (lower.endsWith("\\code.cmd") || lower.includes("\\microsoft vs code\\bin\\"))
      return "vscode";

    // Linux and generic
    // Prefer explicit names in path segments
    if (/(^|[\\/])cursor([\\/]|$)/.test(lower)) return "cursor";
    if (/(^|[\\/])code([\\/]|$)/.test(lower)) return "vscode";

    return "unknown";
  }

  /**
   * Verify that an editor binary is working
   */
  private verifyEditorBinary(binaryPath: string): boolean {
    try {
      // Cursor can take longer to respond, so we increase timeout
      // Some editors (like Cursor) may take longer on first run
      const result = spawnSync(binaryPath, ["--version"], {
        stdio: "pipe",
        timeout: 15000, // Increased from 5000 to handle slower responses
      });
      // Check if command succeeded (exit code 0)
      // Some editors may not output version info but still return 0
      return result.status === 0 && !result.signal;
    } catch {
      return false;
    }
  }

  /**
   * Verify that an editor binary is working (async version for spinner support)
   */
  private async verifyEditorBinaryAsync(binaryPath: string): Promise<boolean> {
    return new Promise((resolve) => {
      const child = spawn(binaryPath, ["--version"], {
        stdio: "pipe",
        timeout: 15000, // Increased from 5000 to handle slower responses
      });

      child.on("close", (code, signal) => {
        resolve(code === 0 && !signal);
      });

      child.on("error", () => {
        resolve(false);
      });
    });
  }

  /**
   * Get information about available editors
   */
  async getAvailableEditors(): Promise<EditorInfo[]> {
    await this.initializeEditors(); // Lazy initialization
    return Array.from(this.editors.values()).filter((editor) => editor.isAvailable);
  }

  /**
   * Get editor info by name
   */
  async getEditorInfo(name: "vscode" | "cursor"): Promise<EditorInfo | null> {
    await this.initializeEditors(); // Lazy initialization
    return this.editors.get(name) || null;
  }

  /**
   * Resolve editor binary path with explicit override support
   */
  async resolveEditorBinary(
    editor: "vscode" | "cursor" | "auto",
    explicitPath?: string,
    allowMismatchedBinary: boolean = false,
  ): Promise<string> {
    // Use explicit path if provided
    if (explicitPath) {
      if (!fs.existsSync(explicitPath)) {
        throw new InstallError(
          `Explicit editor binary not found: ${explicitPath}`,
          "INSTALL_BINARY_NOT_FOUND",
          [
            { action: "Check path", description: "Verify the binary path is correct" },
            {
              action: "Install editor",
              description: `Install ${editor === "vscode" ? "VS Code" : "Cursor"}`,
            },
          ],
          { editor, explicitPath },
        );
      }
      const real = this.resolveRealPath(explicitPath);
      const identity = this.detectEditorIdentityFromPath(real);
      if (
        !allowMismatchedBinary &&
        editor !== "auto" &&
        identity !== "unknown" &&
        identity !== editor
      ) {
        throw new InstallError(
          `${editor === "vscode" ? "VS Code" : "Cursor"} requested, but binary points to ${identity} (${real})`,
          "INSTALL_BINARY_MISMATCH",
          [
            {
              action: "Use explicit binary",
              description:
                editor === "vscode"
                  ? 'Pass --code-bin "/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code"'
                  : 'Pass --cursor-bin "/Applications/Cursor.app/Contents/Resources/app/bin/cursor"',
            },
            {
              action: "Fix PATH mapping (macOS)",
              description:
                'In VS Code: Command Palette → ‘Shell Command: Install "code" command in PATH’, or update /usr/local/bin symlink',
            },
            {
              action: "Override",
              description: "Use --allow-mismatched-binary to proceed (not recommended)",
            },
          ],
          { editor, binaryPath: real, detected: identity },
        );
      }
      return real;
    }

    // Auto-detect preferred editor
    if (editor === "auto") {
      // Prefer Cursor if available, fallback to VS Code
      const cursor = await this.getEditorInfo("cursor");
      if (cursor?.isAvailable) {
        return cursor.binaryPath;
      }

      const vscode = await this.getEditorInfo("vscode");
      if (vscode?.isAvailable) {
        return vscode.binaryPath;
      }

      throw new InstallError(
        "No editors found. Please install VS Code or Cursor.",
        "INSTALL_NO_EDITORS",
        [
          {
            action: "Install VS Code",
            description: "Download from https://code.visualstudio.com/",
          },
          { action: "Install Cursor", description: "Download from https://cursor.sh/" },
          {
            action: "Set explicit path",
            description: "Use --code-bin or --cursor-bin to specify binary path",
          },
        ],
        { editor },
      );
    }

    // Specific editor requested
    const editorInfo = await this.getEditorInfo(editor);
    if (!editorInfo?.isAvailable) {
      throw new InstallError(
        `${editorInfo?.displayName || editor} is not available`,
        "INSTALL_EDITOR_NOT_FOUND",
        [
          { action: "Install editor", description: `Install ${editorInfo?.displayName || editor}` },
          { action: "Check PATH", description: "Ensure the editor binary is in your PATH" },
          {
            action: "Set explicit path",
            description: `Use --${editor}-bin to specify binary path`,
          },
        ],
        { editor, availableEditors: await this.getAvailableEditors() },
      );
    }

    // Final identity validation if possible
    const detected = this.detectEditorIdentityFromPath(editorInfo.binaryPath);
    if (!allowMismatchedBinary && detected !== "unknown" && detected !== editor) {
      throw new InstallError(
        `${editorInfo.displayName} requested, but resolved binary points to ${detected} (${editorInfo.binaryPath})`,
        "INSTALL_BINARY_MISMATCH",
        [
          {
            action: "Use explicit binary",
            description:
              editor === "vscode"
                ? 'Pass --code-bin "/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code"'
                : 'Pass --cursor-bin "/Applications/Cursor.app/Contents/Resources/app/bin/cursor"',
          },
          {
            action: "Override",
            description: "Use --allow-mismatched-binary to proceed (not recommended)",
          },
        ],
        { editor, binaryPath: editorInfo.binaryPath, detected },
      );
    }

    return editorInfo.binaryPath;
  }

  /**
   * Install a VSIX file using the editor CLI
   */
  async installVsix(
    binaryPath: string,
    vsixPath: string,
    options: {
      force?: boolean;
      timeout?: number;
    } = {},
  ): Promise<InstallResult> {
    const { force = false, timeout = 30000 } = options;

    return new Promise((resolve) => {
      const args = ["--install-extension", vsixPath];
      if (force) {
        args.push("--force");
      }

      const child = spawn(binaryPath, args, {
        stdio: ["ignore", "pipe", "pipe"],
        timeout,
      });

      let stdout = "";
      let stderr = "";

      child.stdout?.on("data", (data) => {
        stdout += data.toString();
      });

      child.stderr?.on("data", (data) => {
        stderr += data.toString();
      });

      child.on("close", (code) => {
        const success = code === 0;
        resolve({
          success,
          exitCode: code || 0,
          stdout: stdout.trim(),
          stderr: stderr.trim(),
        });
      });

      child.on("error", (error) => {
        resolve({
          success: false,
          error: error.message,
          exitCode: 1,
          stdout,
          stderr,
        });
      });
    });
  }

  /**
   * List installed extensions using editor CLI
   */
  async listInstalledExtensions(binaryPath: string): Promise<InstalledExtension[]> {
    return new Promise((resolve, reject) => {
      const child = spawn(binaryPath, ["--list-extensions", "--show-versions"], {
        stdio: ["ignore", "pipe", "pipe"],
        timeout: 10000,
      });

      let stdout = "";
      let stderr = "";

      child.stdout?.on("data", (data) => {
        stdout += data.toString();
      });

      child.stderr?.on("data", (data) => {
        stderr += data.toString();
      });

      child.on("close", (code) => {
        if (code !== 0) {
          reject(new Error(`Failed to list extensions: ${stderr || stdout}`));
          return;
        }

        const extensions = this.parseExtensionListOutput(stdout);
        resolve(extensions);
      });

      child.on("error", (error) => {
        reject(error);
      });
    });
  }

  /**
   * Parse the output of --list-extensions --show-versions
   */
  private parseExtensionListOutput(output: string): InstalledExtension[] {
    const lines = output
      .trim()
      .split("\n")
      .filter((line) => line.trim());
    const extensions: InstalledExtension[] = [];

    for (const line of lines) {
      // Format is typically: publisher.extension@version
      const atIndex = line.lastIndexOf("@");
      if (atIndex > 0) {
        const id = line.substring(0, atIndex);
        const version = line.substring(atIndex + 1);
        extensions.push({ id, version });
      } else {
        // Fallback for lines without version
        extensions.push({ id: line, version: "unknown" });
      }
    }

    return extensions;
  }

  /**
   * Uninstall an extension
   */
  async uninstallExtension(binaryPath: string, extensionId: string): Promise<InstallResult> {
    return new Promise((resolve) => {
      const child = spawn(binaryPath, ["--uninstall-extension", extensionId], {
        stdio: ["ignore", "pipe", "pipe"],
        timeout: 15000,
      });

      let stdout = "";
      let stderr = "";

      child.stdout?.on("data", (data) => {
        stdout += data.toString();
      });

      child.stderr?.on("data", (data) => {
        stderr += data.toString();
      });

      child.on("close", (code) => {
        const success = code === 0;
        resolve({
          success,
          extensionId,
          exitCode: code || 0,
          stdout: stdout.trim(),
          stderr: stderr.trim(),
        });
      });

      child.on("error", (error) => {
        resolve({
          success: false,
          extensionId,
          error: error.message,
          exitCode: 1,
          stdout,
          stderr,
        });
      });
    });
  }

  /**
   * Get editor version
   */
  async getEditorVersion(binaryPath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const child = spawn(binaryPath, ["--version"], {
        stdio: ["ignore", "pipe", "pipe"],
        timeout: 15000, // Increased to handle Cursor's slower response
      });

      let stdout = "";

      child.stdout?.on("data", (data) => {
        stdout += data.toString();
      });

      child.on("close", (code) => {
        if (code !== 0) {
          reject(new Error("Failed to get editor version"));
          return;
        }

        const version = stdout.trim().split("\n")[0] || "unknown";
        resolve(version);
      });

      child.on("error", (error) => {
        reject(error);
      });
    });
  }
}

// Global instance
let globalEditorService: EditorCliService | null = null;

export function getEditorService(): EditorCliService {
  if (!globalEditorService) {
    globalEditorService = new EditorCliService();
  }
  return globalEditorService;
}
