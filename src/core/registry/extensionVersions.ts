import axios from "axios";
import { DEFAULT_USER_AGENT } from "../../config/constants";
import type { ExtensionVersionInfo } from "../types";

/**
 * Fetch available versions for an extension using the Marketplace Gallery API
 * itemName format: "publisher.extension"
 */
export async function fetchExtensionVersions(itemName: string): Promise<ExtensionVersionInfo[]> {
  const url =
    "https://marketplace.visualstudio.com/_apis/public/gallery/extensionquery?api-version=3.0-preview.1";

  const body = {
    filters: [
      {
        criteria: [
          { filterType: 7, value: itemName }, // exact match on publisher.extension
        ],
        pageNumber: 1,
        pageSize: 1,
        sortBy: 0,
        sortOrder: 0,
      },
    ],
    assetTypes: [],
    // 103 is commonly used to include versions and version properties
    flags: 103,
  };

  const headers = {
    "Content-Type": "application/json",
    Accept: "application/json;api-version=3.0-preview.1",
    "User-Agent": DEFAULT_USER_AGENT,
  } as const;

  const response = await axios.post(url, body, { headers });

  const results = (response.data?.results ?? [])[0];
  const ext = results?.extensions?.[0];
  const versions = (ext?.versions ?? []) as Array<{
    version: string;
    lastUpdated?: string;
  }>;

  return versions.map((v) => ({ version: v.version, published: v.lastUpdated }));
}

/**
 * Fetch available versions for an extension from OpenVSX API
 * itemName format: "publisher.extension"
 */
export async function fetchOpenVsxVersions(itemName: string): Promise<ExtensionVersionInfo[]> {
  const [publisher, extension] = itemName.split(".");
  const url = `https://open-vsx.org/api/${publisher}/${extension}`;
  const headers = {
    Accept: "application/json",
    "User-Agent": DEFAULT_USER_AGENT,
  } as const;

  const response = await axios.get(url, { headers });
  const data = response.data ?? {};
  const allVersions = (data.allVersions ?? {}) as Record<string, string>;
  const versions = Object.keys(allVersions).filter((v) => v && v !== "latest");
  return versions.sort((a, b) => compareVersionsDesc(a, b)).map((v) => ({ version: v }));
}

function parseSemver(version: string): {
  major: number;
  minor: number;
  patch: number;
  prerelease?: string;
} | null {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)(-.+)?$/);
  if (!match) return null;
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    prerelease: match[4]?.slice(1),
  };
}

function compareVersionsDesc(a: string, b: string): number {
  const pa = parseSemver(a);
  const pb = parseSemver(b);
  if (pa && pb) {
    if (pa.major !== pb.major) return pb.major - pa.major;
    if (pa.minor !== pb.minor) return pb.minor - pa.minor;
    if (pa.patch !== pb.patch) return pb.patch - pa.patch;
    // Stable preferred over pre-release at same numeric level
    if (!!pa.prerelease !== !!pb.prerelease) return !!pa.prerelease ? 1 : -1;
    // Lexicographic fallback for prerelease tags
    if (pa.prerelease && pb.prerelease) return pb.prerelease.localeCompare(pa.prerelease);
    return 0;
  }
  // Fallback to lexical if not semver
  return b.localeCompare(a);
}

/**
 * Resolve a requested version. When requested is "latest", pick highest version.
 * If preferPreRelease is true and the latest highest numeric version is a prerelease,
 * it will be selected; otherwise, stable is preferred when available at the same numeric level.
 */
export async function resolveVersion(
  itemName: string,
  requested: string,
  preferPreRelease: boolean,
  source: "marketplace" | "open-vsx" | "auto" = "marketplace",
): Promise<string> {
  if (requested.toLowerCase() !== "latest") {
    return requested;
  }

  let infos: ExtensionVersionInfo[] = [];
  if (source === "open-vsx") {
    infos = await fetchOpenVsxVersions(itemName);
  } else if (source === "marketplace") {
    infos = await fetchExtensionVersions(itemName);
  } else {
    // auto: prefer marketplace; fallback to open-vsx
    try {
      infos = await fetchExtensionVersions(itemName);
    } catch {
      infos = await fetchOpenVsxVersions(itemName);
    }
  }
  if (!infos.length) {
    throw new Error("No versions found for the extension");
  }

  const sorted = infos.map((i) => i.version).sort((a, b) => compareVersionsDesc(a, b));

  // If not preferring prerelease, try to pick first stable at the top
  if (!preferPreRelease) {
    const stable = sorted.find((v) => !v.includes("-"));
    if (stable) return stable;
  }
  return sorted[0];
}
