import * as p from "@clack/prompts";
import { downloadFile } from "../utils/downloader";
import { parseMarketplaceUrl, constructDownloadUrl, getDisplayNameFromUrl } from "../utils/urlParser";
import { createDownloadDirectory } from "../utils/fileManager";
import { downloadBulkExtensions } from "../utils/bulkDownloader";

interface DownloadOptions {
	url?: string;
	version?: string;
	output?: string;
}

export async function downloadVsix(options: DownloadOptions) {
	console.clear();

	p.intro("🔽 VSIX Downloader");

	try {
		// If command line options are provided, skip mode selection and go straight to single download
		if (options.url || options.version) {
			await downloadSingleExtension(options);
			return;
		}

		// Ask user to choose download mode
		const downloadMode = await p.select({
			message: "Choose download mode:",
			options: [
				{ value: "single", label: "📦 Single Extension", hint: "Download one extension interactively" },
				{ value: "bulk", label: "📚 Bulk Download", hint: "Download multiple extensions from JSON file" },
			],
		});

		if (p.isCancel(downloadMode)) {
			p.cancel("Operation cancelled.");
			process.exit(0);
		}

		if (downloadMode === "single") {
			await downloadSingleExtension(options);
		} else {
			await downloadBulkFromJson(options);
		}
	} catch (error) {
		p.log.error("❌ Error: " + (error instanceof Error ? error.message : String(error)));
		process.exit(1);
	}
}

async function downloadSingleExtension(options: DownloadOptions) {
	// Get marketplace URL
	let marketplaceUrl = options.url;
	if (!marketplaceUrl) {
		const urlResult = await p.text({
			message: "Enter the VS Code extension marketplace URL:",
			validate: (input: string) => {
				if (!input.trim()) {
					return "Please enter a valid URL";
				}
				if (!input.includes("marketplace.visualstudio.com")) {
					return "Please enter a valid Visual Studio Marketplace URL";
				}
				return undefined;
			},
		});

		if (p.isCancel(urlResult)) {
			p.cancel("Operation cancelled.");
			process.exit(0);
		}

		marketplaceUrl = urlResult as string;
	}

	// Parse URL to extract extension info
	const parseSpinner = p.spinner();
	parseSpinner.start("Parsing marketplace URL...");

	let extensionInfo;
	try {
		extensionInfo = parseMarketplaceUrl(marketplaceUrl as string);
		parseSpinner.stop("Extension info extracted");
	} catch (error) {
		parseSpinner.stop("Failed to parse marketplace URL", 1);
		throw error;
	}

	const displayName = getDisplayNameFromUrl(marketplaceUrl as string);
	p.note(`${displayName}`, "Extension");

	// Get version
	let version = options.version;
	if (!version) {
		const versionResult = await p.text({
			message: "Enter the extension version:",
			placeholder: "e.g., 1.2.3",
			validate: (input: string) => {
				if (!input.trim()) {
					return "Please enter a version number";
				}
				// Basic semver validation
				if (!/^\d+\.\d+\.\d+/.test(input.trim())) {
					return "Please enter a valid version number (e.g., 1.2.3)";
				}
				return undefined;
			},
		});

		if (p.isCancel(versionResult)) {
			p.cancel("Operation cancelled.");
			process.exit(0);
		}

		version = versionResult as string;
	}

	// Construct download URL and filename
	const downloadUrl = constructDownloadUrl(extensionInfo, version as string);
	const filename = `${extensionInfo.itemName}-${version}.vsix`;

	// Create output directory
	const outputDir = options.output || "./downloads";
	await createDownloadDirectory(outputDir);

	// Truncate URL for display (keep first 30 chars + ... + last 10 chars)
	const displayUrl = downloadUrl.length > 50 ? `${downloadUrl.slice(0, 30)}...${downloadUrl.slice(-10)}` : downloadUrl;

	p.note(`Filename: ${filename}\nOutput: ${outputDir}\nURL: ${displayUrl}`, "Download Details");

	// Confirm download
	const shouldProceed = await p.confirm({
		message: `Download ${filename}?`,
		initialValue: true,
	});

	if (p.isCancel(shouldProceed) || !shouldProceed) {
		p.cancel("Download cancelled.");
		return;
	}

	// Download the file
	const downloadSpinner = p.spinner();
	downloadSpinner.start(`Downloading ${filename}...`);

	try {
		const filePath = await downloadFile(downloadUrl, outputDir, filename);
		downloadSpinner.stop(`Downloaded successfully!`);

		// Get file size for display
		const fs = await import("fs-extra");
		const stats = await fs.stat(filePath);
		const sizeInKB = Math.round(stats.size / 1024);

		p.note(`File: ${filename}\nLocation: ${filePath}\nSize: ${sizeInKB} KB`, "Download Complete");

		p.outro(`🎉 Successfully downloaded VSIX extension!`);
	} catch (error) {
		downloadSpinner.stop("Download failed", 1);
		throw error;
	}
}

async function downloadBulkFromJson(options: DownloadOptions) {
	// Get JSON file path
	const jsonPath = await p.text({
		message: "Enter the path to your JSON file:",
		placeholder: "e.g., ./list.json or /path/to/extensions.json",
		validate: (input: string) => {
			if (!input.trim()) {
				return "Please enter a valid file path";
			}
			if (!input.endsWith(".json")) {
				return "File must have .json extension";
			}
			return undefined;
		},
	});

	if (p.isCancel(jsonPath)) {
		p.cancel("Operation cancelled.");
		process.exit(0);
	}

	// Get output directory
	const outputDir =
		options.output ||
		(await p.text({
			message: "Enter output directory:",
			placeholder: "./downloads",
			initialValue: "./downloads",
		}));

	if (p.isCancel(outputDir)) {
		p.cancel("Operation cancelled.");
		process.exit(0);
	}

	// Start bulk download process
	p.log.info("🔍 Reading and validating JSON file...");

	await downloadBulkExtensions(jsonPath as string, outputDir as string);
}
