import fs from "fs-extra";
import path from "node:path";

export interface ExtensionEntry {
  identifier: { id: string };
  version: string;
  location: { $mid: number; path: string; scheme: string };
  relativeLocation: string;
  metadata: {
    installedTimestamp: number;
    pinned: boolean;
    source: string;
  };
}

export class ExtensionStateManager {
  private lockFile: string;

  constructor(private extensionsDir: string) {
    this.lockFile = path.join(extensionsDir, ".ext-lock");
  }

  private async withLock<T>(fn: () => Promise<T>): Promise<T> {
    const lock = this.lockFile;
    let acquired = false;
    for (let i = 0; i < 30; i++) {
      try {
        await fs.writeFile(lock, process.pid.toString(), { flag: "wx" });
        acquired = true;
        break;
      } catch {
        await new Promise((r) => setTimeout(r, 100));
      }
    }
    if (!acquired) throw new Error("Could not acquire extensions metadata lock");
    try {
      return await fn();
    } finally {
      await fs.remove(lock);
    }
  }

  async readExtensionsJson(): Promise<ExtensionEntry[]> {
    const file = path.join(this.extensionsDir, "extensions.json");
    if (!(await fs.pathExists(file))) return [];
    try {
      const data = await fs.readFile(file, "utf-8");
      const parsed = JSON.parse(data);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  async writeExtensionsJson(entries: ExtensionEntry[]): Promise<void> {
    const file = path.join(this.extensionsDir, "extensions.json");
    await fs.writeFile(file, JSON.stringify(entries, null, 2));
  }

  async addExtension(entry: ExtensionEntry): Promise<void> {
    await this.withLock(async () => {
      const entries = await this.readExtensionsJson();
      const idx = entries.findIndex((e) => e.identifier.id === entry.identifier.id);
      if (idx >= 0) entries[idx] = entry;
      else entries.push(entry);
      await this.writeExtensionsJson(entries);
    });
  }

  async removeExtension(extensionId: string): Promise<void> {
    await this.withLock(async () => {
      const entries = await this.readExtensionsJson();
      const filtered = entries.filter((e) => e.identifier.id !== extensionId);
      await this.writeExtensionsJson(filtered);
    });
  }

  async ensureObsoleteFile(): Promise<void> {
    const file = path.join(this.extensionsDir, ".obsolete");
    if (!(await fs.pathExists(file))) {
      await fs.writeFile(file, JSON.stringify({}, null, 2));
    }
  }

  async addToObsolete(extensionId: string): Promise<void> {
    const file = path.join(this.extensionsDir, ".obsolete");
    await this.ensureObsoleteFile();
    const data = JSON.parse(await fs.readFile(file, "utf-8"));
    data[extensionId] = true;
    await fs.writeFile(file, JSON.stringify(data, null, 2));
  }

  async removeFromObsolete(extensionId: string): Promise<void> {
    const file = path.join(this.extensionsDir, ".obsolete");
    if (!(await fs.pathExists(file))) return;
    const data = JSON.parse(await fs.readFile(file, "utf-8"));
    delete data[extensionId];
    await fs.writeFile(file, JSON.stringify(data, null, 2));
  }

  async validateState(): Promise<void> {
    await this.ensureObsoleteFile();
    await this.readExtensionsJson();
  }
}
