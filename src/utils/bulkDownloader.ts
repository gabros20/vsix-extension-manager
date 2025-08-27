import * as p from "@clack/prompts";
import fs from "fs-extra";
import path from "path";
import { downloadFile } from "./downloader";
import { parseMarketplaceUrl, constructDownloadUrl, getDisplayNameFromUrl } from "./urlParser";
import { createDownloadDirectory } from "./fileManager";

interface BulkExtensionItem {
	url: string;
	version: string;
}

interface ValidationResult {
	isValid: boolean;
	errors: string[];
	validItems: BulkExtensionItem[];
}

// display name extraction is provided by getDisplayNameFromUrl in urlParser

/**
 * Validate JSON structure and content
 */
export function validateBulkJson(data: any): ValidationResult {
	const errors: string[] = [];
	const validItems: BulkExtensionItem[] = [];

	// Check if data is an array
	if (!Array.isArray(data)) {
		return {
			isValid: false,
			errors: ["JSON must be an array of extension objects"],
			validItems: [],
		};
	}

	// Check if array is not empty
	if (data.length === 0) {
		return {
			isValid: false,
			errors: ["JSON array cannot be empty"],
			validItems: [],
		};
	}

	// Validate each item
	data.forEach((item, index) => {
		const itemErrors: string[] = [];

		// Check required fields
		if (!item.url || typeof item.url !== "string") {
			itemErrors.push(`Item ${index + 1}: Missing or invalid 'url' field`);
		} else {
			// Validate URL format
			if (!item.url.includes("marketplace.visualstudio.com")) {
				itemErrors.push(`Item ${index + 1}: URL must be a valid Visual Studio Marketplace URL`);
			}
		}

		if (!item.version || typeof item.version !== "string") {
			itemErrors.push(`Item ${index + 1}: Missing or invalid 'version' field`);
		} else {
			// Basic version validation (allow flexible versioning)
			if (item.version.trim().length === 0) {
				itemErrors.push(`Item ${index + 1}: Version cannot be empty`);
			}
		}

		if (itemErrors.length > 0) {
			errors.push(...itemErrors);
		} else {
			validItems.push(item);
		}
	});

	return {
		isValid: errors.length === 0,
		errors,
		validItems,
	};
}

/**
 * Read and validate JSON file
 */
export async function readBulkJsonFile(filePath: string): Promise<ValidationResult> {
	try {
		// Check if file exists
		const exists = await fs.pathExists(filePath);
		if (!exists) {
			return {
				isValid: false,
				errors: [`File not found: ${filePath}`],
				validItems: [],
			};
		}

		// Read file content
		const content = await fs.readFile(filePath, "utf-8");

		// Parse JSON
		let data;
		try {
			data = JSON.parse(content);
		} catch (parseError) {
			return {
				isValid: false,
				errors: [`Invalid JSON format: ${parseError instanceof Error ? parseError.message : "Unknown error"}`],
				validItems: [],
			};
		}

		// Validate structure and content
		return validateBulkJson(data);
	} catch (error) {
		return {
			isValid: false,
			errors: [`Error reading file: ${error instanceof Error ? error.message : "Unknown error"}`],
			validItems: [],
		};
	}
}

/**
 * Download multiple extensions from JSON file
 */
export async function downloadBulkExtensions(filePath: string, outputDir: string = "./downloads"): Promise<void> {
	// Read and validate JSON
	const validation = await readBulkJsonFile(filePath);

	if (!validation.isValid) {
		p.log.error("❌ JSON Validation Failed:");
		validation.errors.forEach((error) => {
			p.log.error(`  • ${error}`);
		});
		throw new Error("Invalid JSON file");
	}

	const extensions = validation.validItems;

	p.log.success(`✅ JSON validation passed! Found ${extensions.length} extension(s) to download.`);

	// Create output directory
	await createDownloadDirectory(outputDir);

	// Download each extension
	let successCount = 0;
	let failureCount = 0;
	const failedDownloads: string[] = [];

	for (let i = 0; i < extensions.length; i++) {
		const ext = extensions[i];
		const spinner = p.spinner();

		try {
			// Parse marketplace URL
			const extensionInfo = parseMarketplaceUrl(ext.url);
			const downloadUrl = constructDownloadUrl(extensionInfo, ext.version);
			const filename = `${extensionInfo.itemName}-${ext.version}.vsix`;
			const displayName = getDisplayNameFromUrl(ext.url);

			spinner.start(`[${i + 1}/${extensions.length}] Downloading ${displayName}...`);

			// Download the file
			const filePath = await downloadFile(downloadUrl, outputDir, filename);

			// Get file size for display
			const stats = await fs.stat(filePath);
			const sizeInKB = Math.round(stats.size / 1024);

			spinner.stop(`[${i + 1}/${extensions.length}] ✅ Downloaded ${filename} (${sizeInKB} KB)`);
			successCount++;
		} catch (error) {
			const errorMsg = error instanceof Error ? error.message : "Unknown error";
			const displayName = getDisplayNameFromUrl(ext.url);

			spinner.stop(`[${i + 1}/${extensions.length}] ❌ Failed: ${displayName}`, 1);
			failureCount++;
			failedDownloads.push(`${displayName}: ${errorMsg}`);
		}
	}

	// Show final summary
	const summaryLines = [
		`Total extensions: ${extensions.length}`,
		`✅ Successful: ${successCount}`,
		`❌ Failed: ${failureCount}`,
		`📁 Output directory: ${outputDir}`,
	];

	if (failedDownloads.length > 0) {
		summaryLines.push("", "Failed downloads:");
		failedDownloads.forEach((failure) => {
			summaryLines.push(`  • ${failure}`);
		});
	}

	p.note(summaryLines.join("\n"), "Download Summary");

	if (successCount > 0) {
		p.outro(`🎉 Bulk download completed! ${successCount} extension(s) downloaded successfully.`);
	} else {
		p.outro("❌ No extensions were downloaded successfully.");
	}
}
